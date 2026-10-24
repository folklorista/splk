<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\Input;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\InventoryInput;

/** Builds a single consistent scope snapshot, including disjoint bulk contexts (D-61). */
final class InventoryScope
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function validate(mixed $scope, int $unit): array
    {
        if (!is_array($scope) || ($scope !== [] && array_is_list($scope))) throw Input::invalid('scope', 'invalid');
        InventoryInput::only($scope, ['regionId', 'gender', 'partTypeId', 'variant', 'seriesId', 'groupId', 'affiliationUnitId']);
        $input = new Input($scope); $result = [];
        foreach (['regionId' => 'costume_regions', 'partTypeId' => 'costume_part_types', 'seriesId' => 'costume_series', 'groupId' => 'groups', 'affiliationUnitId' => 'units'] as $field => $table) {
            if (!$input->has($field)) continue;
            $id = $input->id($field);
            $query = $this->db->prepare("SELECT id FROM $table WHERE id = :id" . (in_array($field, ['regionId', 'partTypeId', 'seriesId'], true) ? ' AND unit_id = :unit' : '') . (in_array($field, ['groupId', 'affiliationUnitId'], true) ? ' AND archived_at IS NULL' : ''));
            $query->execute(['id' => $id] + (in_array($field, ['regionId', 'partTypeId', 'seriesId'], true) ? ['unit' => $unit] : []));
            if ($query->fetchColumn() === false) throw Input::invalid($field, 'invalid');
            $result[$field] = $id;
        }
        if ($input->has('gender')) $result['gender'] = $input->enum('gender', ['male', 'female']);
        if ($input->has('variant')) $result['variant'] = $input->text('variant', 100);
        return $result;
    }

    public function freeze(int $unit, array $scope): array
    {
        // Short shared locks prevent a handover/composition/catalog change halfway through the snapshot.
        try {
            $this->db->exec('LOCK TABLE costume_items, costume_kits, costume_bulk_stocks, costume_kit_bulk_lines,
                costume_loans, costume_loan_lines, costume_series, costume_part_types, costume_regions,
                groups, group_memberships, unit_affiliations IN SHARE MODE NOWAIT');
        } catch (\PDOException $e) {
            // Never wait holding only part of this lock set: ordinary handovers use row locks.
            if ($e->getCode() === '55P03') throw new HttpException(409, 'inventory_busy', 'Property is changing. Retry the inventory operation.');
            throw $e;
        }
        $items = $this->rows("SELECT i.*, s.name AS series_name, s.part_type_id, coalesce(s.region_id, t.region_id) AS effective_region_id,
            coalesce(s.gender, t.gender) AS gender, coalesce(i.variant, s.variant) AS effective_variant,
            r.name AS region_name, r.parent_id AS region_parent_id, ll.id AS loan_line_id, l.id AS loan_id, l.holder_person_id, l.holder_unit_id
            FROM costume_items i JOIN costume_series s ON s.id = i.series_id JOIN costume_part_types t ON t.id = s.part_type_id
            LEFT JOIN costume_regions r ON r.id = coalesce(s.region_id, t.region_id)
            LEFT JOIN costume_loan_lines ll ON ll.item_id = i.id AND ll.closed_at IS NULL LEFT JOIN costume_loans l ON l.id = ll.loan_id
            WHERE i.unit_id = :unit AND i.retired_at IS NULL ORDER BY i.id", $unit);
        $kits = $this->rows("SELECT k.*, s.name AS series_name, NULL::bigint AS part_type_id, s.region_id AS effective_region_id, s.gender, s.variant AS effective_variant,
            r.name AS region_name, r.parent_id AS region_parent_id, l.holder_person_id, l.holder_unit_id, l.id AS loan_id
            FROM costume_kits k JOIN costume_series s ON s.id = k.series_id LEFT JOIN costume_regions r ON r.id = s.region_id
            LEFT JOIN LATERAL (SELECT cl.* FROM costume_loans cl WHERE cl.kit_id = k.id AND EXISTS (SELECT 1 FROM costume_loan_lines ll WHERE ll.loan_id = cl.id AND ll.closed_at IS NULL) ORDER BY cl.id DESC LIMIT 1) l ON true
            WHERE k.unit_id = :unit ORDER BY k.id", $unit);
        $stocks = $this->rows("SELECT b.*, t.name AS type_name, t.region_id AS effective_region_id, t.gender, b.variant AS effective_variant,
            NULL::bigint AS series_id, r.name AS region_name, r.parent_id AS region_parent_id
            FROM costume_bulk_stocks b JOIN costume_part_types t ON t.id = b.part_type_id LEFT JOIN costume_regions r ON r.id = t.region_id WHERE b.unit_id = :unit ORDER BY b.id", $unit);
        $allocations = $this->rows('SELECT * FROM costume_kit_bulk_lines WHERE unit_id = :unit ORDER BY kit_id, bulk_stock_id', $unit);
        $handovers = $this->rows('SELECT ll.*, l.kit_id, l.holder_person_id, l.holder_unit_id FROM costume_loan_lines ll JOIN costume_loans l ON l.id = ll.loan_id WHERE ll.unit_id = :unit AND ll.bulk_stock_id IS NOT NULL AND ll.closed_at IS NULL ORDER BY ll.id', $unit);
        $people = $this->eligiblePeople($scope);
        $kitMap = array_column($kits, null, 'id');
        $selectedKitSeries = isset($scope['seriesId']) && array_any($kits, static fn (array $k): bool => (int) $k['series_id'] === $scope['seriesId']);
        $targets = [];
        foreach ($items as $row) {
            $classification = $selectedKitSeries && $row['kit_id'] !== null ? array_replace($kitMap[$row['kit_id']] ?? $row, ['part_type_id' => $row['part_type_id']]) : $row;
            if (!$this->matches($classification, $scope) || !$this->holderMatches($row, $people)) continue;
            $targets[] = $this->target('itemId', (int) $row['id'], $row, 1, [
                'label' => $row['series_name'] . ' ' . ($row['number'] ?? '(bez čísla)'), 'seriesId' => (int) $row['series_id'],
                'number' => $row['number'], 'condition' => $row['condition'], 'issuable' => $row['issuable'], 'location' => $row['location'],
                'kitId' => self::id($row['kit_id']), 'region' => $row['region_name'], 'gender' => $row['gender'], 'loanId' => self::id($row['loan_id']),
            ], null, self::id($row['loan_line_id']));
        }
        foreach ($kits as $row) {
            if ($row['retired_at'] !== null || !$this->matches($row, $scope) || !$this->holderMatches($row, $people)) continue;
            $targets[] = $this->target('kitId', (int) $row['id'], $row, 1, [
                'label' => $row['series_name'] . ' ' . ($row['number'] ?? '(bez čísla)'), 'seriesId' => (int) $row['series_id'],
                'number' => $row['number'], 'compositionState' => $row['composition_state'],
                'itemIds' => array_map(static fn (array $i): int => (int) $i['id'], array_values(array_filter($items, static fn (array $i): bool => $i['kit_id'] === $row['id']))),
                'bulkLines' => array_values(array_filter($allocations, static fn (array $a): bool => $a['kit_id'] === $row['id'])),
            ]);
        }
        foreach ($stocks as $stock) {
            $id = (int) $stock['id']; $reserved = 0; $byKit = [];
            foreach ($allocations as $allocation) if ($allocation['bulk_stock_id'] === $stock['id']) $byKit[$allocation['kit_id']]['present'] = (int) $allocation['present_qty'];
            foreach ($handovers as $handover) {
                if ($handover['bulk_stock_id'] !== $stock['id']) continue;
                $qty = (int) $handover['qty'] - (int) $handover['returned_qty'];
                $context = self::id($handover['kit_id']);
                if ($context !== null) $byKit[$context]['handed'] = ($byKit[$context]['handed'] ?? 0) + $qty;
                else $reserved += $qty;
                $classification = $this->bulkClassification($stock, $context === null ? null : ($kitMap[$context] ?? null), $selectedKitSeries);
                if ($this->matches($classification, $scope) && $this->holderMatches($handover, $people)) {
                    $targets[] = $this->target('bulkStockId', $id, $handover, $qty, $this->stockSnapshot($stock, 'loan'), $context, (int) $handover['id']);
                }
            }
            foreach ($byKit as $kit => $counts) {
                $allocated = $counts['present'] ?? 0; $handed = $counts['handed'] ?? 0;
                $reserved += max($allocated, $handed);
                $remaining = max(0, $allocated - $handed);
                if ($remaining === 0) continue;
                $classification = $this->bulkClassification($stock, $kitMap[$kit] ?? null, $selectedKitSeries);
                if ($this->matches($classification, $scope) && $people === null) $targets[] = $this->target('bulkStockId', $id, [], $remaining, $this->stockSnapshot($stock, 'kit'), (int) $kit);
            }
            $free = (int) $stock['quantity_total'] - $reserved;
            if ($free < 0) throw new \LogicException('Bulk snapshot exceeds the recorded capacity');
            if (($free > 0 || $reserved === 0) && $people === null && !$selectedKitSeries && $this->matches($stock, $scope)) {
                $targets[] = $this->target('bulkStockId', $id, [], $free, $this->stockSnapshot($stock, 'free'));
            }
        }
        return $targets;
    }

    private function eligiblePeople(array $scope): ?array
    {
        if (!isset($scope['groupId']) && !isset($scope['affiliationUnitId'])) return null;
        $where = []; $params = [];
        if (isset($scope['groupId'])) {
            $where[] = 'EXISTS (SELECT 1 FROM group_memberships g WHERE g.person_id = p.id AND g.group_id = :group AND g.valid_from <= current_date AND (g.valid_to IS NULL OR g.valid_to >= current_date))';
            $params['group'] = $scope['groupId'];
        }
        if (isset($scope['affiliationUnitId'])) {
            $where[] = 'EXISTS (SELECT 1 FROM unit_affiliations a WHERE a.person_id = p.id AND a.unit_id = :affiliation AND a.valid_from <= current_date AND (a.valid_to IS NULL OR a.valid_to >= current_date))';
            $params['affiliation'] = $scope['affiliationUnitId'];
        }
        $query = $this->db->prepare('SELECT p.id FROM persons p WHERE ' . implode(' AND ', $where)); $query->execute($params);
        return array_fill_keys($query->fetchAll(PDO::FETCH_COLUMN), true);
    }

    private function matches(array $row, array $scope): bool
    {
        if (isset($scope['seriesId']) && self::id($row['series_id'] ?? null) !== $scope['seriesId']) return false;
        if (isset($scope['partTypeId']) && self::id($row['part_type_id'] ?? null) !== $scope['partTypeId']) return false;
        if (isset($scope['gender']) && ($row['gender'] ?? null) !== $scope['gender']) return false;
        if (isset($scope['regionId']) && !in_array($scope['regionId'], [self::id($row['effective_region_id'] ?? null), self::id($row['region_parent_id'] ?? null)], true)) return false;
        if (isset($scope['variant']) && mb_strtolower($row['effective_variant'] ?? '') !== mb_strtolower($scope['variant'])) return false;
        return true;
    }

    private function holderMatches(array $row, ?array $people): bool
    {
        return $people === null || isset($people[$row['holder_person_id'] ?? 0]);
    }

    private function bulkClassification(array $stock, ?array $kit, bool $kitSeries): array
    {
        if ($kit === null) return $stock;
        if ($kitSeries) return array_replace($kit, ['part_type_id' => $stock['part_type_id']]);
        return array_replace($stock, ['effective_region_id' => $stock['effective_region_id'] ?? $kit['effective_region_id'],
            'region_parent_id' => $stock['effective_region_id'] === null ? $kit['region_parent_id'] : $stock['region_parent_id'],
            'gender' => $stock['gender'] ?? $kit['gender']]);
    }

    private function stockSnapshot(array $row, string $source): array
    {
        return ['label' => trim($row['type_name'] . ' ' . ($row['variant'] ?? '')), 'partTypeId' => (int) $row['part_type_id'],
            'quantityTotal' => (int) $row['quantity_total'], 'region' => $row['region_name'], 'gender' => $row['gender'], 'source' => $source];
    }

    private function target(string $kind, int $id, array $holder, int $qty, array $snapshot, ?int $kit = null, ?int $line = null): array
    {
        return array_replace(['itemId' => null, 'kitId' => null, 'bulkStockId' => null, 'holderPersonId' => self::id($holder['holder_person_id'] ?? null),
            'holderUnitId' => self::id($holder['holder_unit_id'] ?? null), 'contextKitId' => $kit, 'loanLineId' => $line,
            'expectedQty' => $qty, 'snapshot' => $snapshot], [$kind => $id]);
    }

    private function rows(string $sql, int $unit): array { $query = $this->db->prepare($sql); $query->execute(['unit' => $unit]); return $query->fetchAll(); }
    private static function id(mixed $id): ?int { return $id === null ? null : (int) $id; }
}
