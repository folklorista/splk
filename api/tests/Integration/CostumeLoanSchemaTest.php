<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDOException;
use Splk\Api\Infrastructure\Db\Transaction;

final class CostumeLoanSchemaTest extends DatabaseTestCase
{
    private int $fund;
    private int $actor;
    private int $person;
    private int $kit;
    private int $stock;
    private int $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->actor = $this->createAccount();
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'ribbon', false)");
        $numbered = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'shirts', $numbered)");
        $kitSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'kits')");
        $this->kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id) VALUES ({$this->fund}, $kitSeries)");
        $this->stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $type, 2)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series)");
    }

    public function testWholeKitHandoverDoesNotDeductTheSameRibbonsTwice(): void
    {
        $this->allocate();
        $loan = $this->loan($this->kit);
        $line = $this->bulk($loan, 2);
        self::assertSame(2, $this->reserved());
        self::assertSame(2, $this->db->query('SELECT present_qty FROM costume_kit_bulk_lines')->fetchColumn());
        $this->reject(fn () => $this->bulk($this->loan(), 1), '23514');
        $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 1 WHERE id = $line");
        self::assertSame(2, $this->reserved());
        $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 2, closed_at = now(), closed_by = {$this->actor}, close_type = 'returned' WHERE id = $line");
        self::assertSame(2, $this->reserved());
        self::assertSame('unverified', $this->db->query('SELECT composition_state FROM costume_kits')->fetchColumn());
    }

    public function testRemovingCompositionDoesNotReleaseOutstandingHandover(): void
    {
        $this->allocate();
        $this->bulk($this->loan($this->kit), 2);
        $this->db->exec('DELETE FROM costume_kit_bulk_lines');
        self::assertSame(2, $this->reserved());
        $this->reject(fn () => $this->bulk($this->loan(), 1), '23514');
        $this->reject(fn () => $this->db->exec("UPDATE costume_bulk_stocks SET quantity_total = 1 WHERE id = {$this->stock}"), '23514');
    }

    public function testIndependentBulkLoansAndKitAllocationsShareCapacity(): void
    {
        $this->bulk($this->loan(), 1);
        self::assertSame(1, $this->reserved());
        $this->reject(fn () => $this->allocate(), '23514');
        $this->reject(fn () => $this->bulk($this->loan(), 2), '23514');
        $this->bulk($this->loan(), 1);
        self::assertSame(2, $this->reserved());
    }

    public function testHolderAndLineShapeAndFundIntegrity(): void
    {
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_loans (unit_id, issued_by) VALUES ({$this->fund}, {$this->actor})"), '23514');
        $other = $this->createUnit('Other');
        $loan = $this->loan();
        $this->reject(fn () => $this->db->exec("UPDATE costume_loans SET holder_unit_id = $other WHERE id = $loan"), '23514');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ($other, $loan, {$this->item}, 1)"), '23503');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, qty) VALUES ({$this->fund}, $loan, 1)"), '23514');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, {$this->item}, 2)"), '23514');
        $line = $this->bulk($loan, 2);
        $this->reject(fn () => $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 3 WHERE id = $line"), '23514');
        $this->reject(fn () => $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 2 WHERE id = $line"), '23514');
    }

    public function testNumberedPieceCannotHaveTwoOpenHolders(): void
    {
        $loan = $this->loan();
        $line = $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, {$this->item}, 1)");
        $otherLoan = $this->loan();
        $this->reject(fn () => $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $otherLoan, {$this->item}, 1)"), '23505');
        $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 1, closed_at = now(), closed_by = {$this->actor}, close_type = 'returned' WHERE id = $line");
        $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $otherLoan, {$this->item}, 1)");
        self::assertSame(2, $this->db->query('SELECT count(*) FROM costume_loan_lines')->fetchColumn());
    }

    public function testPartialReturnHistoryPreservesEachQuantityAndNote(): void
    {
        $line = $this->bulk($this->loan(), 2);
        $this->db->exec("INSERT INTO costume_loan_returns (unit_id, line_id, qty, close_type, note, by) VALUES ({$this->fund}, $line, 1, 'returned', 'First ribbon', {$this->actor}), ({$this->fund}, $line, 1, 'returned', 'Second ribbon', {$this->actor})");
        self::assertSame(['First ribbon', 'Second ribbon'], $this->db->query('SELECT note FROM costume_loan_returns ORDER BY id')->fetchAll(\PDO::FETCH_COLUMN));
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_loan_returns (unit_id, line_id, qty, close_type, by) VALUES ({$this->fund}, $line, 0, 'returned', {$this->actor})"), '23514');
    }

    public function testMigrationRollbackRetainsExistingInventory(): void
    {
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024180000_create_costume_loans.php';
        $migration = new \CreateCostumeLoans('testing', 20261024180000);
        $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]));
        $this->allocate();
        $later = $this->rollbackLaterMigrations(20261024180000);
        $migration->down();
        self::assertSame(2, $this->db->query('SELECT present_qty FROM costume_kit_bulk_lines')->fetchColumn());
        $this->reject(fn () => $this->db->exec('UPDATE costume_bulk_stocks SET quantity_total = 1'), '23514');
        $migration->up();
        foreach ($later as $dependent) $dependent->up();
        self::assertSame(2, $this->reserved());
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
    }

    private function loan(?int $kit = null): int
    {
        $value = $kit === null ? 'NULL' : (string) $kit;
        return $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by, kit_id) VALUES ({$this->fund}, {$this->person}, {$this->actor}, $value)");
    }

    private function bulk(int $loan, int $qty): int
    {
        return $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, bulk_stock_id, qty) VALUES ({$this->fund}, $loan, {$this->stock}, $qty)");
    }

    private function allocate(): void
    {
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, {$this->kit}, {$this->stock}, 2, 2)");
    }

    private function reserved(): int
    {
        return (int) $this->db->query("SELECT costume_bulk_reserved({$this->stock})")->fetchColumn();
    }

    private function insert(string $sql): int
    {
        return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn();
    }

    private function reject(callable $work, string $state): void
    {
        try {
            Transaction::run($this->db, $work);
            self::fail('Expected constraint violation');
        } catch (PDOException $e) {
            self::assertSame($state, $e->getCode(), $e->getMessage());
        }
    }
}
