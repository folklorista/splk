<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\CostRepository;
use Splk\Api\Http\{HttpException, Input, InventoryInput, Request, RequestContext, Response, Router};
use Splk\Api\Infrastructure\Db\Transaction;

final class CostController extends Controller
{
    private const FIELDS = ['spentOn', 'amount', 'currency', 'supplier', 'documentRef', 'description', 'purpose'];
    public function register(Router $router): void
    {
        $router->add('GET', '/v1/costs', $this->list(...));
        $router->add('GET', '/v1/costs/funds', $this->funds(...));
        $router->add('GET', '/v1/funds/{unitId}/costs', $this->list(...));
        $router->add('POST', '/v1/funds/{unitId}/costs', $this->create(...));
        $router->add('GET', '/v1/costs/{id}', $this->detail(...));
        $router->add('PATCH', '/v1/costs/{id}', $this->update(...));
    }
    private function units(RequestContext $context): array
    {
        $mandates = $this->mandates($context); $all = $mandates->canViewAllCosts();
        return array_values(array_filter(array_map(intval(...), $this->db()->query('SELECT id FROM units WHERE has_costume_fund OR EXISTS (SELECT 1 FROM costume_costs c WHERE c.unit_id = units.id)')->fetchAll(\PDO::FETCH_COLUMN)), fn ($id) => $all || $mandates->canViewFund($id)));
    }
    private function readUnits(RequestContext $context): array {
        $units = $this->units($context); $mandates = $this->mandates($context);
        if ($units === [] && !$mandates->canViewAllCosts() && !$mandates->canViewFund(0)) throw new HttpException(403, 'forbidden', 'Cost evidence requires a costume or cost mandate.');
        return $units;
    }
    private function funds(Request $request, RequestContext $context): Response {
        InventoryInput::only($request->query, []); $units = $this->readUnits($context); $mandates = $this->mandates($context);
        $rows = $this->db()->query('SELECT id, name, has_costume_fund, archived_at FROM units ORDER BY name, id')->fetchAll();
        return Response::json(['items' => array_values(array_map(fn ($u) => ['unitId' => (int) $u['id'], 'name' => $u['name'], 'archived' => $u['archived_at'] !== null,
            'canManage' => $u['has_costume_fund'] && $u['archived_at'] === null && $mandates->canManageFund((int) $u['id'])], array_filter($rows, fn ($u) => in_array((int) $u['id'], $units, true))))])->withHeader('Cache-Control', 'no-store');
    }
    private function list(Request $request, RequestContext $context): Response
    {
        $units = $this->readUnits($context);
        InventoryInput::only($request->query, ['unitId', 'from', 'to', 'currency', 'q', 'limit', 'offset']); [$limit, $offset] = InventoryInput::pagination($request->query);
        $selected = isset($context->params['unitId']) ? self::routeId($context, 'unitId') : (isset($request->query['unitId']) ? InventoryInput::queryInteger($request->query['unitId'], 'unitId') : null);
        if ($selected !== null) { if (!in_array($selected, $units, true)) throw self::notFound(); $units = [$selected]; }
        if (isset($context->params['unitId'], $request->query['unitId']) && InventoryInput::queryInteger($request->query['unitId'], 'unitId') !== $selected) throw Input::invalid('unitId', 'invalid');
        $filters = [];
        foreach (['from', 'to'] as $field) if (isset($request->query[$field])) $filters[$field] = $this->date($request->query[$field], $field);
        if (isset($filters['from'], $filters['to']) && $filters['from'] > $filters['to']) throw Input::invalid('to', 'invalid');
        if (isset($request->query['currency'])) $filters['currency'] = $this->currency($request->query['currency']);
        if (isset($request->query['q'])) $filters['q'] = (new Input($request->query))->text('q', 200);
        $csv = str_contains($request->header('accept') ?? '', 'text/csv'); $nested = $this->db()->inTransaction();
        $data = Transaction::run($this->db(), function () use ($nested, $units, $filters, $limit, $offset, $csv): array {
            if (!$nested) $this->db()->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            $data = $this->repo()->list($units, $filters, $csv ? 200 : $limit, $csv ? 0 : $offset);
            if ($csv) while (count($data['items']) < $data['total']) { $page = $this->repo()->list($units, $filters, 200, count($data['items'])); $data['items'] = [...$data['items'], ...$page['items']]; }
            return $data;
        });
        if (!$csv) return Response::json($data)->withHeader('Cache-Control', 'no-store');
        $rows = array_map(fn ($c) => [$c['id'], $c['unitId'], $c['spentOn'], $c['amount'], $c['currency'], $c['supplier'], $c['documentRef'], $c['description'], $c['purpose'], implode(' · ', array_map(fn ($l) => $l['object']['label'] . ' × ' . $l['qty'], $c['links']))], $data['items']);
        $report = ['title' => 'Náklady na kroje', 'generatedAt' => gmdate('c'), 'notice' => 'Evidence nákladů; souhrny po měnách bez přepočtu.', 'sections' => [
            ['title' => 'Náklady a dobropisy', 'columns' => ['ID', 'Fond ID', 'Datum', 'Částka', 'Měna', 'Dodavatel', 'Doklad', 'Popis', 'Účel', 'Navázané součástky'], 'rows' => $rows],
            ['title' => 'Souhrny po měnách', 'columns' => ['Měna', 'Částka', 'Počet záznamů'], 'rows' => array_map(fn ($t) => [$t['currency'], $t['amount'], $t['count']], $data['totals'])],
        ]];
        return new Response(200, ['Content-Type' => 'text/csv; charset=utf-8', 'Content-Disposition' => 'attachment; filename="naklady.csv"', 'Cache-Control' => 'no-store'], ReportController::csv($report));
    }
    private function detail(Request $request, RequestContext $context): Response {
        $nested = $this->db()->inTransaction();
        $cost = Transaction::run($this->db(), function () use ($nested, $context): array { if (!$nested) $this->db()->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); return $this->accessible($context); });
        return Response::json($cost)->withHeader('Cache-Control', 'no-store');
    }
    private function accessible(RequestContext $context): array
    {
        $cost = $this->repo()->find(self::routeId($context)) ?? throw self::notFound(); if (!in_array($cost['unitId'], $this->units($context), true)) throw self::notFound(); return $cost;
    }
    private function create(Request $request, RequestContext $context): Response
    {
        $unit = $this->writeFund($context, self::routeId($context, 'unitId'));
        InventoryInput::only($request->json(), [...self::FIELDS, 'links']); $values = $this->values($request->json());
        return $this->writing(fn () => Response::json($this->audited($context, 'cost.create', $unit, function () use ($unit, $request, $values, $context): array {
            $links = $this->links($unit, array_key_exists('links', $request->json()) ? $request->json()['links'] : []); $id = $this->repo()->insert($unit, $values, self::actor($context)); $this->repo()->replaceLinks($unit, $id, $links); return $this->repo()->find($id);
        }), 201));
    }
    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context); $this->writeFund($context, $initial['unitId']);
        InventoryInput::only($request->json(), [...self::FIELDS, 'links', 'version']); $version = Input::fromRequest($request)->id('version');
        return $this->writing(fn () => Response::json($this->audited($context, 'cost.update', $initial['unitId'], function () use ($initial, $request, $version, $context): array {
            $current = $this->repo()->find($initial['id'], true); InventoryInput::version($current, $version);
            $values = $this->values($request->json(), $current);
            if (array_key_exists('links', $request->json())) $this->repo()->replaceLinks($current['unitId'], $current['id'], $this->links($current['unitId'], $request->json()['links']));
            $this->repo()->update($current['id'], $values, self::actor($context)); return $this->repo()->find($current['id']);
        })));
    }
    private function links(int $unit, mixed $entries): array
    {
        if (!is_array($entries) || !array_is_list($entries) || count($entries) > 200) throw Input::invalid('links', 'invalid');
        $links = []; $seen = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) throw Input::invalid('links', 'invalid'); InventoryInput::only($entry, ['kind', 'targetId', 'qty']); $input = new Input($entry);
            $kind = $input->enum('kind', ['item', 'bulk_stock', 'kit']); $id = $input->id('targetId'); $qty = InventoryInput::quantity($entry, 'qty', 1);
            if ($kind !== 'bulk_stock' && $qty !== 1 || isset($seen["$kind:$id"])) throw Input::invalid('links', 'invalid'); $seen["$kind:$id"] = true;
            $links[] = ['kind' => $kind, 'targetId' => $id, 'qty' => $qty];
        }
        usort($links, fn ($a, $b) => [$a['kind'], $a['targetId']] <=> [$b['kind'], $b['targetId']]);
        foreach ($links as $link) { $target = $this->repo()->object($link['kind'], $link['targetId'], true); if ($target === null || $target['unitId'] !== $unit) throw self::notFound(); }
        return $links;
    }
    private function values(array $body, ?array $old = null): array
    {
        $input = new Input($body); $value = fn ($field) => array_key_exists($field, $body) ? $body[$field] : ($old[$field] ?? null);
        $amount = $value('amount'); if (!is_string($amount) || !preg_match('/^-?(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/D', $amount)) throw Input::invalid('amount', 'invalid');
        $values = ['spentOn' => $this->date($value('spentOn'), 'spentOn'), 'amount' => $amount, 'currency' => $this->currency($value('currency')),
            'description' => $input->has('description') ? $input->text('description', 2000) : ($old['description'] ?? throw Input::invalid('description', 'required'))];
        foreach (['supplier' => 500, 'documentRef' => 500, 'purpose' => 1000] as $field => $max) $values[$field] = $input->has($field) ? $input->optionalString($field, $max) : ($old[$field] ?? null);
        return $values;
    }
    private function date(mixed $value, string $field): string { if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $p) || !checkdate((int) $p[2], (int) $p[3], (int) $p[1])) throw Input::invalid($field, 'invalid'); return $value; }
    private function currency(mixed $value): string { if (!is_string($value) || !preg_match('/^[A-Z]{3}$/D', $value)) throw Input::invalid('currency', 'invalid'); return $value; }
    private function writeFund(RequestContext $context, int $unit): int {
        if (!$this->mandates($context)->canManageFund($unit)) {
            if (!in_array($unit, $this->units($context), true)) throw self::notFound();
            throw new HttpException(403, 'forbidden', 'Cost evidence is read-only.');
        }
        return (new FundAccess($this->db()))->require($this->mandates($context), (string) $unit, true);
    }
    private function writing(callable $work): Response { try { return $work(); } catch (\PDOException $error) { if ($error->getCode() === '55P03') throw new HttpException(409, 'cost_busy', 'A linked object is changing. Retry.'); throw $error; } }
    private function repo(): CostRepository { return new CostRepository($this->db()); }
}
