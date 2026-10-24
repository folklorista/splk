<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Identity\GroupRepository;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

/** D-48/D-51: group administration stays outside costume permissions. */
final class GroupController extends Controller
{
    public function register(Router $router): void
    {
        $router->add('GET', '/v1/groups', $this->list(...));
        $router->add('POST', '/v1/groups', $this->save(...));
        $router->add('PATCH', '/v1/groups/{id}', $this->save(...));
        $router->add('POST', '/v1/groups/{id}/members', $this->add(...));
        $router->add('DELETE', '/v1/groups/{id}/members/{membershipId}', $this->revoke(...));
        $router->add('GET', '/v1/funds/{unitId}/inventories/groups', $this->options(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        InventoryInput::only($request->query, ['limit', 'offset']); [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->repository()->list($limit, $offset));
    }

    private function options(Request $request, RequestContext $context): Response
    {
        (new FundAccess($this->db()))->require($this->mandates($context), $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset']); [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->repository()->options($limit, $offset));
    }

    private function save(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $body = $request->json(); InventoryInput::only($body, ['name', 'unitId', 'archived']); $input = new Input($body);
        $id = isset($context->params['id']) ? self::routeId($context) : null;
        return Response::json($this->audited($context, $id === null ? 'group.create' : 'group.update', null, function () use ($id, $input, $context): array {
            $current = $id === null ? null : ($this->repository()->find($id, true) ?? throw self::notFound());
            $name = $input->has('name') || $current === null ? $input->text('name') : $current['name'];
            $unit = $input->has('unitId') ? $input->nullableId('unitId') : ($current['unitId'] ?? null);
            if ($unit !== null) {
                $query = $this->db()->prepare('SELECT 1 FROM units WHERE id = :id AND archived_at IS NULL FOR SHARE'); $query->execute(['id' => $unit]);
                if ($query->fetchColumn() === false) throw Input::invalid('unitId', 'invalid');
            }
            $values = ['name' => $name, 'unitId' => $unit, 'archived' => $input->has('archived') ? $input->bool('archived') : ($current['archived'] ?? false)];
            if ($id === null && $values['archived']) throw Input::invalid('archived', 'not_allowed');
            if ($id === null) $id = $this->repository()->insert($values, self::actor($context));
            else $this->repository()->update($id, $values);
            return $this->repository()->find($id);
        }), $id === null ? 201 : 200);
    }

    private function add(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        InventoryInput::only($request->json(), ['personId', 'validFrom', 'validTo']); $input = Input::fromRequest($request);
        $person = $input->id('personId'); $from = self::date($input, 'validFrom') ?? $this->db()->query('SELECT current_date')->fetchColumn(); $to = self::date($input, 'validTo');
        if ($to !== null && $to < $from) throw Input::invalid('validTo', 'invalid');
        return Response::json($this->audited($context, 'group.member_add', null, function () use ($context, $person, $from, $to): array {
            $group = $this->repository()->find(self::routeId($context), true) ?? throw self::notFound();
            if ($group['archived']) throw Input::invalid('groupId', 'invalid');
            $query = $this->db()->prepare('SELECT id FROM persons WHERE id = :id FOR SHARE'); $query->execute(['id' => $person]);
            if ($query->fetchColumn() === false) throw Input::invalid('personId', 'invalid');
            $this->repository()->addMember($group['id'], $person, $from, $to, self::actor($context));
            return $this->repository()->find($group['id']);
        }), 201);
    }

    private function revoke(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin(); $id = self::routeId($context, 'membershipId');
        return Response::json($this->audited($context, 'group.member_revoke', null, function () use ($context, $id): array {
            $group = $this->repository()->find(self::routeId($context), true) ?? throw self::notFound();
            if (!$this->repository()->revoke($group['id'], $id, self::actor($context))) throw self::notFound();
            return $this->repository()->find($group['id']);
        }, auditData: ['membershipId' => $id]));
    }

    private static function date(Input $input, string $field): ?string
    {
        $date = $input->optionalString($field, 10);
        if ($date !== null && (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) throw Input::invalid($field, 'invalid');
        return $date;
    }
    private function repository(): GroupRepository { return new GroupRepository($this->db()); }
}
