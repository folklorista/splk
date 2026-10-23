<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Intended composition, recorded quantities and composition history (docs/06 chap. 4). */
final class KitRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_kits WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : self::kit($row);
    }

    public function detail(int $id): ?array
    {
        $kit = $this->find($id);
        if ($kit === null) {
            return null;
        }
        $items = $this->db->prepare('SELECT id FROM costume_items WHERE kit_id = :id ORDER BY series_id, number, id');
        $items->execute(['id' => $id]);
        $repository = new ItemRepository($this->db);
        $kit['items'] = array_map(static fn (array $row): array => $repository->find((int) $row['id']), $items->fetchAll());
        $lines = $this->db->prepare('SELECT * FROM costume_kit_bulk_lines WHERE kit_id = :id ORDER BY bulk_stock_id');
        $lines->execute(['id' => $id]);
        $kit['bulkLines'] = array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'bulkStockId' => (int) $row['bulk_stock_id'],
            'requiredQty' => (int) $row['required_qty'], 'presentQty' => (int) $row['present_qty']], $lines->fetchAll());
        $history = $this->db->prepare('SELECT * FROM costume_kit_changes WHERE kit_id = :id ORDER BY at DESC, id DESC');
        $history->execute(['id' => $id]);
        $kit['changes'] = array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'kitId' => (int) $row['kit_id'],
            'itemId' => $row['item_id'] === null ? null : (int) $row['item_id'], 'bulkStockId' => $row['bulk_stock_id'] === null ? null : (int) $row['bulk_stock_id'],
            'change' => $row['change'], 'qty' => (int) $row['qty'], 'at' => $row['at'], 'by' => (int) $row['by'], 'note' => $row['note']], $history->fetchAll());
        return $kit;
    }

    public function list(int $unitId, int $limit, int $offset, ?int $seriesId, ?string $query): array
    {
        $where = 'k.unit_id = :unit AND k.retired_at IS NULL';
        $params = ['unit' => $unitId];
        if ($seriesId !== null) {
            $where .= ' AND k.series_id = :series';
            $params['series'] = $seriesId;
        }
        if ($query !== null) {
            $where .= " AND unaccent(lower(concat_ws(' ', s.name, k.number, k.description, k.note))) LIKE unaccent(lower(:q)) ESCAPE '!'";
            $params['q'] = '%' . strtr($query, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
        }
        $from = " FROM costume_kits k JOIN costume_series s ON s.id = k.series_id WHERE $where";
        $count = $this->db->prepare('SELECT count(*)' . $from);
        $count->execute($params);
        $list = $this->db->prepare('SELECT k.*' . $from . " ORDER BY s.name, k.number NULLS LAST, k.id LIMIT $limit OFFSET $offset");
        $list->execute($params);
        return ['items' => array_map(self::kit(...), $list->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    public function insert(int $unitId, array $input, int $actor): int
    {
        $statement = $this->db->prepare('INSERT INTO costume_kits (unit_id, series_id, number, description, note, composition_state, created_by)
            VALUES (:unit, :seriesId, :number, :description, :note, :compositionState, :actor) RETURNING id');
        $statement->execute(['unit' => $unitId, 'actor' => $actor] + $input);
        return (int) $statement->fetchColumn();
    }

    public function update(int $id, array $input): void
    {
        $this->db->prepare('UPDATE costume_kits SET series_id = :seriesId, number = :number, description = :description,
            note = :note, composition_state = :compositionState, version = version + 1 WHERE id = :id')->execute(['id' => $id] + $input);
    }

    public function numberExists(int $seriesId, string $number, bool $includeRetired, ?int $except): bool
    {
        $sql = 'SELECT 1 FROM costume_kits WHERE series_id = :series AND number = :number'
            . ($includeRetired ? '' : ' AND retired_at IS NULL') . ($except === null ? '' : ' AND id <> :except');
        $params = ['series' => $seriesId, 'number' => $number];
        if ($except !== null) {
            $params['except'] = $except;
        }
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        return $statement->fetchColumn() !== false;
    }

    public function itemMembership(int $itemId, ?int $kitId): void
    {
        $this->db->prepare('UPDATE costume_items SET kit_id = :kit, version = version + 1 WHERE id = :id')->execute(['id' => $itemId, 'kit' => $kitId]);
    }

    public function bulkLine(int $kitId, int $stockId): ?array
    {
        $statement = $this->db->prepare('SELECT required_qty, present_qty FROM costume_kit_bulk_lines WHERE kit_id = :kit AND bulk_stock_id = :stock');
        $statement->execute(['kit' => $kitId, 'stock' => $stockId]);
        $row = $statement->fetch();
        return $row === false ? null : ['requiredQty' => (int) $row['required_qty'], 'presentQty' => (int) $row['present_qty']];
    }

    public function setBulkLine(int $unitId, int $kitId, int $stockId, int $required, int $present): void
    {
        if ($required === 0) {
            $this->db->prepare('DELETE FROM costume_kit_bulk_lines WHERE kit_id = :kit AND bulk_stock_id = :stock')->execute(['kit' => $kitId, 'stock' => $stockId]);
            return;
        }
        $this->db->prepare('INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty)
            VALUES (:unit, :kit, :stock, :required, :present) ON CONFLICT (kit_id, bulk_stock_id)
            DO UPDATE SET required_qty = EXCLUDED.required_qty, present_qty = EXCLUDED.present_qty')
            ->execute(['unit' => $unitId, 'kit' => $kitId, 'stock' => $stockId, 'required' => $required, 'present' => $present]);
    }

    public function touchComposition(int $id): void
    {
        $this->db->prepare("UPDATE costume_kits SET version = version + 1, composition_state = CASE WHEN composition_state = 'unverified' THEN 'unverified' ELSE 'pending_check' END WHERE id = :id")
            ->execute(['id' => $id]);
    }

    public function record(int $unitId, int $kitId, ?int $itemId, ?int $stockId, string $change, int $qty, int $actor, ?string $note): void
    {
        $this->db->prepare('INSERT INTO costume_kit_changes (unit_id, kit_id, item_id, bulk_stock_id, change, qty, by, note)
            VALUES (:unit, :kit, :item, :stock, :change, :qty, :actor, :note)')
            ->execute(['unit' => $unitId, 'kit' => $kitId, 'item' => $itemId, 'stock' => $stockId, 'change' => $change, 'qty' => $qty, 'actor' => $actor, 'note' => $note]);
    }

    private static function kit(array $row): array
    {
        return ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'seriesId' => (int) $row['series_id'], 'number' => $row['number'],
            'description' => $row['description'], 'note' => $row['note'], 'compositionState' => $row['composition_state'],
            'retiredAt' => $row['retired_at'], 'version' => (int) $row['version']];
    }
}
