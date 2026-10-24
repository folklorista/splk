<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Physical items and their own events; actual loan responsibility and independent physical state (docs/06 chap. 3). */
final class ItemRepository
{
    private const FIELDS = [
        'seriesId' => 'series_id', 'number' => 'number', 'variant' => 'variant', 'size' => 'size',
        'description' => 'description', 'note' => 'note', 'condition' => 'condition', 'issuable' => 'issuable',
        'location' => 'location', 'locationNote' => 'location_note', 'acquiredOn' => 'acquired_on',
    ];

    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_items WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : $this->item($row);
    }

    /** The series lock serializes number checks, including numbers of retired items. */
    public function lockSeries(int $unitId, int $id): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_series WHERE unit_id = :unit AND id = :id FOR UPDATE');
        $statement->execute(['unit' => $unitId, 'id' => $id]);
        return $statement->fetch() ?: null;
    }

    public function lockPartType(int $unitId, int $id): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_part_types WHERE unit_id = :unit AND id = :id FOR SHARE');
        $statement->execute(['unit' => $unitId, 'id' => $id]);
        return $statement->fetch() ?: null;
    }

    public function regionIsActive(int $unitId, ?int $id): bool
    {
        // Include the parent area and lock against concurrent catalog archival.
        while ($id !== null) {
            $statement = $this->db->prepare('SELECT parent_id, archived_at FROM costume_regions WHERE unit_id = :unit AND id = :id FOR SHARE');
            $statement->execute(['unit' => $unitId, 'id' => $id]);
            $region = $statement->fetch();
            if ($region === false || $region['archived_at'] !== null) {
                return false;
            }
            $id = $region['parent_id'] === null ? null : (int) $region['parent_id'];
        }
        return true;
    }

    public function numberExists(int $seriesId, string $number, bool $includeRetired, ?int $exceptId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM costume_items WHERE series_id = :series AND number = :number'
            . ($includeRetired ? '' : ' AND retired_at IS NULL') . ($exceptId === null ? '' : ' AND id <> :except'));
        $params = ['series' => $seriesId, 'number' => $number];
        if ($exceptId !== null) {
            $params['except'] = $exceptId;
        }
        $statement->execute($params);
        return $statement->fetchColumn() !== false;
    }

    public function insert(int $unitId, array $input, int $actor): int
    {
        $columns = implode(', ', self::FIELDS);
        $values = implode(', ', array_map(static fn (string $key): string => ':' . $key, array_keys(self::FIELDS)));
        $statement = $this->db->prepare("INSERT INTO costume_items (unit_id, created_by, $columns) VALUES (:unit, :actor, $values) RETURNING id");
        $statement->execute(['unit' => $unitId, 'actor' => $actor] + self::parameters($input));
        return (int) $statement->fetchColumn();
    }

    public function update(int $id, array $input): void
    {
        $assignments = [];
        foreach (self::FIELDS as $key => $column) {
            $assignments[] = "$column = :$key";
        }
        $this->db->prepare('UPDATE costume_items SET ' . implode(', ', $assignments) . ', version = version + 1 WHERE id = :id')
            ->execute(['id' => $id] + self::parameters($input));
    }

    public function retire(int $id, int $actor, string $reason): void
    {
        $this->db->prepare('UPDATE costume_items SET retired_at = now(), retired_by = :actor, retire_reason = :reason,
            version = version + 1 WHERE id = :id')->execute(['id' => $id, 'actor' => $actor, 'reason' => $reason]);
    }

    public function record(int $id, int $actor, string $event, array $data): void
    {
        $this->db->prepare('INSERT INTO costume_item_events (item_id, by, event, data) VALUES (:id, :actor, :event, CAST(:data AS jsonb))')
            ->execute(['id' => $id, 'actor' => $actor, 'event' => $event, 'data' => json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    public function history(int $id, int $limit, int $offset): array
    {
        $count = $this->db->prepare('SELECT count(*) FROM costume_item_events WHERE item_id = :id');
        $count->execute(['id' => $id]);
        $statement = $this->db->prepare("SELECT * FROM costume_item_events WHERE item_id = :id ORDER BY at DESC, id DESC LIMIT $limit OFFSET $offset");
        $statement->execute(['id' => $id]);
        $items = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'], 'itemId' => (int) $row['item_id'], 'at' => $row['at'],
            'by' => (int) $row['by'], 'event' => $row['event'], 'data' => json_decode($row['data'], true, flags: JSON_THROW_ON_ERROR),
        ], $statement->fetchAll());
        return ['items' => $items, 'total' => (int) $count->fetchColumn()];
    }

    /** Query values and sort expression have already been validated by the controller. */
    public function list(int $unitId, array $filters, int $limit, int $offset, string $sort): array
    {
        $where = ['i.unit_id = :unit', $filters['retired'] ? 'i.retired_at IS NOT NULL' : 'i.retired_at IS NULL'];
        $params = ['unit' => $unitId];
        foreach (['series' => 'i.series_id', 'condition' => 'i.condition', 'location' => 'i.location'] as $key => $column) {
            if (isset($filters[$key])) {
                $where[] = "$column = :$key";
                $params[$key] = $filters[$key];
            }
        }
        foreach (['acquiredFrom' => '>=', 'acquiredTo' => '<='] as $key => $operator) {
            if (isset($filters[$key])) {
                $where[] = "i.acquired_on $operator :$key";
                $params[$key] = $filters[$key];
            }
        }
        if (isset($filters['q'])) {
            $where[] = "unaccent(lower(concat_ws(' ', s.name, i.number, i.variant, i.description, i.note))) LIKE unaccent(lower(:q)) ESCAPE '!'";
            $params['q'] = '%' . strtr($filters['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
        }
        $open = 'EXISTS (SELECT 1 FROM costume_loan_lines ll WHERE ll.item_id = i.id AND ll.closed_at IS NULL)';
        if (isset($filters['available'])) {
            $where[] = ($filters['available'] ? '' : 'NOT ') . "(i.issuable AND i.retired_at IS NULL AND NOT $open)";
        }
        if (isset($filters['holder'])) {
            $where[] = 'EXISTS (SELECT 1 FROM costume_loan_lines ll JOIN costume_loans l ON l.id = ll.loan_id WHERE ll.item_id = i.id AND ll.closed_at IS NULL AND l.holder_person_id = :holder)';
            $params['holder'] = $filters['holder'];
        }
        $from = ' FROM costume_items i JOIN costume_series s ON s.id = i.series_id WHERE ' . implode(' AND ', $where);
        $count = $this->db->prepare('SELECT count(*)' . $from);
        $count->execute($params);
        $statement = $this->db->prepare('SELECT i.*' . $from . " ORDER BY $sort, i.id ASC LIMIT $limit OFFSET $offset");
        $statement->execute($params);
        return ['items' => array_map($this->item(...), $statement->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    private static function parameters(array $input): array
    {
        $params = array_intersect_key($input, self::FIELDS);
        $params['issuable'] = $params['issuable'] ? 'true' : 'false';
        return $params;
    }

    private function item(array $row): array
    {
        $result = [];
        foreach (self::FIELDS as $key => $column) {
            $result[$key] = $row[$column];
        }
        $result['seriesId'] = (int) $row['series_id'];
        $result['issuable'] = (bool) $row['issuable'];
        $loan = (new LoanRepository($this->db))->openItem((int) $row['id']);
        return $result + [
            'available' => (bool) $row['issuable'] && $row['retired_at'] === null && $loan === null,
            'holder' => $loan['holder'] ?? null, 'loanId' => $loan['loanId'] ?? null, 'loanKitId' => $loan['kitId'] ?? null,
            'id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'],
            'kitId' => $row['kit_id'] === null ? null : (int) $row['kit_id'],
            'retiredAt' => $row['retired_at'], 'retiredBy' => $row['retired_by'] === null ? null : (int) $row['retired_by'],
            'retireReason' => $row['retire_reason'], 'version' => (int) $row['version'],
        ];
    }
}
