<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Counted stock; allocations are recorded quantities, not a physical check (docs/06 chap. 3.4). */
final class BulkStockRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_bulk_stocks WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : $this->stock($row);
    }

    public function list(int $unitId, int $limit, int $offset): array
    {
        $statement = $this->db->prepare("SELECT * FROM costume_bulk_stocks WHERE unit_id = :unit ORDER BY part_type_id, variant NULLS FIRST, id LIMIT $limit OFFSET $offset");
        $statement->execute(['unit' => $unitId]);
        $count = $this->db->prepare('SELECT count(*) FROM costume_bulk_stocks WHERE unit_id = :unit');
        $count->execute(['unit' => $unitId]);
        return ['items' => array_map($this->stock(...), $statement->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    public function insert(int $unitId, array $input, int $actor): int
    {
        $statement = $this->db->prepare('INSERT INTO costume_bulk_stocks (unit_id, part_type_id, variant, quantity_total, note, created_by)
            VALUES (:unit, :type, :variant, :quantity, :note, :actor) RETURNING id');
        $statement->execute(['unit' => $unitId, 'type' => $input['partTypeId'], 'variant' => $input['variant'],
            'quantity' => $input['quantityTotal'], 'note' => $input['note'], 'actor' => $actor]);
        return (int) $statement->fetchColumn();
    }

    public function update(int $id, array $input): void
    {
        $this->db->prepare('UPDATE costume_bulk_stocks SET variant = :variant, quantity_total = :quantity, note = :note WHERE id = :id')
            ->execute(['id' => $id, 'variant' => $input['variant'], 'quantity' => $input['quantityTotal'], 'note' => $input['note']]);
    }

    private function stock(array $row): array
    {
        $statement = $this->db->prepare('SELECT coalesce(sum(present_qty), 0) FROM costume_kit_bulk_lines WHERE bulk_stock_id = :id');
        $statement->execute(['id' => $row['id']]);
        $inKits = (int) $statement->fetchColumn();
        $reserved = $this->db->prepare('SELECT costume_bulk_reserved(:id)');
        $reserved->execute(['id' => $row['id']]);
        $quantityReserved = (int) $reserved->fetchColumn();
        return ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'partTypeId' => (int) $row['part_type_id'],
            'variant' => $row['variant'], 'quantityTotal' => (int) $row['quantity_total'], 'note' => $row['note'],
            'quantityInKits' => $inKits, 'quantityReserved' => $quantityReserved, 'quantityAvailable' => (int) $row['quantity_total'] - $quantityReserved];
    }
}
