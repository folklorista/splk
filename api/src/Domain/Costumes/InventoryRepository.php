<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;

/** Frozen scope and append-only observations; mutations are serialized by the inventory header. */
final class InventoryRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $query = $this->db->prepare('SELECT * FROM inventories WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $query->execute(['id' => $id]); $row = $query->fetch();
        return $row === false ? null : ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'name' => $row['name'],
            'scope' => (object) json_decode($row['scope'], true, flags: JSON_THROW_ON_ERROR), 'status' => $row['status'],
            'startedAt' => $row['started_at'], 'startedBy' => (int) $row['started_by'], 'closedAt' => $row['closed_at'],
            'closedBy' => self::id($row['closed_by']), 'closedWithIssues' => (bool) $row['closed_with_issues'], 'closeReason' => $row['close_reason'],
            'resultSnapshot' => $row['result_snapshot'] === null ? null : json_decode($row['result_snapshot'], true, flags: JSON_THROW_ON_ERROR),
            'version' => (int) $row['version']];
    }

    public function list(int $unit, int $limit, int $offset): array
    {
        $count = $this->db->prepare('SELECT count(*) FROM inventories WHERE unit_id = :unit'); $count->execute(['unit' => $unit]);
        $query = $this->db->prepare("SELECT id FROM inventories WHERE unit_id = :unit ORDER BY started_at DESC, id DESC LIMIT $limit OFFSET $offset"); $query->execute(['unit' => $unit]);
        return ['items' => array_map(fn ($id): array => $this->find((int) $id), $query->fetchAll(PDO::FETCH_COLUMN)), 'total' => (int) $count->fetchColumn()];
    }

    public function insert(int $unit, string $name, array $scope, int $actor): int
    {
        $query = $this->db->prepare('INSERT INTO inventories (unit_id, name, scope, started_by) VALUES (:unit, :name, CAST(:scope AS jsonb), :actor) RETURNING id');
        $query->execute(['unit' => $unit, 'name' => $name, 'scope' => self::json((object) $scope), 'actor' => $actor]);
        return (int) $query->fetchColumn();
    }

    public function addTarget(int $unit, int $inventory, array $target, bool $explicit = false, ?string $note = null): int
    {
        $query = $this->db->prepare('INSERT INTO inventory_targets (unit_id, inventory_id, item_id, kit_id, bulk_stock_id, holder_person_id, holder_unit_id,
            context_kit_id, loan_line_id, expected_qty, snapshot, added_explicitly, note)
            VALUES (:unit, :inventory, :itemId, :kitId, :bulkStockId, :holderPersonId, :holderUnitId, :contextKitId, :loanLineId, :expectedQty, CAST(:snapshot AS jsonb), :explicit, :note) RETURNING id');
        $query->execute(['unit' => $unit, 'inventory' => $inventory, 'snapshot' => self::json((object) $target['snapshot']), 'explicit' => $explicit ? 'true' : 'false', 'note' => $note]
            + array_intersect_key($target, array_flip(['itemId', 'kitId', 'bulkStockId', 'holderPersonId', 'holderUnitId', 'contextKitId', 'loanLineId', 'expectedQty'])));
        return (int) $query->fetchColumn();
    }

    public function targets(int $inventory): array
    {
        $query = $this->db->prepare('SELECT t.*, i.condition AS current_condition FROM inventory_targets t LEFT JOIN costume_items i ON i.id = t.item_id WHERE t.inventory_id = :id ORDER BY t.id');
        $query->execute(['id' => $inventory]);
        return array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'inventoryId' => (int) $r['inventory_id'],
            'itemId' => self::id($r['item_id']), 'kitId' => self::id($r['kit_id']), 'bulkStockId' => self::id($r['bulk_stock_id']),
            'holderPersonId' => self::id($r['holder_person_id']), 'holderUnitId' => self::id($r['holder_unit_id']),
            'contextKitId' => self::id($r['context_kit_id']), 'loanLineId' => self::id($r['loan_line_id']), 'expectedQty' => (int) $r['expected_qty'],
            'snapshot' => json_decode($r['snapshot'], true, flags: JSON_THROW_ON_ERROR), 'addedExplicitly' => (bool) $r['added_explicitly'], 'note' => $r['note'],
            'currentCondition' => $r['current_condition']], $query->fetchAll());
    }

    public function checks(int $inventory): array
    {
        $query = $this->db->prepare('SELECT * FROM inventory_checks WHERE inventory_id = :id ORDER BY at, id'); $query->execute(['id' => $inventory]);
        return array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'inventoryId' => (int) $r['inventory_id'], 'targetId' => (int) $r['target_id'],
            'mode' => $r['mode'], 'result' => $r['result'], 'condition' => $r['condition'], 'checkedQty' => self::id($r['checked_qty']), 'note' => $r['note'],
            'by' => (int) $r['by'], 'at' => $r['at'], 'cancelledAt' => $r['cancelled_at'], 'cancelledBy' => self::id($r['cancelled_by']),
            'context' => (object) json_decode($r['context'], true, flags: JSON_THROW_ON_ERROR)], $query->fetchAll());
    }

    public function addCheck(int $unit, int $inventory, int $target, string $mode, string $result, ?string $condition, ?int $qty, ?string $note, int $actor, array $context = []): int
    {
        $query = $this->db->prepare('INSERT INTO inventory_checks (unit_id, inventory_id, target_id, mode, result, condition, checked_qty, note, by, at, context)
            VALUES (:unit, :inventory, :target, :mode, :result, :condition, :qty, :note, :actor, clock_timestamp(), CAST(:context AS jsonb)) RETURNING id');
        $query->execute(['unit' => $unit, 'inventory' => $inventory, 'target' => $target, 'mode' => $mode, 'result' => $result, 'condition' => $condition, 'qty' => $qty, 'note' => $note, 'actor' => $actor, 'context' => self::json((object) $context)]);
        return (int) $query->fetchColumn();
    }

    public function check(int $id): ?array
    {
        $query = $this->db->prepare('SELECT inventory_id FROM inventory_checks WHERE id = :id'); $query->execute(['id' => $id]); $inventory = $query->fetchColumn();
        if ($inventory === false) return null;
        foreach ($this->checks((int) $inventory) as $check) if ($check['id'] === $id) return $check;
        return null;
    }

    public function cancel(int $id, int $actor): void
    {
        $this->db->prepare('UPDATE inventory_checks SET cancelled_at = clock_timestamp(), cancelled_by = :actor WHERE id = :id AND cancelled_at IS NULL')->execute(['id' => $id, 'actor' => $actor]);
    }

    public function visits(int $id): array
    {
        $query = $this->db->prepare('SELECT * FROM inventory_visits WHERE inventory_id = :id ORDER BY id'); $query->execute(['id' => $id]);
        return array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'inventoryId' => (int) $r['inventory_id'], 'personId' => (int) $r['person_id'],
            'slotId' => self::id($r['slot_id']), 'status' => $r['status'], 'completedAt' => $r['completed_at']], $query->fetchAll());
    }

    public function slots(int $id): array
    {
        $query = $this->db->prepare('SELECT * FROM inventory_slots WHERE inventory_id = :id ORDER BY starts_at, id'); $query->execute(['id' => $id]);
        return array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'inventoryId' => (int) $r['inventory_id'], 'startsAt' => $r['starts_at'],
            'endsAt' => $r['ends_at'], 'capacity' => (int) $r['capacity']], $query->fetchAll());
    }

    public function progress(array $inventory): array
    {
        if ($inventory['status'] === 'closed') return $inventory['resultSnapshot']['progress'];
        return InventoryCoverage::evaluate($this->targets($inventory['id']), $this->checks($inventory['id']), $this->visits($inventory['id']), $this->workOrders($inventory['id']));
    }

    public function workOrders(int $id): array
    {
        $query = $this->db->prepare("SELECT DISTINCT w.id, w.item_id, w.status FROM costume_work_orders w JOIN inventory_targets t ON t.item_id = w.item_id WHERE t.inventory_id = :id AND w.status IN ('open', 'in_progress') ORDER BY w.id");
        $query->execute(['id' => $id]);
        return array_map(fn (array $r): array => (new WorkOrderRepository($this->db))->find((int) $r['id']), $query->fetchAll());
    }

    public function movements(int $id): array
    {
        $inventory = $this->find($id) ?? throw new \LogicException('Inventory does not exist');
        return (new LoanRepository($this->db))->movements($inventory['unitId'], ['inventoryId' => $id], PHP_INT_MAX, 0)['items'];
    }

    public function touch(int $id): void { $this->db->prepare('UPDATE inventories SET version = version + 1 WHERE id = :id')->execute(['id' => $id]); }

    public function close(array $inventory, bool $issues, ?string $reason, int $actor): void
    {
        if ($inventory['status'] !== 'open') throw new HttpException(409, 'inventory_closed', 'The inventory is already closed.');
        $progress = $this->progress($inventory);
        if (!$issues && !$progress['canCloseCleanly']) throw new HttpException(422, 'inventory_has_issues', 'Unverified targets or discrepancies remain.');
        if ($issues && ($reason === null || trim($reason) === '')) throw Input::invalid('reason', 'required');
        $snapshot = ['progress' => $progress, 'targets' => $this->targets($inventory['id']), 'checks' => $this->checks($inventory['id']),
            'visits' => $this->visits($inventory['id']), 'slots' => $this->slots($inventory['id']), 'workOrders' => $this->workOrders($inventory['id']), 'movements' => $this->movements($inventory['id'])];
        $query = $this->db->prepare("UPDATE inventories SET status = 'closed', closed_at = clock_timestamp(), closed_by = :actor,
            closed_with_issues = :issues, close_reason = :reason, result_snapshot = CAST(:snapshot AS jsonb), version = version + 1 WHERE id = :id");
        $query->execute(['id' => $inventory['id'], 'actor' => $actor, 'issues' => $issues ? 'true' : 'false', 'reason' => $reason, 'snapshot' => self::json($snapshot)]);
    }

    private static function id(mixed $id): ?int { return $id === null ? null : (int) $id; }
    private static function json(mixed $value): string { return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE); }
}
