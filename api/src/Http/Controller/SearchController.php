<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Http\{HttpException, Input, InventoryInput, Request, RequestContext, Response, Router};

/** Shared identity names are searchable; physical results stay inside authorized funds (D-21). */
final class SearchController extends Controller
{
    public function register(Router $router): void { $router->add('GET', '/v1/search', $this->search(...)); }
    private function search(Request $request, RequestContext $context): Response
    {
        InventoryInput::only($request->query, ['q', 'fund', 'limit', 'offset']); [$limit, $offset] = InventoryInput::pagination($request->query);
        $text = (new Input($request->query))->text('q', 200); $mandates = $this->mandates($context);
        $funds = array_values(array_filter($this->db()->query('SELECT id FROM units WHERE has_costume_fund AND archived_at IS NULL')->fetchAll(\PDO::FETCH_COLUMN), fn ($id) => $mandates->canViewFund((int) $id)));
        if ($funds === []) throw new HttpException(403, 'forbidden', 'A costume mandate is required.');
        if (isset($request->query['fund'])) { $id = InventoryInput::queryInteger($request->query['fund'], 'fund'); if (!in_array($id, array_map(intval(...), $funds), true)) throw self::notFound(); $funds = [$id]; }
        $ids = implode(',', array_map(intval(...), $funds)); $where = []; $params = [];
        foreach (preg_split('/\s+/u', $text) as $index => $token) { $where[] = "unaccent(lower(label)) LIKE unaccent(lower(:q$index)) ESCAPE '!'"; $params["q$index"] = '%' . strtr($token, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%'; }
        $from = "FROM (
            SELECT 'person'::text AS kind, id, NULL::bigint AS unit_id, concat_ws(' ', first_name, last_name, nickname) AS label, false AS retired FROM persons
            UNION ALL SELECT 'item', i.id, i.unit_id, concat_ws(' ', s.name, i.number), i.retired_at IS NOT NULL FROM costume_items i JOIN costume_series s ON s.id = i.series_id WHERE i.unit_id IN ($ids)
            UNION ALL SELECT 'kit', k.id, k.unit_id, concat_ws(' ', s.name, k.number), k.retired_at IS NOT NULL FROM costume_kits k JOIN costume_series s ON s.id = k.series_id WHERE k.unit_id IN ($ids)
            ) results WHERE " . implode(' AND ', $where);
        $count = $this->db()->prepare('SELECT count(*) ' . $from); $count->execute($params);
        $query = $this->db()->prepare("SELECT * $from ORDER BY kind, label, id, unit_id LIMIT $limit OFFSET $offset"); $query->execute($params);
        $items = array_map(static fn ($r) => ['kind' => $r['kind'], 'id' => (int) $r['id'], 'unitId' => $r['unit_id'] === null ? null : (int) $r['unit_id'], 'label' => $r['label'], 'retired' => (bool) $r['retired']], $query->fetchAll());
        return Response::json(['items' => $items, 'total' => (int) $count->fetchColumn()])->withHeader('Cache-Control', 'no-store');
    }
}
