<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDOException;
use Splk\Api\Infrastructure\Db\Transaction;

/** Database invariants independent of HTTP validation; no fabricated loans or checks. */
final class CostumeInventorySchemaTest extends DatabaseTestCase
{
    private int $fund;
    private int $series;
    private int $kitSeries;
    private int $type;
    private int $kit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->type = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'ribbon', false)");
        $numbered = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'shirt')");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'shirts', $numbered)");
        $this->kitSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'kits')");
        $this->kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, {$this->kitSeries}, 'K1')");
    }

    public function testDefaultStateDoesNotAssertPhysicalVerification(): void
    {
        $kit = $this->db->query("SELECT composition_state, version FROM costume_kits WHERE id = {$this->kit}")->fetch();
        self::assertSame('unverified', $kit['composition_state']);
        self::assertSame(1, $kit['version']);
        $item = $this->item(null);
        $row = $this->db->query("SELECT number, location, kit_id FROM costume_items WHERE id = $item")->fetch();
        self::assertNull($row['number']);
        self::assertSame('unknown', $row['location']);
        self::assertNull($row['kit_id']);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_item_events')->fetchColumn());
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_kit_changes')->fetchColumn());
    }

    public function testActiveNumbersAreUniqueButNullAndRetiredNumbersAreReusable(): void
    {
        $this->item(null);
        $this->item(null);
        $old = $this->item('3');
        $this->reject(fn () => $this->item('3'), '23505');
        $actor = $this->createAccount();
        $this->db->exec("UPDATE costume_items SET retired_at = now(), retired_by = $actor, retire_reason = 'Worn out' WHERE id = $old");
        self::assertNotSame($old, $this->item('3'));
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, {$this->kitSeries}, 'K1')"), '23505');
        $this->db->exec("UPDATE costume_kits SET retired_at = now() WHERE id = {$this->kit}");
        self::assertGreaterThan($this->kit, $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, {$this->kitSeries}, 'K1')"));
    }

    public function testRelationshipsCannotCrossFunds(): void
    {
        $other = $this->createUnit('Other');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_items (unit_id, series_id) VALUES ($other, {$this->series})"), '23503');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_bulk_stocks (unit_id, part_type_id) VALUES ($other, {$this->type})"), '23503');
        $foreignSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ($other, 'kit', 'other kits')");
        $foreignKit = $this->insert("INSERT INTO costume_kits (unit_id, series_id) VALUES ($other, $foreignSeries)");
        $item = $this->item(null);
        $this->reject(fn () => $this->db->exec("UPDATE costume_items SET kit_id = $foreignKit WHERE id = $item"), '23503');
        $stock = $this->stock(2);
        $this->reject(fn () => $this->line($foreignKit, $stock, 2, 0), '23503');
    }

    public function testRequiredQuantityDoesNotAllocateOrVerifyStock(): void
    {
        $stock = $this->stock(0);
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty) VALUES ({$this->fund}, {$this->kit}, $stock, 2)");
        self::assertSame(0, $this->db->query('SELECT present_qty FROM costume_kit_bulk_lines')->fetchColumn());
        self::assertSame('unverified', $this->db->query("SELECT composition_state FROM costume_kits WHERE id = {$this->kit}")->fetchColumn());
    }

    public function testRecordedQuantitiesCannotExceedTotalAcrossKits(): void
    {
        $stock = $this->stock(3);
        $otherKit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, {$this->kitSeries}, 'K2')");
        $this->line($this->kit, $stock, 2, 2);
        $this->reject(fn () => $this->line($otherKit, $stock, 2, 2), '23514');
        $this->line($otherKit, $stock, 2, 1);
        $this->reject(fn () => $this->db->exec("UPDATE costume_bulk_stocks SET quantity_total = 2 WHERE id = $stock"), '23514');
        self::assertSame(3, $this->db->query("SELECT quantity_total FROM costume_bulk_stocks WHERE id = $stock")->fetchColumn());
        self::assertSame(3, $this->db->query('SELECT sum(present_qty) FROM costume_kit_bulk_lines')->fetchColumn());
    }

    public function testInvalidQuantitiesAndStatesAreRejected(): void
    {
        $stock = $this->stock(2);
        $this->reject(fn () => $this->stock(-1, 'negative'), '23514');
        foreach ([[0, 0], [2, -1], [1, 2]] as [$required, $present]) {
            $this->reject(fn () => $this->line($this->kit, $stock, $required, $present), '23514');
        }
        $this->reject(fn () => $this->db->exec("UPDATE costume_kits SET composition_state = 'checked' WHERE id = {$this->kit}"), '23514');
        $item = $this->item('1');
        foreach (["version = 0", "condition = 'lost'", "location = 'loaned'", "retired_at = now()"] as $change) {
            $this->reject(fn () => $this->db->exec("UPDATE costume_items SET $change WHERE id = $item"), '23514');
        }
    }

    public function testHistoryReferencesExactlyOneComponentAndPreventsDeletion(): void
    {
        $item = $this->item('1');
        $stock = $this->stock(2);
        $actor = $this->createAccount();
        $prefix = "INSERT INTO costume_kit_changes (unit_id, kit_id, item_id, bulk_stock_id, change, by) VALUES ({$this->fund}, {$this->kit},";
        $this->reject(fn () => $this->db->exec("$prefix NULL, NULL, 'added', $actor)"), '23514');
        $this->reject(fn () => $this->db->exec("$prefix $item, $stock, 'added', $actor)"), '23514');
        $this->db->exec("$prefix $item, NULL, 'added', $actor)");
        $this->db->exec("INSERT INTO costume_item_events (item_id, by, event) VALUES ($item, $actor, 'created')");
        $this->reject(fn () => $this->db->exec("DELETE FROM costume_items WHERE id = $item"), '23503');
    }

    public function testWorkOrdersUseExtensibleCheckedTextStates(): void
    {
        $item = $this->item(null);
        $id = $this->insert("INSERT INTO costume_work_orders (item_id, type, description) VALUES ($item, 'repair', 'Replace button')");
        self::assertSame('open', $this->db->query("SELECT status FROM costume_work_orders WHERE id = $id")->fetchColumn());
        $this->reject(fn () => $this->db->exec("UPDATE costume_work_orders SET status = 'approved' WHERE id = $id"), '23514');
        $this->reject(fn () => $this->db->exec("UPDATE costume_work_orders SET type = 'washing' WHERE id = $id"), '23514');
    }

    public function testMigrationCanRollbackAndReapplyWithoutChangingCatalog(): void
    {
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024120000_create_costume_inventory.php';
        $adapter = new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]);
        $migration = new \CreateCostumeInventory('testing', 20261024120000);
        $migration->setAdapter($adapter);
        $later = $this->rollbackLaterMigrations(20261024120000);
        $migration->down();
        self::assertNull($this->db->query("SELECT to_regclass('costume_items')")->fetchColumn());
        self::assertSame(2, $this->db->query('SELECT count(*) FROM costume_series')->fetchColumn());
        $migration->up();
        foreach ($later as $dependent) $dependent->up();
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_items')->fetchColumn());
        self::assertSame(2, $this->db->query('SELECT count(*) FROM costume_series')->fetchColumn());
    }

    private function insert(string $sql): int
    {
        return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn();
    }

    private function item(?string $number): int
    {
        $value = $number === null ? 'NULL' : $this->db->quote($number);
        return $this->insert("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->fund}, {$this->series}, $value)");
    }

    private function stock(int $quantity, ?string $variant = null): int
    {
        $value = $variant === null ? 'NULL' : $this->db->quote($variant);
        return $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total, variant) VALUES ({$this->fund}, {$this->type}, $quantity, $value)");
    }

    private function line(int $kit, int $stock, int $required, int $present): void
    {
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, $kit, $stock, $required, $present)");
    }

    private function reject(callable $operation, string $state): void
    {
        try {
            Transaction::run($this->db, $operation);
            self::fail('Expected a database constraint violation');
        } catch (PDOException $e) {
            self::assertSame($state, $e->getCode(), $e->getMessage());
        }
    }
}
