<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDOException;
use Splk\Api\Infrastructure\Db\Transaction;

/** Scope and observations have their own history; no loan state is fabricated by these tables. */
final class InventorySchemaTest extends DatabaseTestCase
{
    private int $fund;
    private int $actor;
    private int $inventory;
    private int $item;
    private int $person;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->actor = $this->createAccount();
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->fund}, 'Shirts', 'part', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series)");
        $this->inventory = $this->insert("INSERT INTO inventories (unit_id, name, started_by) VALUES ({$this->fund}, 'First inventory', {$this->actor})");
    }

    public function testTargetsHaveExactlyOneIdentityAndCannotCrossFunds(): void
    {
        $other = $this->createUnit('Other');
        $prefix = "INSERT INTO inventory_targets (unit_id, inventory_id, snapshot, item_id) VALUES (";
        $this->reject(fn () => $this->db->exec("$prefix $other, {$this->inventory}, '{}', {$this->item})"), '23503');
        $this->reject(fn () => $this->db->exec("$prefix {$this->fund}, {$this->inventory}, '{}', NULL)"), '23514');
        $this->target();
        $this->reject(fn () => $this->target(), '23505');
    }

    public function testExplicitAdditionsRequireTheirOwnReason(): void
    {
        $prefix = "INSERT INTO inventory_targets (unit_id, inventory_id, item_id, snapshot, added_explicitly, note) VALUES ({$this->fund}, {$this->inventory}, {$this->item}, '{}', true,";
        $this->reject(fn () => $this->db->exec("$prefix NULL)"), '23514');
        $this->reject(fn () => $this->db->exec("$prefix ' ')"), '23514');
        $this->db->exec("$prefix 'Newly found piece')");
        self::assertSame(1, $this->db->query('SELECT count(*) FROM inventory_targets')->fetchColumn());
    }

    public function testRepeatedObservationsAndCancellationRemainInHistory(): void
    {
        $target = $this->target();
        $first = $this->insert("INSERT INTO inventory_checks (unit_id, inventory_id, target_id, mode, result, by) VALUES ({$this->fund}, {$this->inventory}, $target, 'store', 'found', {$this->actor})");
        $this->insert("INSERT INTO inventory_checks (unit_id, inventory_id, target_id, mode, result, by) VALUES ({$this->fund}, {$this->inventory}, $target, 'store', 'not_found', {$this->actor})");
        $this->reject(fn () => $this->db->exec("UPDATE inventory_checks SET cancelled_at = now() WHERE id = $first"), '23514');
        $this->db->exec("UPDATE inventory_checks SET cancelled_at = now(), cancelled_by = {$this->actor} WHERE id = $first");
        self::assertSame(2, $this->db->query('SELECT count(*) FROM inventory_checks')->fetchColumn());
        self::assertSame(1, $this->db->query('SELECT count(*) FROM inventory_checks WHERE cancelled_at IS NULL')->fetchColumn());
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame('unknown', $this->db->query("SELECT location FROM costume_items WHERE id = {$this->item}")->fetchColumn());
    }

    public function testChecksCannotReferenceTargetsInAnotherInventory(): void
    {
        $target = $this->target();
        $other = $this->insert("INSERT INTO inventories (unit_id, name, started_by) VALUES ({$this->fund}, 'Second', {$this->actor})");
        $this->reject(fn () => $this->db->exec("INSERT INTO inventory_checks (unit_id, inventory_id, target_id, mode, result, by) VALUES ({$this->fund}, $other, $target, 'store', 'found', {$this->actor})"), '23503');
    }

    public function testClosedInventoriesRequireResultSnapshotAndReasonForIssues(): void
    {
        $this->reject(fn () => $this->db->exec("UPDATE inventories SET status = 'closed' WHERE id = {$this->inventory}"), '23514');
        $this->reject(fn () => $this->db->exec("UPDATE inventories SET status = 'closed', closed_at = now(), closed_by = {$this->actor}, result_snapshot = '{}', closed_with_issues = true WHERE id = {$this->inventory}"), '23514');
        $this->db->exec("UPDATE inventories SET status = 'closed', closed_at = now(), closed_by = {$this->actor}, result_snapshot = '{}', closed_with_issues = true, close_reason = 'Missing pieces remain explicit' WHERE id = {$this->inventory}");
        self::assertTrue($this->db->query('SELECT closed_with_issues FROM inventories')->fetchColumn());
    }

    public function testRepeatVisitsKeepCompletedHistoryAndSlotsStayWithinInventory(): void
    {
        $slot = $this->insert("INSERT INTO inventory_slots (unit_id, inventory_id, starts_at, ends_at, capacity) VALUES ({$this->fund}, {$this->inventory}, '2026-11-01 12:00Z', '2026-11-01 13:00Z', 3)");
        $prefix = "INSERT INTO inventory_visits (unit_id, inventory_id, person_id, slot_id) VALUES ({$this->fund}, {$this->inventory}, {$this->person}, $slot)";
        $first = $this->insert($prefix);
        $this->reject(fn () => $this->db->exec($prefix), '23505');
        $this->db->exec("UPDATE inventory_visits SET status = 'completed', completed_at = now() WHERE id = $first");
        $this->insert($prefix);
        self::assertSame(2, $this->db->query('SELECT count(*) FROM inventory_visits')->fetchColumn());
        $other = $this->insert("INSERT INTO inventories (unit_id, name, started_by) VALUES ({$this->fund}, 'Other', {$this->actor})");
        $this->reject(fn () => $this->db->exec("INSERT INTO inventory_visits (unit_id, inventory_id, person_id, slot_id) VALUES ({$this->fund}, $other, {$this->person}, $slot)"), '23503');
    }

    public function testInventoryLinksCannotCrossFunds(): void
    {
        $otherFund = $this->createUnit('Other');
        $other = $this->insert("INSERT INTO inventories (unit_id, name, started_by) VALUES ($otherFund, 'Other', {$this->actor})");
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_work_orders (item_id, type, description, inventory_id) VALUES ({$this->item}, 'repair', 'Button', $other)"), '23514');
        $this->db->exec("INSERT INTO costume_work_orders (item_id, type, description, inventory_id) VALUES ({$this->item}, 'repair', 'Button', {$this->inventory})");
    }

    public function testMigrationRollbackPreservesPhysicalInventoryAndLoans(): void
    {
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024200000_create_costume_inventories.php';
        $migration = new \CreateCostumeInventories('testing', 20261024200000);
        $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]));
        $loan = $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by) VALUES ({$this->fund}, {$this->person}, {$this->actor})");
        $line = $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, {$this->item}, 1)");
        $later = $this->rollbackLaterMigrations(20261024200000);
        $migration->down();
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_items')->fetchColumn());
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame(1, $this->db->query("SELECT qty FROM costume_loan_lines WHERE id = $line")->fetchColumn());
        $migration->up();
        foreach ($later as $dependent) $dependent->up();
        self::assertSame(0, $this->db->query('SELECT count(*) FROM inventories')->fetchColumn());
        self::assertSame($this->person, $this->db->query("SELECT holder_person_id FROM costume_loans WHERE id = $loan")->fetchColumn());
    }

    private function target(): int
    {
        return $this->insert("INSERT INTO inventory_targets (unit_id, inventory_id, item_id, snapshot) VALUES ({$this->fund}, {$this->inventory}, {$this->item}, '{}')");
    }

    private function insert(string $sql): int
    {
        return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn();
    }

    private function reject(callable $work, string $state): void
    {
        try { Transaction::run($this->db, $work); self::fail('Expected a constraint violation'); }
        catch (PDOException $e) { self::assertSame($state, $e->getCode(), $e->getMessage()); }
    }
}
