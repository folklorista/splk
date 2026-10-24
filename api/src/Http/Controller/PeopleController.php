<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Identity\PeopleRepository;
use Splk\Api\Domain\Costumes\LoanRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

final class PeopleController extends Controller
{
    private const FIELDS = ['firstName', 'lastName', 'nickname', 'contact', 'defaultCostume'];
    private const PAPER_STATES = ['paper', 'migrating', 'digital'];

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/people', $this->list(...));
        $router->add('POST', '/v1/people', $this->create(...));
        $router->add('PATCH', '/v1/people/{id}', $this->update(...));
        $router->add('GET', '/v1/funds/{unitId}/people/{id}/card', $this->card(...));
        $router->add('PUT', '/v1/funds/{unitId}/people/{id}/profile', $this->profile(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $contact = $this->requireAccess($context, false);
        InventoryInput::only($request->query, ['limit', 'offset', 'q', 'unit', 'fund', 'paperState', 'hasLoans']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        $filters = ['q' => (new Input($request->query))->optionalString('q', 200)];
        if (isset($request->query['unit'])) $filters['unit'] = InventoryInput::queryInteger($request->query['unit'], 'unit');
        $fund = isset($request->query['fund']) ? InventoryInput::queryInteger($request->query['fund'], 'fund') : null;
        if ($fund !== null) $this->fund($context, (string) $fund, false);
        if (isset($request->query['paperState'])) {
            if ($fund === null) throw Input::invalid('fund', 'required');
            $filters['paperState'] = (new Input($request->query))->enum('paperState', self::PAPER_STATES);
        }
        if (isset($request->query['hasLoans'])) {
            if ($fund === null) throw Input::invalid('fund', 'required');
            $filters['hasLoans'] = match ($request->query['hasLoans']) { 'true' => true, 'false' => false, default => throw Input::invalid('hasLoans', 'invalid') };
        }
        return Response::json($this->people()->list($filters, $contact, $fund, $limit, $offset));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $this->requireAccess($context, true);
        InventoryInput::only($request->json(), [...self::FIELDS, 'confirmDuplicate']);
        $input = Input::fromRequest($request); $values = $this->values($input); $confirmed = $input->bool('confirmDuplicate', false);
        return Response::json($this->audited($context, 'person.create', null, function () use ($values, $confirmed, $context): array {
            $duplicates = $this->people()->duplicates($values['firstName'], $values['lastName']);
            if ($duplicates !== [] && !$confirmed) {
                throw new HttpException(422, 'possible_duplicate', 'People with the same name already exist. Confirm a separate identity.', ['people' => $duplicates]);
            }
            return $this->people()->find($this->people()->insert($values, self::actor($context)), true);
        }), 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $this->requireAccess($context, true);
        InventoryInput::only($request->json(), self::FIELDS);
        $input = Input::fromRequest($request); $id = self::routeId($context);
        return Response::json($this->audited($context, 'person.update', null, function () use ($id, $input): array {
            $current = $this->people()->find($id, true, true) ?? throw self::notFound();
            $this->people()->update($id, $this->values($input, $current));
            return $this->people()->find($id, true);
        }));
    }

    private function card(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        $person = $this->people()->find(self::routeId($context), $this->hasManageAccess($context)) ?? throw self::notFound();
        return Response::json(['person' => $person, 'profile' => $this->people()->profile($unit, $person['id']),
            'openLoans' => (new LoanRepository($this->db()))->list($unit, ['person' => $person['id'], 'open' => true], 50, 0),
            'movements' => (new LoanRepository($this->db()))->movements($unit, ['person' => $person['id']], 50, 0)]);
    }

    private function profile(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        $id = self::routeId($context);
        InventoryInput::only($request->json(), ['paperState', 'note']);
        $input = Input::fromRequest($request); $state = $input->enum('paperState', self::PAPER_STATES);
        return Response::json($this->audited($context, 'holder_profile.update', $unit, function () use ($id, $unit, $input, $state, $context): array {
            $this->people()->find($id, true, true) ?? throw self::notFound();
            $old = $this->people()->profile($unit, $id);
            $note = $input->has('note') ? $input->optionalString('note', 5000) : ($old['note'] ?? null);
            return $this->people()->saveProfile($unit, $id, $state, $note, self::actor($context));
        }));
    }

    private function values(Input $input, ?array $current = null): array
    {
        return ['firstName' => $input->has('firstName') || $current === null ? $input->text('firstName', 100) : $current['firstName'],
            'lastName' => $input->has('lastName') || $current === null ? $input->text('lastName', 100) : $current['lastName'],
            'nickname' => $input->has('nickname') ? $input->optionalString('nickname', 100) : ($current['nickname'] ?? null),
            'contact' => $input->has('contact') ? $input->optionalString('contact', 1000) : ($current['contact'] ?? null),
            'defaultCostume' => $input->has('defaultCostume') ? $input->enum('defaultCostume', ['male', 'female', 'unspecified']) : ($current['defaultCostume'] ?? 'unspecified')];
    }

    /** Returns whether the caller may see the shared contact. Admin rights alone never open costume endpoints. */
    private function requireAccess(RequestContext $context, bool $write): bool
    {
        $mandates = $this->mandates($context); $view = false; $manage = false;
        foreach ($this->db()->query('SELECT id FROM units WHERE has_costume_fund AND archived_at IS NULL')->fetchAll() as $unit) {
            $view = $view || $mandates->canViewFund((int) $unit['id']);
            $manage = $manage || $mandates->canManageFund((int) $unit['id']);
        }
        if (!$view || ($write && !$manage)) throw new HttpException(403, 'forbidden', 'A costume fund mandate is required.');
        return $manage;
    }

    private function hasManageAccess(RequestContext $context): bool { return $this->requireAccess($context, false); }
    private function people(): PeopleRepository { return new PeopleRepository($this->db()); }
    private function fund(RequestContext $context, string $unit, bool $write): int { return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write); }
}
