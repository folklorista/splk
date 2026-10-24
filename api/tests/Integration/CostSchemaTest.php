<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Infrastructure\Db\Transaction;

final class CostSchemaTest extends DatabaseTestCase
{
    private int $fund; private int $actor;
    protected function setUp(): void { parent::setUp(); $this->fund = $this->createUnit(); $this->actor = $this->createAccount(); }
    public function testExactSignedAmountsAndCurrencyAreRetained(): void
    {
        $this->cost('-12345678901234.1234', 'EUR'); $this->cost('0.0000', 'CZK');
        self::assertSame(['-12345678901234.1234', '0.0000'], $this->db->query('SELECT amount FROM costume_costs ORDER BY id')->fetchAll(\PDO::FETCH_COLUMN));
        foreach (['eur', '', 'EURO', '12A'] as $currency) $this->reject(fn () => $this->cost('1', $currency), '23514');
        $this->reject(fn () => $this->cost('NaN'), '23514');
    }
    public function testLinksRequireOneTargetInTheSameFundAndUniqueQuantity(): void
    {
        $cost = $this->cost(); $other = $this->createUnit('Other');
        $type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name) VALUES ($other, 'Shirt') RETURNING id")->fetchColumn();
        $series = (int) $this->db->query("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ($other, 'Shirts', 'part', $type) RETURNING id")->fetchColumn();
        $item = (int) $this->db->query("INSERT INTO costume_items (unit_id, series_id) VALUES ($other, $series) RETURNING id")->fetchColumn();
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_cost_links (unit_id, cost_id, item_id, qty) VALUES ({$this->fund}, $cost, $item, 1)"), '23503');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_cost_links (unit_id, cost_id, qty) VALUES ({$this->fund}, $cost, 1)"), '23514');
        $this->reject(fn () => $this->db->exec("INSERT INTO costume_cost_links (unit_id, cost_id, item_id, qty) VALUES ({$this->fund}, $cost, $item, 2)"), '23514');
    }
    public function testEmptyMigrationRoundTripPreservesExistingUnitsAndRollbackRefusesCostLoss(): void
    {
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024234000_create_costume_costs.php';
        $migration = new \CreateCostumeCosts('testing', 20261024234000); $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]));
        $migration->down(); $migration->up(); self::assertSame($this->fund, $this->db->query("SELECT id FROM units WHERE id = {$this->fund}")->fetchColumn());
        $id = $this->cost(); $this->reject(fn () => $migration->down(), '55000'); self::assertSame($id, $this->db->query('SELECT id FROM costume_costs')->fetchColumn());
    }
    private function cost(string $amount = '1', string $currency = 'CZK'): int {
        $query = $this->db->prepare("INSERT INTO costume_costs (unit_id, spent_on, amount, currency, description, created_by, updated_by) VALUES (:fund, current_date, :amount, :currency, 'Purchase', :actor, :actor) RETURNING id");
        $query->execute(['fund' => $this->fund, 'actor' => $this->actor, 'amount' => $amount, 'currency' => $currency]); return (int) $query->fetchColumn();
    }
    private function reject(callable $work, string $code): void { try { Transaction::run($this->db, $work); self::fail('Invalid cost data accepted'); } catch (\PDOException $error) { self::assertSame($code, $error->getCode()); } }
}
