<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Exact amounts belong to the cost header, never multiplied by the number of physical links. */
final class CostRepository
{
    public function __construct(private readonly PDO $db) {}
    public function find(int $id, bool $lock = false): ?array
    {
        $query = $this->db->prepare('SELECT * FROM costume_costs WHERE id = :id' . ($lock ? ' FOR UPDATE' : '')); $query->execute(['id' => $id]); $row = $query->fetch();
        return $row === false ? null : $this->dto($row);
    }
    public function list(array $units, array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->where($units, $filters);
        $count = $this->db->prepare('SELECT count(*) FROM costume_costs WHERE ' . $where); $count->execute($params);
        $query = $this->db->prepare("SELECT * FROM costume_costs WHERE $where ORDER BY spent_on DESC, id DESC LIMIT $limit OFFSET $offset"); $query->execute($params);
        $totals = $this->db->prepare("SELECT currency, sum(amount)::text AS amount, count(*) AS count FROM costume_costs WHERE $where GROUP BY currency ORDER BY currency"); $totals->execute($params);
        return ['items' => array_map($this->dto(...), $query->fetchAll()), 'total' => (int) $count->fetchColumn(), 'totals' => array_map(static fn ($r) => ['currency' => $r['currency'], 'amount' => $r['amount'], 'count' => (int) $r['count']], $totals->fetchAll())];
    }
    public function insert(int $unit, array $values, int $actor): int
    {
        $query = $this->db->prepare('INSERT INTO costume_costs (unit_id, spent_on, amount, currency, supplier, document_ref, description, purpose, created_by, updated_by)
            VALUES (:unit, :spentOn, :amount, :currency, :supplier, :documentRef, :description, :purpose, :actor, :actor) RETURNING id');
        $query->execute(['unit' => $unit, 'actor' => $actor] + $values); return (int) $query->fetchColumn();
    }
    public function update(int $id, array $values, int $actor): void
    {
        $this->db->prepare('UPDATE costume_costs SET spent_on = :spentOn, amount = :amount, currency = :currency, supplier = :supplier, document_ref = :documentRef,
            description = :description, purpose = :purpose, updated_at = clock_timestamp(), updated_by = :actor, version = version + 1 WHERE id = :id')->execute($values + ['id' => $id, 'actor' => $actor]);
    }
    public function replaceLinks(int $unit, int $id, array $links): void
    {
        $this->db->prepare('DELETE FROM costume_cost_links WHERE cost_id = :id')->execute(['id' => $id]);
        $query = $this->db->prepare('INSERT INTO costume_cost_links (unit_id, cost_id, item_id, bulk_stock_id, kit_id, qty) VALUES (:unit, :cost, :item, :stock, :kit, :qty)');
        foreach ($links as $link) $query->execute(['unit' => $unit, 'cost' => $id, 'item' => $link['kind'] === 'item' ? $link['targetId'] : null,
            'stock' => $link['kind'] === 'bulk_stock' ? $link['targetId'] : null, 'kit' => $link['kind'] === 'kit' ? $link['targetId'] : null, 'qty' => $link['qty']]);
    }
    public function object(string $kind, int $id, bool $lock = false): ?array
    {
        $table = ['item' => 'costume_items', 'bulk_stock' => 'costume_bulk_stocks', 'kit' => 'costume_kits'][$kind];
        $query = $this->db->prepare("SELECT * FROM $table WHERE id = :id" . ($lock ? ' FOR KEY SHARE NOWAIT' : '')); $query->execute(['id' => $id]); $row = $query->fetch();
        if ($row === false) return null;
        $named = $kind === 'bulk_stock' ? ['costume_part_types', $row['part_type_id']] : ['costume_series', $row['series_id']];
        $query = $this->db->prepare('SELECT name FROM ' . $named[0] . ' WHERE id = :id'); $query->execute(['id' => $named[1]]); $name = $query->fetchColumn();
        $result = ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'label' => trim($name . ' ' . ($row['number'] ?? $row['variant'] ?? '(bez čísla)')),
            'number' => $row['number'] ?? null, 'description' => $row['description'] ?? null, 'variant' => $row['variant'] ?? null];
        if ($kind === 'item') $result += ['condition' => $row['condition'], 'size' => $row['size'], 'acquiredOn' => $row['acquired_on'], 'retiredAt' => $row['retired_at']];
        if ($kind === 'kit') $result += ['compositionState' => $row['composition_state'], 'retiredAt' => $row['retired_at']];
        if ($kind === 'bulk_stock') $result += ['quantityTotal' => (int) $row['quantity_total']];
        return $result;
    }
    private function dto(array $row): array
    {
        $query = $this->db->prepare('SELECT * FROM costume_cost_links WHERE cost_id = :id ORDER BY id'); $query->execute(['id' => $row['id']]);
        $links = array_map(function ($link): array {
            $kind = $link['item_id'] !== null ? 'item' : ($link['bulk_stock_id'] !== null ? 'bulk_stock' : 'kit'); $target = (int) ($link['item_id'] ?? $link['bulk_stock_id'] ?? $link['kit_id']);
            $object = $this->object($kind, $target); unset($object['unitId']);
            return ['id' => (int) $link['id'], 'kind' => $kind, 'targetId' => $target, 'qty' => (int) $link['qty'], 'object' => $object];
        }, $query->fetchAll());
        return ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'spentOn' => $row['spent_on'], 'amount' => $row['amount'], 'currency' => $row['currency'],
            'supplier' => $row['supplier'], 'documentRef' => $row['document_ref'], 'description' => $row['description'], 'purpose' => $row['purpose'], 'links' => $links,
            'createdAt' => $row['created_at'], 'createdBy' => (int) $row['created_by'], 'updatedAt' => $row['updated_at'], 'updatedBy' => (int) $row['updated_by'], 'version' => (int) $row['version']];
    }
    private function where(array $units, array $filters): array
    {
        $where = ['unit_id IN (' . ($units === [] ? 'NULL' : implode(',', array_map(intval(...), $units))) . ')']; $params = [];
        foreach (['from' => 'spent_on >=', 'to' => 'spent_on <=', 'currency' => 'currency ='] as $key => $expression) if (isset($filters[$key])) { $where[] = "$expression :$key"; $params[$key] = $filters[$key]; }
        if (isset($filters['q'])) { $where[] = "unaccent(lower(concat_ws(' ', supplier, document_ref, description, purpose))) LIKE unaccent(lower(:q)) ESCAPE '!'"; $params['q'] = '%' . strtr($filters['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%'; }
        return [implode(' AND ', $where), $params];
    }
}
