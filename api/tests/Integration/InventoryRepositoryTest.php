<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Domain\Costumes\InventoryRepository;
use Splk\Api\Domain\Costumes\InventoryScope;
use Splk\Api\Http\HttpException;

final class InventoryRepositoryTest extends DatabaseTestCase
{
    private int $fund;
    private int $actor;
    private int $item;
    private int $inventory;
    private InventoryRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, $series, '3', 'store')");
        $this->repository = new InventoryRepository($this->db);
        $this->inventory = $this->repository->insert($this->fund, 'First inventory', [], $this->actor);
        foreach ((new InventoryScope($this->db))->freeze($this->fund, []) as $target) $this->repository->addTarget($this->fund, $this->inventory, $target);
    }

    public function testScopeAndLabelsStayFrozenAcrossLaterItemAndLoanChanges(): void
    {
        $before = $this->repository->targets($this->inventory);
        $this->db->exec("UPDATE costume_items SET number = 'New', location = 'repair' WHERE id = {$this->item}");
        $person = $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $loan = $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by) VALUES ({$this->fund}, $person, {$this->actor})");
        $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, {$this->item}, 1)");
        self::assertSame($before, $this->repository->targets($this->inventory));
        self::assertNull($before[0]['holderPersonId']); self::assertSame('3', $before[0]['snapshot']['number']);
        self::assertSame(1, $this->repository->list($this->fund, 1, 0)['total']);
    }

    public function testD63KeepsCoverageAndRequiresAnExplicitReasonToCloseWithLaterAbsence(): void
    {
        $this->observe('found'); $this->observe('not_found');
        $header = $this->repository->find($this->inventory, true);
        $progress = $this->repository->progress($header);
        self::assertSame(1, $progress['verifiedTargetCount']); self::assertFalse($progress['canCloseCleanly']);
        $this->reject(fn () => $this->repository->close($header, false, null, $this->actor), 'inventory_has_issues');
        $this->reject(fn () => $this->repository->close($header, true, null, $this->actor), 'validation_failed');
        $this->repository->close($header, true, 'Recheck is still needed', $this->actor);
        $closed = $this->repository->find($this->inventory);
        self::assertSame('closed', $closed['status']); self::assertTrue($closed['closedWithIssues']);
        self::assertSame($this->canonical($progress), $this->canonical($closed['resultSnapshot']['progress']));
    }

    public function testCancellationPreservesAllRowsAndOnlyActiveEvidenceCounts(): void
    {
        $positive = $this->observe('found'); $negative = $this->observe('not_found');
        $this->repository->cancel($negative, $this->actor);
        self::assertTrue($this->repository->progress($this->repository->find($this->inventory))['canCloseCleanly']);
        $this->repository->cancel($positive, $this->actor);
        self::assertSame(0, $this->repository->progress($this->repository->find($this->inventory))['verifiedTargetCount']);
        self::assertCount(2, $this->repository->checks($this->inventory));
        self::assertSame($this->actor, $this->repository->check($positive)['cancelledBy']);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
    }

    public function testClosedResultDoesNotChangeWithNewWorkOrCatalogEdits(): void
    {
        $this->observe('found');
        $this->repository->close($this->repository->find($this->inventory, true), false, null, $this->actor);
        $before = $this->repository->find($this->inventory)['resultSnapshot'];
        $this->db->exec("UPDATE costume_items SET condition = 'damaged', number = 'Later' WHERE id = {$this->item}");
        $this->db->exec("INSERT INTO costume_work_orders (item_id, type, description) VALUES ({$this->item}, 'repair', 'Later damage')");
        $after = $this->repository->find($this->inventory);
        self::assertSame($before, $after['resultSnapshot']); self::assertSame($before['progress'], $this->repository->progress($after));
        $this->reject(fn () => $this->repository->close($after, true, 'Change history', $this->actor), 'inventory_closed');
    }

    private function observe(string $result): int
    {
        $target = $this->repository->targets($this->inventory)[0];
        return $this->repository->addCheck($this->fund, $this->inventory, $target['id'], 'store', $result, null, null, null, $this->actor);
    }
    /** JSONB objects have no key order; lists and scalar types still must match exactly. */
    private function canonical(array $value): array
    {
        if (!array_is_list($value)) ksort($value);
        foreach ($value as &$entry) if (is_array($entry)) $entry = $this->canonical($entry);
        return $value;
    }
    private function reject(callable $write, string $code): void
    {
        try { $write(); self::fail('Expected domain validation failure'); }
        catch (HttpException $e) { self::assertSame($code, $e->errorCode); }
    }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
