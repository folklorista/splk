<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Domain\Costumes\InventoryScope;
use Splk\Api\Http\HttpException;

final class InventoryScopeTest extends DatabaseTestCase
{
    private int $fund;
    private int $person;
    private int $actor;
    private int $series;
    private int $kit;
    private int $stock;
    private int $item;
    private int $group;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name, gender) VALUES ({$this->fund}, 'Shirt', 'male')");
        $bulk = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Ribbons', false)");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id, gender) VALUES ({$this->fund}, 'part', 'Shirts', $type, 'male')");
        $kitSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Kits')");
        $this->kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id) VALUES ({$this->fund}, $kitSeries)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, kit_id, number, location) VALUES ({$this->fund}, {$this->series}, {$this->kit}, '03', 'store')");
        $this->stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $bulk, 3)");
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, {$this->kit}, {$this->stock}, 2, 2)");
        $this->group = $this->insert("INSERT INTO groups (name) VALUES ('Musicians')");
        $this->db->exec("INSERT INTO group_memberships (group_id, person_id) VALUES ({$this->group}, {$this->person})");
    }

    public function testScopeSeparatesKitContainersAndPhysicalQuantity(): void
    {
        $targets = $this->freeze();
        self::assertCount(4, $targets);
        self::assertSame(4, array_sum(array_column(array_filter($targets, static fn ($t) => $t['kitId'] === null), 'expectedQty')));
        self::assertEqualsCanonicalizing([1, 2], array_column(array_filter($targets, static fn ($t) => $t['bulkStockId'] !== null), 'expectedQty'));
        $piece = array_values(array_filter($targets, static fn ($t) => $t['itemId'] !== null))[0];
        self::assertSame('03', $piece['snapshot']['number']); self::assertSame('store', $piece['snapshot']['location']);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame('unverified', $this->db->query('SELECT composition_state FROM costume_kits')->fetchColumn());
    }

    public function testKitHandoversSplitAllocatedCountsWithoutOverlap(): void
    {
        $loan = $this->loan($this->kit);
        $this->line($loan, null, $this->stock, 1);
        $targets = $this->freeze();
        $bulk = array_values(array_filter($targets, static fn ($t) => $t['bulkStockId'] !== null));
        self::assertSame(3, array_sum(array_column($bulk, 'expectedQty')));
        self::assertCount(3, $bulk);
        self::assertSame(1, array_sum(array_column(array_filter($bulk, fn ($t) => $t['holderPersonId'] === $this->person), 'expectedQty')));
        self::assertSame(2, $this->db->query('SELECT present_qty FROM costume_kit_bulk_lines')->fetchColumn());
    }

    public function testOutstandingSnapshotSurvivesCompositionRemovalInScope(): void
    {
        $loan = $this->loan($this->kit); $line = $this->line($loan, null, $this->stock, 2);
        $this->db->exec('DELETE FROM costume_kit_bulk_lines');
        $bulk = array_values(array_filter($this->freeze(), static fn ($t) => $t['bulkStockId'] !== null));
        self::assertSame(3, array_sum(array_column($bulk, 'expectedQty')));
        self::assertSame(2, array_values(array_filter($bulk, static fn ($t) => $t['loanLineId'] === $line))[0]['expectedQty']);
    }

    public function testGroupFiltersActualHoldersAndNeverIncludesUnloanedStock(): void
    {
        self::assertSame([], $this->freeze(['groupId' => $this->group]));
        $loan = $this->loan(); $this->line($loan, $this->item, null, 1);
        $targets = $this->freeze(['groupId' => $this->group]);
        self::assertCount(1, $targets); self::assertSame($this->item, $targets[0]['itemId']);
        self::assertSame($this->person, $targets[0]['holderPersonId']);
        self::assertSame([], $this->freeze(['groupId' => $this->group, 'gender' => 'female']));
        $this->db->exec("INSERT INTO group_memberships (group_id, person_id) VALUES ({$this->group}, {$this->person})");
        self::assertCount(1, $this->freeze(['groupId' => $this->group]));
    }

    public function testAffiliationAndGroupFiltersIntersect(): void
    {
        $loan = $this->loan(); $this->line($loan, $this->item, null, 1);
        $unit = $this->createUnit('Affiliation');
        self::assertSame([], $this->freeze(['groupId' => $this->group, 'affiliationUnitId' => $unit]));
        $this->db->exec("INSERT INTO unit_affiliations (unit_id, person_id, status) VALUES ($unit, {$this->person}, 'active')");
        self::assertCount(1, $this->freeze(['groupId' => $this->group, 'affiliationUnitId' => $unit]));
    }

    public function testArchivedClassificationDoesNotHideExistingPhysicalProperty(): void
    {
        $this->db->exec("UPDATE costume_series SET archived_at = now() WHERE id = {$this->series}");
        $scope = (new InventoryScope($this->db))->validate(['seriesId' => $this->series], $this->fund);
        $targets = $this->freeze($scope);
        self::assertCount(1, $targets); self::assertSame($this->item, $targets[0]['itemId']);
    }

    public function testInvalidAndForeignClassificationIsRejected(): void
    {
        $other = $this->createUnit('Other');
        foreach ([['unknown' => true], ['seriesId' => '1'], ['gender' => 'other'], ['groupId' => 9999999], ['variant' => '']] as $scope) {
            try { (new InventoryScope($this->db))->validate($scope, $this->fund); self::fail('Expected validation failure'); }
            catch (HttpException $e) { self::assertSame(422, $e->status); }
        }
        $this->expectException(HttpException::class);
        (new InventoryScope($this->db))->validate(['seriesId' => $this->series], $other);
    }

    private function freeze(array $scope = []): array { return (new InventoryScope($this->db))->freeze($this->fund, $scope); }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
    private function loan(?int $kit = null): int { return $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, kit_id, issued_by) VALUES ({$this->fund}, {$this->person}, " . ($kit ?? 'NULL') . ", {$this->actor})"); }
    private function line(int $loan, ?int $item, ?int $stock, int $qty): int { return $this->insert("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, bulk_stock_id, qty) VALUES ({$this->fund}, $loan, " . ($item ?? 'NULL') . ', ' . ($stock ?? 'NULL') . ", $qty)"); }
}
