<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Exact handover snapshots and append-only partial-return history (docs/06 chap. 5). */
final class LoanRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $query = $this->db->prepare('SELECT * FROM costume_loans WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $query->execute(['id' => $id]);
        $row = $query->fetch();
        if ($row === false) {
            return null;
        }
        $lines = $this->db->prepare("SELECT ll.*, CASE WHEN ll.item_id IS NOT NULL THEN concat_ws(' ', s.name, coalesce(i.number, '(bez čísla)')) ELSE concat_ws(' ', t.name, b.variant) END AS label, nullif(concat_ws(' · ', parent.name, r.name), '') AS region, coalesce(s.gender, t.gender) AS gender
            FROM costume_loan_lines ll LEFT JOIN costume_items i ON i.id = ll.item_id LEFT JOIN costume_series s ON s.id = i.series_id
            LEFT JOIN costume_bulk_stocks b ON b.id = ll.bulk_stock_id LEFT JOIN costume_part_types t ON t.id = coalesce(b.part_type_id, s.part_type_id)
            LEFT JOIN costume_regions r ON r.id = coalesce(s.region_id, t.region_id) LEFT JOIN costume_regions parent ON parent.id = r.parent_id
            WHERE ll.loan_id = :id ORDER BY ll.id");
        $lines->execute(['id' => $id]);
        $returns = $this->db->prepare("SELECT r.*, CASE WHEN r.close_type = 'settled' THEN l.qty - l.returned_qty ELSE 0 END AS lost_qty FROM costume_loan_returns r JOIN costume_loan_lines l ON l.id = r.line_id WHERE l.loan_id = :id ORDER BY r.at, r.id");
        $returns->execute(['id' => $id]);
        return ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'holder' => self::holder($row),
            'kitId' => self::nullableInt($row['kit_id']), 'issuedAt' => $row['issued_at'], 'issuedBy' => (int) $row['issued_by'],
            'dueAt' => $row['due_at'], 'note' => $row['note'], 'replacesLoanId' => self::nullableInt($row['replaces_loan_id']),
            'lines' => array_map(static fn (array $line): array => [
                'id' => (int) $line['id'], 'label' => $line['label'], 'region' => $line['region'], 'gender' => $line['gender'], 'itemId' => self::nullableInt($line['item_id']), 'bulkStockId' => self::nullableInt($line['bulk_stock_id']),
                'qty' => (int) $line['qty'], 'returnedQty' => (int) $line['returned_qty'], 'closedAt' => $line['closed_at'],
                'closedBy' => self::nullableInt($line['closed_by']), 'closeType' => $line['close_type'], 'closeNote' => $line['close_note'], 'inventoryId' => self::nullableInt($line['inventory_id']),
            ], $lines->fetchAll()),
            'returns' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'lineId' => (int) $r['line_id'],
                'qty' => (int) $r['qty'], 'lostQty' => (int) $r['lost_qty'], 'closeType' => $r['close_type'], 'note' => $r['note'], 'at' => $r['at'], 'by' => (int) $r['by'], 'inventoryId' => self::nullableInt($r['inventory_id'])], $returns->fetchAll())];
    }

    public function openItem(int $id): ?array
    {
        $query = $this->db->prepare('SELECT l.*, ll.id AS line_id FROM costume_loans l JOIN costume_loan_lines ll ON ll.loan_id = l.id WHERE ll.item_id = :id AND ll.closed_at IS NULL');
        $query->execute(['id' => $id]);
        $row = $query->fetch();
        return $row === false ? null : ['loanId' => (int) $row['id'], 'lineId' => (int) $row['line_id'], 'kitId' => self::nullableInt($row['kit_id']), 'holder' => self::holder($row)];
    }

    public function openKit(int $id): bool
    {
        return $this->currentKitLoan($id) !== null;
    }

    public function currentKitLoan(int $id): ?array
    {
        $query = $this->db->prepare('SELECT l.* FROM costume_loans l WHERE l.kit_id = :id AND EXISTS (SELECT 1 FROM costume_loan_lines ll WHERE ll.loan_id = l.id AND ll.closed_at IS NULL) ORDER BY l.id DESC LIMIT 1');
        $query->execute(['id' => $id]);
        $row = $query->fetch();
        return $row === false ? null : ['loanId' => (int) $row['id'], 'holder' => self::holder($row)];
    }

    public function insert(int $unit, array $holder, ?int $kit, ?string $due, ?string $note, int $actor, ?int $replaces = null): int
    {
        $query = $this->db->prepare('INSERT INTO costume_loans (unit_id, holder_person_id, holder_unit_id, kit_id, due_at, note, issued_by, replaces_loan_id)
            VALUES (:unit, :person, :holderUnit, :kit, :due, :note, :actor, :replaces) RETURNING id');
        $query->execute(['unit' => $unit, 'person' => $holder['personId'] ?? null, 'holderUnit' => $holder['unitId'] ?? null,
            'kit' => $kit, 'due' => $due, 'note' => $note, 'actor' => $actor, 'replaces' => $replaces]);
        return (int) $query->fetchColumn();
    }

    public function addLine(int $unit, int $loan, ?int $item, ?int $stock, int $qty, ?int $inventory = null): void
    {
        $this->db->prepare('INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, bulk_stock_id, qty, inventory_id) VALUES (:unit, :loan, :item, :stock, :qty, :inventory)')
            ->execute(['unit' => $unit, 'loan' => $loan, 'item' => $item, 'stock' => $stock, 'qty' => $qty, 'inventory' => $inventory]);
    }

    public function returnLine(int $unit, array $line, int $qty, string $type, ?string $note, int $actor, ?int $inventory = null): void
    {
        $closed = $line['returnedQty'] + $qty === $line['qty'] || $type === 'settled';
        $query = $this->db->prepare('UPDATE costume_loan_lines SET returned_qty = returned_qty + :qty'
            . ($closed ? ', closed_at = now(), closed_by = :actor, close_type = :type, close_note = :note' : '') . ' WHERE id = :id');
        $query->execute(['qty' => $qty, 'id' => $line['id']] + ($closed ? ['actor' => $actor, 'type' => $type, 'note' => $note] : []));
        $this->db->prepare('INSERT INTO costume_loan_returns (unit_id, line_id, qty, close_type, note, by, inventory_id) VALUES (:unit, :line, :qty, :type, :note, :actor, :inventory)')
            ->execute(['unit' => $unit, 'line' => $line['id'], 'qty' => $qty, 'type' => $type, 'note' => $note, 'actor' => $actor, 'inventory' => $inventory]);
    }

    public function update(int $id, ?string $due, ?string $note): void
    {
        $this->db->prepare('UPDATE costume_loans SET due_at = :due, note = :note WHERE id = :id')->execute(['id' => $id, 'due' => $due, 'note' => $note]);
    }

    public function list(int $unit, array $filters, int $limit, int $offset): array
    {
        $where = ['l.unit_id = :unit'];
        $params = ['unit' => $unit];
        $open = 'EXISTS (SELECT 1 FROM costume_loan_lines ll WHERE ll.loan_id = l.id AND ll.closed_at IS NULL)';
        if (isset($filters['open'])) {
            $where[] = ($filters['open'] ? '' : 'NOT ') . $open;
        }
        if (isset($filters['overdue'])) {
            $where[] = ($filters['overdue'] ? '' : 'NOT ') . "($open AND l.due_at IS NOT NULL AND l.due_at < now())";
        }
        if (isset($filters['kit'])) {
            $where[] = 'l.kit_id = :kit';
            $params['kit'] = $filters['kit'];
        }
        if (isset($filters['person'])) {
            $where[] = 'l.holder_person_id = :person';
            $params['person'] = $filters['person'];
        }
        if (isset($filters['holderType'])) {
            $where[] = "l.holder_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM unit_affiliations a WHERE a.person_id = l.holder_person_id AND a.status = 'active' AND a.valid_from <= current_date AND (a.valid_to IS NULL OR a.valid_to >= current_date))";
        }
        $sql = 'FROM costume_loans l WHERE ' . implode(' AND ', $where);
        $count = $this->db->prepare('SELECT count(*) ' . $sql);
        $count->execute($params);
        $query = $this->db->prepare("SELECT l.id $sql ORDER BY l.issued_at DESC, l.id DESC LIMIT $limit OFFSET $offset");
        $query->execute($params);
        return ['items' => array_map(fn ($id): array => $this->find((int) $id), $query->fetchAll(PDO::FETCH_COLUMN)), 'total' => (int) $count->fetchColumn()];
    }

    public function movements(int $unit, array $filters, int $limit, int $offset): array
    {
        $where = ['l.unit_id = :unit'];
        $params = ['unit' => $unit];
        foreach (['person' => 'l.holder_person_id', 'item' => 'll.item_id', 'kit' => 'l.kit_id', 'inventoryId' => 'm.inventory_id', 'from' => 'm.at', 'to' => 'm.at'] as $field => $column) {
            if (isset($filters[$field])) {
                $where[] = $column . match ($field) { 'from' => ' >= ', 'to' => ' <= ', default => ' = ' } . ':' . $field;
                $params[$field] = $filters[$field];
            }
        }
        $sql = "FROM (
            SELECT ll.id, ll.id AS line_id, 'issued'::text AS type, l.issued_at AS at, l.issued_by AS by, ll.qty, l.note, ll.inventory_id
                FROM costume_loan_lines ll JOIN costume_loans l ON l.id = ll.loan_id
            UNION ALL
            SELECT r.id, r.line_id, r.close_type, r.at, r.by, r.qty, r.note, r.inventory_id FROM costume_loan_returns r
            ) m JOIN costume_loan_lines ll ON ll.id = m.line_id JOIN costume_loans l ON l.id = ll.loan_id
            WHERE " . implode(' AND ', $where);
        $count = $this->db->prepare('SELECT count(*) ' . $sql);
        $count->execute($params);
        $query = $this->db->prepare("SELECT m.*, CASE WHEN m.type = 'settled' THEN ll.qty - ll.returned_qty ELSE 0 END AS lost_qty, l.id AS loan_id, l.holder_person_id, l.holder_unit_id, l.kit_id, ll.item_id, ll.bulk_stock_id $sql
            ORDER BY m.at DESC, m.id DESC, m.type LIMIT $limit OFFSET $offset");
        $query->execute($params);
        return ['items' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'loanId' => (int) $r['loan_id'], 'lineId' => (int) $r['line_id'],
            'lostQty' => (int) $r['lost_qty'], 'type' => $r['type'], 'at' => $r['at'], 'by' => (int) $r['by'], 'qty' => (int) $r['qty'], 'note' => $r['note'],
            'holder' => self::holder($r), 'kitId' => self::nullableInt($r['kit_id']), 'itemId' => self::nullableInt($r['item_id']),
            'bulkStockId' => self::nullableInt($r['bulk_stock_id']), 'inventoryId' => self::nullableInt($r['inventory_id'])], $query->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    private static function holder(array $row): array
    {
        return $row['holder_person_id'] !== null ? ['personId' => (int) $row['holder_person_id']] : ['unitId' => (int) $row['holder_unit_id']];
    }

    private static function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }
}
