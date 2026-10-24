<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class LoansTest extends ApiTestCase
{
    private int $fund;
    private int $actor;
    private int $person;
    private int $series;
    private int $kitSeries;
    private int $stock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund);
        $this->signInAs($this->actor);
        $this->person = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('External', 'Holder')");
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'shirt')");
        $bulkType = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'ribbon', false)");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'shirts', $type)");
        $this->kitSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'kits')");
        $this->stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $bulkType, 2)");
    }

    public function testIssueCreatesActualSnapshotEventsAndAuditWithoutCreatingMembership(): void
    {
        $item = $this->item();
        $loan = $this->issue(['items' => [$item], 'bulk' => [['stockId' => $this->stock, 'qty' => 2]], 'note' => 'Performance']);
        self::assertSame(2, count($loan['lines']));
        self::assertSame(['personId' => $this->person], $loan['holder']);
        self::assertNull($loan['dueAt']);
        self::assertSame([], $loan['returns']);
        self::assertSame(1, $this->auditCount('loan.issue'));
        self::assertSame('issued', $this->db->query('SELECT event FROM costume_item_events')->fetchColumn());
        self::assertSame(0, $this->db->query("SELECT count(*) FROM unit_affiliations WHERE person_id = {$this->person}")->fetchColumn());
        self::assertSame(0, $this->db->query("SELECT count(*) FROM user_accounts WHERE person_id = {$this->person}")->fetchColumn());
        self::assertSame('unknown', $this->db->query("SELECT location FROM costume_items WHERE id = $item")->fetchColumn());
        self::assertError(422, 'item_unavailable', $this->post($this->path(), $this->holder() + ['items' => [$item]]));
        self::assertError(422, 'insufficient_stock', $this->post($this->path(), $this->holder() + ['bulk' => [['stockId' => $this->stock, 'qty' => 1]]]));
    }

    public function testPartialReturnsKeepRemainingResponsibilityAndEachNote(): void
    {
        $item = $this->item();
        $loan = $this->issue(['items' => [$item], 'bulk' => [['stockId' => $this->stock, 'qty' => 2]]]);
        $piece = $loan['lines'][0];
        $bulk = $loan['lines'][1];
        $first = $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [
            ['lineId' => $piece['id'], 'returnedQty' => 1, 'closeType' => 'returned', 'note' => 'Unwashed', 'condition' => 'needs_adjustment', 'issuable' => false, 'location' => 'store'],
            ['lineId' => $bulk['id'], 'returnedQty' => 1, 'closeType' => 'returned', 'note' => 'One ribbon'],
        ]]);
        self::assertStatus(200, $first);
        $result = $first->decodedBody();
        self::assertSame('Unwashed', $result['lines'][0]['closeNote']);
        self::assertNull($result['lines'][1]['closedAt']);
        self::assertSame(1, $result['lines'][1]['returnedQty']);
        self::assertSame(['Unwashed', 'One ribbon'], array_column($result['returns'], 'note'));
        self::assertSame(1, $this->get($this->path() . '?open=true')->decodedBody()['total']);
        $second = $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [['lineId' => $bulk['id'], 'returnedQty' => 1, 'closeType' => 'returned', 'note' => 'Second ribbon']]]);
        self::assertStatus(200, $second);
        self::assertNotNull($second->decodedBody()['lines'][1]['closedAt']);
        self::assertSame(3, count($second->decodedBody()['returns']));
        self::assertSame(0, $this->get($this->path() . '?open=true')->decodedBody()['total']);
        $state = $this->db->query("SELECT condition, issuable, location FROM costume_items WHERE id = $item")->fetch();
        self::assertSame(['condition' => 'needs_adjustment', 'issuable' => false, 'location' => 'store'], $state);
        self::assertSame(2, $this->auditCount('loan.return'));
    }

    public function testWholeKitKeepsAllocationAndAvoidsDoubleDeduction(): void
    {
        $kit = $this->kit();
        $item = $this->item($kit);
        $loan = $this->issue(['kitId' => $kit, 'note' => 'Checked exceptions']);
        self::assertSame(2, count($loan['lines']));
        self::assertSame($item, $loan['lines'][0]['itemId']);
        self::assertSame(2, $loan['lines'][1]['qty']);
        self::assertSame(2, $this->db->query('SELECT present_qty FROM costume_kit_bulk_lines')->fetchColumn());
        $stock = $this->get("/v1/funds/{$this->fund}/bulk-stocks")->decodedBody()['items'][0];
        self::assertSame(2, $stock['quantityReserved']);
        self::assertSame(0, $stock['quantityAvailable']);
        self::assertError(422, 'kit_unavailable', $this->post($this->path(), $this->holder() + ['kitId' => $kit, 'note' => 'Again']));
        $this->db->exec('DELETE FROM costume_kit_bulk_lines');
        self::assertSame(2, $this->get("/v1/loans/{$loan['id']}")->decodedBody()['lines'][1]['qty']);
        self::assertError(422, 'insufficient_stock', $this->patch("/v1/bulk-stocks/{$this->stock}", ['quantityTotal' => 1]));
        self::assertError(422, 'insufficient_stock', $this->post($this->path(), $this->holder() + ['bulk' => [['stockId' => $this->stock, 'qty' => 1]]]));
        self::assertSame('unverified', $this->db->query("SELECT composition_state FROM costume_kits WHERE id = $kit")->fetchColumn());
    }

    public function testKitSkipsSeparatelyLoanedAndExplicitlyOmittedItemsAndNeedsNote(): void
    {
        $kit = $this->kit();
        $alreadyLoaned = $this->item($kit);
        $omitted = $this->item($kit);
        $this->issue(['items' => [$alreadyLoaned]]);
        self::assertError(422, 'validation_failed', $this->post($this->path(), $this->holder() + ['kitId' => $kit]));
        $loan = $this->issue(['kitId' => $kit, 'omitItemIds' => [$omitted], 'note' => 'Only ribbons handed over']);
        self::assertSame([$alreadyLoaned, $omitted], $loan['omittedItemIds']);
        self::assertSame(1, count($loan['lines']));
        self::assertNull($loan['lines'][0]['itemId']);
        self::assertSame(2, $loan['lines'][0]['qty']);
    }

    public function testExchangeIsAtomicAndLinksBothHandovers(): void
    {
        $old = $this->item();
        $new = $this->item();
        $loan = $this->issue(['items' => [$old], 'dueAt' => '2026-11-01T12:00:00+01:00']);
        $result = $this->post("/v1/loans/{$loan['id']}/exchange", ['lineId' => $loan['lines'][0]['id'], 'itemId' => $new, 'note' => 'Larger size', 'location' => 'store']);
        self::assertStatus(201, $result);
        self::assertSame($loan['id'], $result->decodedBody()['replacesLoanId']);
        self::assertSame($new, $result->decodedBody()['lines'][0]['itemId']);
        self::assertSame($loan['holder'], $result->decodedBody()['holder']);
        $oldLoan = $this->get("/v1/loans/{$loan['id']}")->decodedBody();
        self::assertSame('exchanged', $oldLoan['lines'][0]['closeType']);
        self::assertSame(1, $oldLoan['lines'][0]['returnedQty']);
        self::assertSame('Larger size', $oldLoan['returns'][0]['note']);
        self::assertSame(1, $this->auditCount('loan.exchange'));
    }

    public function testRejectedExchangeRollsBackReturnAndConditionChanges(): void
    {
        $old = $this->item();
        $unavailable = $this->item();
        $loan = $this->issue(['items' => [$old, $unavailable]]);
        $result = $this->post("/v1/loans/{$loan['id']}/exchange", ['lineId' => $loan['lines'][0]['id'], 'itemId' => $unavailable, 'condition' => 'damaged']);
        self::assertError(422, 'item_unavailable', $result);
        self::assertSame($loan, $this->get("/v1/loans/{$loan['id']}")->decodedBody() + ['omittedItemIds' => []]);
        self::assertSame('ok', $this->db->query("SELECT condition FROM costume_items WHERE id = $old")->fetchColumn());
        self::assertSame(0, $this->auditCount('loan.exchange'));
    }

    public function testReturnBatchRejectsDuplicateClosedExcessAndForeignLinesAtomically(): void
    {
        $loan = $this->issue(['bulk' => [['stockId' => $this->stock, 'qty' => 2]]]);
        $id = $loan['lines'][0]['id'];
        $line = ['lineId' => $id, 'returnedQty' => 1, 'closeType' => 'returned'];
        self::assertError(422, 'validation_failed', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line, $line]]));
        self::assertError(422, 'loan_line_closed', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [array_replace($line, ['returnedQty' => 3])]]));
        self::assertError(404, 'not_found', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line, array_replace($line, ['lineId' => 999999999])]]));
        self::assertSame([], $this->get("/v1/loans/{$loan['id']}")->decodedBody()['returns']);
        self::assertStatus(200, $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [array_replace($line, ['returnedQty' => 2])]]));
        self::assertError(422, 'loan_line_closed', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line]]));
    }

    public function testIssueRejectsBadShapeQuantitiesDatesAndUnavailableItems(): void
    {
        $item = $this->item();
        $base = $this->holder();
        foreach ([[], ['items' => [$item, $item]], ['items' => ['1']], ['bulk' => [['stockId' => $this->stock, 'qty' => '1']]],
            ['bulk' => [['stockId' => $this->stock, 'qty' => 0]]], ['items' => [$item], 'dueAt' => '2026-02-30T12:00:00Z'],
            ['items' => [$item], 'dueAt' => 'tomorrow'], ['items' => [$item], 'kitId' => 1], ['items' => [$item], 'omitItemIds' => []]] as $input) {
            self::assertError(422, 'validation_failed', $this->post($this->path(), $base + $input));
        }
        self::assertError(422, 'validation_failed', $this->post($this->path(), ['holder' => ['personId' => $this->person, 'unitId' => $this->fund], 'items' => [$item]]));
        $this->db->exec("UPDATE costume_items SET issuable = false WHERE id = $item");
        self::assertError(422, 'item_unavailable', $this->post($this->path(), $base + ['items' => [$item]]));
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame(0, $this->auditCount('loan.issue'));
    }

    public function testFundIsolationAndReadOnlyDenialsForEveryEndpoint(): void
    {
        $item = $this->item();
        $loan = $this->issue(['items' => [$item]]);
        $otherFund = $this->createUnit('Other');
        $other = $this->createAccount(email: 'other@example.test');
        $this->grant($other, 'costumes.manage', $otherFund);
        $this->signInAs($other);
        foreach ([$this->path(), "/v1/loans/{$loan['id']}", "/v1/funds/{$this->fund}/movements"] as $path) {
            self::assertError(404, 'not_found', $this->get($path));
        }
        self::assertError(404, 'not_found', $this->post($this->path(), $this->holder() + ['items' => [$item]]));
        self::assertError(404, 'not_found', $this->post("/v1/funds/$otherFund/loans", $this->holder() + ['items' => [$item]]));
        self::assertError(404, 'not_found', $this->patch("/v1/loans/{$loan['id']}", ['note' => 'Forbidden']));
        self::assertError(404, 'not_found', $this->post("/v1/loans/{$loan['id']}/return", []));
        self::assertError(404, 'not_found', $this->post("/v1/loans/{$loan['id']}/exchange", []));
        $this->grant($other, 'costumes.view', $this->fund);
        self::assertStatus(200, $this->get("/v1/loans/{$loan['id']}"));
        self::assertError(403, 'forbidden', $this->post($this->path(), []));
        self::assertError(403, 'forbidden', $this->patch("/v1/loans/{$loan['id']}", []));
        self::assertError(403, 'forbidden', $this->post("/v1/loans/{$loan['id']}/return", []));
        self::assertError(403, 'forbidden', $this->post("/v1/loans/{$loan['id']}/exchange", []));
        $this->signOut();
        self::assertError(401, 'unauthenticated', $this->get($this->path()));
    }

    public function testOtherUnitHolderAndLoanFiltersAndPatch(): void
    {
        $other = $this->createUnit('Recipient', false);
        $item = $this->item();
        $response = $this->post($this->path(), ['holder' => ['unitId' => $other], 'items' => [$item], 'dueAt' => '2020-01-01T12:00:00Z']);
        self::assertStatus(201, $response);
        $loan = $response->decodedBody();
        self::assertSame(['unitId' => $other], $loan['holder']);
        self::assertSame(1, $this->get($this->path() . '?overdue=true')->decodedBody()['total']);
        self::assertSame(0, $this->get($this->path() . '?holderType=external')->decodedBody()['total']);
        $patched = $this->patch("/v1/loans/{$loan['id']}", ['dueAt' => null, 'note' => 'Long term']);
        self::assertStatus(200, $patched);
        self::assertNull($patched->decodedBody()['dueAt']);
        self::assertSame('Long term', $patched->decodedBody()['note']);
        self::assertSame(0, $this->get($this->path() . '?overdue=true')->decodedBody()['total']);
        self::assertError(422, 'validation_failed', $this->patch("/v1/loans/{$loan['id']}", ['holder' => ['personId' => $this->person]]));
        self::assertError(422, 'validation_failed', $this->get($this->path() . '?open=1'));
    }

    public function testMovementHistoryIncludesEachPartialReturnAndRespectsFilters(): void
    {
        $loan = $this->issue(['bulk' => [['stockId' => $this->stock, 'qty' => 2]]]);
        $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'returned', 'note' => 'Partial']]]);
        $history = $this->get("/v1/funds/{$this->fund}/movements?person={$this->person}");
        self::assertStatus(200, $history);
        self::assertSame(2, $history->decodedBody()['total']);
        self::assertSame(1, count(array_filter($history->decodedBody()['items'], static fn ($m) => $m['type'] === 'returned' && $m['note'] === 'Partial')));
        self::assertSame(0, $this->get("/v1/funds/{$this->fund}/movements?from=2099-01-01T00:00:00Z")->decodedBody()['total']);
        self::assertError(422, 'validation_failed', $this->get("/v1/funds/{$this->fund}/movements?from=yesterday"));
        self::assertSame(1, $this->get($this->path() . '?person=' . $this->person . '&holderType=external')->decodedBody()['total']);
    }

    public function testAuditFailureRollsBackIssue(): void
    {
        $item = $this->item();
        $this->issue(['items' => [$item]]);
        $this->db->exec("CREATE UNIQUE INDEX test_loan_audit_failure ON audit_log(action) WHERE action IN ('loan.issue', 'loan.return')");
        $second = $this->item();
        self::assertError(422, 'item_unavailable', $this->post($this->path(), $this->holder() + ['items' => [$second]]));
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_item_events')->fetchColumn());
    }

    public function testAuditFailureRollsBackReturnAndItsEvents(): void
    {
        $loan = $this->issue(['bulk' => [['stockId' => $this->stock, 'qty' => 2]]]);
        $line = ['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'returned'];
        self::assertStatus(200, $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line]]));
        $this->db->exec("CREATE UNIQUE INDEX test_loan_return_audit_failure ON audit_log(action) WHERE action = 'loan.return'");
        self::assertError(422, 'duplicate_name', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line]]));
        $current = $this->get("/v1/loans/{$loan['id']}")->decodedBody();
        self::assertSame(1, $current['lines'][0]['returnedQty']);
        self::assertNull($current['lines'][0]['closedAt']);
        self::assertSame(1, count($current['returns']));
        self::assertSame(1, $this->auditCount('loan.return'));
    }

    public function testLoanedStockCapacityAlsoProtectsCompositionWrites(): void
    {
        $this->issue(['bulk' => [['stockId' => $this->stock, 'qty' => 2]]]);
        $kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id) VALUES ({$this->fund}, {$this->kitSeries})");
        $result = $this->post("/v1/kits/$kit/composition", ['version' => 1, 'action' => 'add', 'bulkStockId' => $this->stock, 'requiredQty' => 1, 'presentQty' => 1]);
        self::assertError(422, 'insufficient_stock', $result);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_kit_bulk_lines')->fetchColumn());
        self::assertSame(0, $this->auditCount('kit.composition'));
    }

    public function testLostPieceIsRetiredWithoutClaimingPhysicalReturn(): void
    {
        $item = $this->item();
        $loan = $this->issue(['items' => [$item]]);
        $result = $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 0, 'closeType' => 'settled', 'note' => 'Lost permanently']]]);
        self::assertStatus(200, $result);
        self::assertSame(0, $result->decodedBody()['lines'][0]['returnedQty']);
        self::assertSame('settled', $result->decodedBody()['lines'][0]['closeType']);
        self::assertSame(1, $result->decodedBody()['returns'][0]['lostQty']);
        $piece = $this->db->query("SELECT retired_at, retire_reason, location FROM costume_items WHERE id = $item")->fetch();
        self::assertNotNull($piece['retired_at']);
        self::assertSame('Lost permanently', $piece['retire_reason']);
        self::assertSame('unknown', $piece['location']);
        self::assertError(422, 'item_unavailable', $this->post($this->path(), $this->holder() + ['items' => [$item]]));
    }

    public function testLostKitRibbonReducesTotalAndAllocationButPreservesRequiredSnapshot(): void
    {
        $kit = $this->kit();
        $loan = $this->issue(['kitId' => $kit]);
        $result = $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'settled', 'note' => 'One returned, one lost']]]);
        self::assertStatus(200, $result);
        self::assertSame(2, $result->decodedBody()['lines'][0]['qty']);
        self::assertSame(1, $result->decodedBody()['lines'][0]['returnedQty']);
        self::assertSame(1, $result->decodedBody()['returns'][0]['lostQty']);
        self::assertSame(1, $this->db->query('SELECT quantity_total FROM costume_bulk_stocks')->fetchColumn());
        self::assertSame(['required_qty' => 2, 'present_qty' => 1], $this->db->query('SELECT required_qty, present_qty FROM costume_kit_bulk_lines')->fetch());
        self::assertSame('unverified', $this->db->query("SELECT composition_state FROM costume_kits WHERE id = $kit")->fetchColumn());
        $stock = $this->get("/v1/funds/{$this->fund}/bulk-stocks")->decodedBody()['items'][0];
        self::assertSame(0, $stock['quantityAvailable']);
        self::assertSame(1, $stock['quantityReserved']);
        $movements = $this->get("/v1/funds/{$this->fund}/movements")->decodedBody()['items'];
        self::assertSame(1, array_values(array_filter($movements, static fn ($m) => $m['type'] === 'settled'))[0]['lostQty']);
    }

    public function testLossRequiresReasonAndCannotPretendReturnedCondition(): void
    {
        $loan = $this->issue(['items' => [$this->item()]]);
        $line = ['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 0, 'closeType' => 'settled'];
        self::assertError(422, 'validation_failed', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line]]));
        self::assertError(422, 'validation_failed', $this->post("/v1/loans/{$loan['id']}/return", ['lines' => [$line + ['note' => 'Lost', 'condition' => 'ok']]]));
        self::assertNull($this->get("/v1/loans/{$loan['id']}")->decodedBody()['lines'][0]['closedAt']);
        self::assertSame(0, $this->auditCount('loan.return'));
    }

    private function issue(array $body): array
    {
        $response = $this->post($this->path(), $this->holder() + $body);
        self::assertStatus(201, $response);
        return $response->decodedBody();
    }

    private function holder(): array
    {
        return ['holder' => ['personId' => $this->person]];
    }

    private function path(): string
    {
        return "/v1/funds/{$this->fund}/loans";
    }

    private function item(?int $kit = null): int
    {
        $value = $kit === null ? 'NULL' : (string) $kit;
        return $this->insert("INSERT INTO costume_items (unit_id, series_id, kit_id) VALUES ({$this->fund}, {$this->series}, $value)");
    }

    private function kit(): int
    {
        $id = $this->insert("INSERT INTO costume_kits (unit_id, series_id) VALUES ({$this->fund}, {$this->kitSeries})");
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, $id, {$this->stock}, 2, 2)");
        return $id;
    }

    private function insert(string $sql): int
    {
        return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn();
    }
}
