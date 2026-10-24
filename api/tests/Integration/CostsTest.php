<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class CostsTest extends ApiTestCase
{
    private int $fund; private int $other; private int $actor; private int $item; private int $kit; private int $stock;
    protected function setUp(): void
    {
        parent::setUp(); $this->fund = $this->createUnit(); $this->other = $this->createUnit('Other'); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->fund}, 'Shirts', 'part', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, description) VALUES ({$this->fund}, $series, '03', 'Linen shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind) VALUES ({$this->fund}, 'Kits', 'kit')");
        $this->kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, $series, 'A')");
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Ribbons', false)");
        $this->stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $type, 2)");
    }
    public function testSignedExactCostLinksDoNotMovePropertyOrMultiplyTheHeaderAmount(): void
    {
        $result = $this->create(['amount' => '-12345678901234.1234', 'currency' => 'EUR', 'links' => $this->links()]); self::assertStatus(201, $result); $cost = $result->decodedBody();
        self::assertSame('-12345678901234.1234', $cost['amount']); self::assertSame('EUR', $cost['currency']); self::assertSame($this->actor, $cost['createdBy']); self::assertSame(1, $cost['version']); self::assertCount(3, $cost['links']);
        self::assertSame('Linen shirt', array_values(array_filter($cost['links'], fn ($l) => $l['kind'] === 'item'))[0]['object']['description']);
        self::assertSame([['currency' => 'EUR', 'amount' => '-12345678901234.1234', 'count' => 1]], $this->get('/v1/costs')->decodedBody()['totals']);
        self::assertSame(2, $this->db->query("SELECT quantity_total FROM costume_bulk_stocks WHERE id = {$this->stock}")->fetchColumn());
        foreach (['costume_loans', 'costume_item_events', 'inventory_checks'] as $table) self::assertSame(0, $this->db->query("SELECT count(*) FROM $table")->fetchColumn());
        self::assertSame(1, $this->auditCount('cost.create')); self::assertSame('unknown', $this->get('/v1/items/' . $this->item)->decodedBody()['location']);
    }
    public function testTreasurerReadsAllFundsAndLinkedObjectsWithoutGainingOtherCostumeAccess(): void
    {
        $cost = $this->create(['links' => $this->links()])->decodedBody(); $this->seedOther('50.25', 'EUR'); $this->create(['amount' => '-20.1']);
        $treasurer = $this->createAccount(email: 'treasurer@example.test'); $this->grant($treasurer, 'costs.view'); $this->signInAs($treasurer);
        $list = $this->get('/v1/costs?limit=1'); self::assertStatus(200, $list); self::assertSame(3, $list->decodedBody()['total']); self::assertCount(1, $list->decodedBody()['items']);
        $funds = $this->get('/v1/costs/funds'); self::assertStatus(200, $funds); self::assertCount(2, $funds->decodedBody()['items']); self::assertFalse($funds->decodedBody()['items'][0]['canManage']);
        self::assertSame([['currency' => 'CZK', 'amount' => '79.9000', 'count' => 2], ['currency' => 'EUR', 'amount' => '50.2500', 'count' => 1]], $list->decodedBody()['totals']);
        $detail = $this->get('/v1/costs/' . $cost['id']); self::assertStatus(200, $detail);
        foreach ($detail->decodedBody()['links'] as $link) { self::assertArrayNotHasKey('holder', $link['object']); self::assertArrayNotHasKey('loanId', $link['object']); self::assertArrayNotHasKey('available', $link['object']); }
        self::assertError(404, 'not_found', $this->get('/v1/items/' . $this->item)); self::assertError(404, 'not_found', $this->get("/v1/funds/{$this->fund}/loans"));
        self::assertError(403, 'forbidden', $this->create()); self::assertError(403, 'forbidden', $this->patch('/v1/costs/' . $cost['id'], ['version' => 1, 'description' => 'Denied']));
    }
    public function testViewersStayFundScopedAndOrganizationAdministrationDoesNotGrantCosts(): void
    {
        $cost = $this->create()->decodedBody(); $foreign = $this->seedOther();
        $reader = $this->createAccount(email: 'reader@example.test'); $this->grant($reader, 'costumes.view', $this->fund); $this->signInAs($reader);
        self::assertSame(1, $this->get('/v1/costs')->decodedBody()['total']); self::assertStatus(200, $this->get('/v1/costs/' . $cost['id']));
        self::assertError(404, 'not_found', $this->get('/v1/costs/' . $foreign)); self::assertError(404, 'not_found', $this->get('/v1/costs?unitId=' . $this->other)); self::assertError(403, 'forbidden', $this->create());
        $admin = $this->createAccount(email: 'admin@example.test'); $this->grant($admin, 'organization.admin'); $this->signInAs($admin);
        self::assertError(403, 'forbidden', $this->get('/v1/costs')); self::assertError(404, 'not_found', $this->get('/v1/costs/' . $cost['id']));
    }
    public function testMalformedMoneyDatesAndLinksCannotCreatePartialEvidence(): void
    {
        foreach ([['amount' => 1.2], ['amount' => '1e3'], ['amount' => '1.12345'], ['amount' => '999999999999999'], ['currency' => 'eur'], ['currency' => "EUR\n"], ['spentOn' => '2026-02-31'], ['description' => ' '], ['links' => [['kind' => 'item', 'targetId' => $this->item, 'qty' => 2]]], ['links' => [$this->links()[0], $this->links()[0]]], ['createdBy' => $this->actor], ['links' => null]] as $body) self::assertError(422, 'validation_failed', $this->create($body));
        self::assertError(404, 'not_found', $this->create(['links' => [['kind' => 'item', 'targetId' => 999999999, 'qty' => 1]]]));
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->other}, 'Foreign shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->other}, 'Foreign shirts', 'part', $type)");
        $foreign = $this->insert("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->other}, $series)");
        self::assertError(404, 'not_found', $this->create(['links' => [['kind' => 'item', 'targetId' => $this->item, 'qty' => 1], ['kind' => 'item', 'targetId' => $foreign, 'qty' => 1]]]));
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_costs')->fetchColumn()); self::assertSame(0, $this->auditCount('cost.create'));
    }
    public function testPatchesPreserveIdentityAndUnchangedLinksAndRejectStaleVersions(): void
    {
        $initial = $this->create(['links' => $this->links()])->decodedBody(); $id = $initial['id'];
        $changed = $this->patch("/v1/costs/$id", ['version' => 1, 'amount' => '-20.25', 'currency' => 'EUR']); self::assertStatus(200, $changed);
        self::assertSame($initial['createdAt'], $changed->decodedBody()['createdAt']); self::assertSame($initial['links'], $changed->decodedBody()['links']); self::assertSame(2, $changed->decodedBody()['version']);
        self::assertError(409, 'version_conflict', $this->patch("/v1/costs/$id", ['version' => 1, 'links' => []]));
        $cleared = $this->patch("/v1/costs/$id", ['version' => 2, 'links' => [], 'documentRef' => 'Credit']); self::assertStatus(200, $cleared); self::assertSame([], $cleared->decodedBody()['links']);
        self::assertSame([['currency' => 'EUR', 'amount' => '-20.2500', 'count' => 1]], $this->get('/v1/costs')->decodedBody()['totals']); self::assertSame(2, $this->auditCount('cost.update'));
    }
    public function testAuditFailureRollsBackTheCostAndEveryLink(): void
    {
        $this->db->exec("CREATE UNIQUE INDEX test_cost_audit ON audit_log (unit_id) WHERE action = 'cost.create'"); $initial = $this->create()->decodedBody();
        self::assertError(422, 'duplicate_name', $this->create(['links' => $this->links()])); self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_costs')->fetchColumn()); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_cost_links')->fetchColumn());
        $this->db->exec("CREATE UNIQUE INDEX test_cost_update_audit ON audit_log (unit_id) WHERE action = 'cost.update'");
        self::assertStatus(200, $this->patch('/v1/costs/' . $initial['id'], ['version' => 1, 'description' => 'First edit']));
        self::assertError(422, 'duplicate_name', $this->patch('/v1/costs/' . $initial['id'], ['version' => 2, 'description' => 'Rejected', 'links' => $this->links()]));
        $after = $this->get('/v1/costs/' . $initial['id'])->decodedBody(); self::assertSame('First edit', $after['description']); self::assertSame(2, $after['version']); self::assertSame([], $after['links']);
    }
    public function testFiltersTotalsAndCsvCoverAllRowsAndEscapeUserFormulas(): void
    {
        $this->create(['description' => '=HYPERLINK("bad")', 'spentOn' => '2020-01-01']); $this->create(['amount' => '-25', 'currency' => 'EUR']);
        $this->db->exec("INSERT INTO costume_costs (unit_id, spent_on, amount, currency, description, created_by, updated_by) SELECT {$this->fund}, '2020-01-01', 1, 'CZK', 'Bulk import', {$this->actor}, {$this->actor} FROM generate_series(1,205)");
        $list = $this->get('/v1/costs?from=2020-01-01&to=2020-01-01&currency=CZK&limit=1'); self::assertStatus(200, $list); self::assertSame(206, $list->decodedBody()['total']); self::assertSame('305.0000', $list->decodedBody()['totals'][0]['amount']);
        $csv = $this->send('GET', '/v1/costs?from=2020-01-01&to=2020-01-01&currency=CZK&limit=1', extraHeaders: ['Accept' => 'text/csv']); self::assertStatus(200, $csv); self::assertStringContainsString($this->db->query("SELECT name FROM units WHERE id = {$this->fund}")->fetchColumn(), $csv->body); self::assertStringContainsString("'=HYPERLINK", $csv->body); self::assertSame(205, substr_count($csv->body, 'Bulk import'));
        self::assertSame(0, $this->get('/v1/costs?q=%25')->decodedBody()['total']); self::assertSame(1, $this->get('/v1/costs?currency=EUR')->decodedBody()['total']);
        self::assertStringContainsString(';-25.0000;EUR;', $this->send('GET', '/v1/costs?currency=EUR', extraHeaders: ['Accept' => 'text/csv'])->body);
        self::assertError(422, 'validation_failed', $this->get('/v1/costs?from=2021-01-01&to=2020-01-01'));
    }
    public function testArchivedFundsKeepCostEvidenceReadableButCannotReceiveNewWrites(): void
    {
        $cost = $this->create()->decodedBody(); $this->db->exec("UPDATE units SET archived_at = now() WHERE id = {$this->fund}");
        self::assertStatus(200, $this->get('/v1/costs/' . $cost['id'])); self::assertError(404, 'not_found', $this->create());
    }
    public function testRevocationTakesEffectWithoutCreatingANewSession(): void
    {
        $this->create(); $treasurer = $this->createAccount(email: 'treasurer@example.test'); $mandate = $this->grant($treasurer, 'costs.view'); $this->signInAs($treasurer);
        self::assertStatus(200, $this->get('/v1/costs')); $this->db->exec("UPDATE mandates SET revoked_at = now() WHERE id = $mandate"); self::assertError(403, 'forbidden', $this->get('/v1/costs'));
    }
    public function testLockUnavailableDuringWriteIsRetryableAndLeavesNoPartialCost(): void
    {
        $this->db->exec("CREATE FUNCTION test_cost_busy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Object is changing' USING ERRCODE = '55P03'; END $$; CREATE TRIGGER test_cost_busy BEFORE INSERT ON costume_costs FOR EACH ROW EXECUTE FUNCTION test_cost_busy()");
        self::assertError(409, 'cost_busy', $this->create(['links' => $this->links()])); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_costs')->fetchColumn()); self::assertSame(0, $this->auditCount('cost.create'));
        $this->db->exec('DROP TRIGGER test_cost_busy ON costume_costs'); self::assertStatus(201, $this->create());
    }
    private function links(): array { return [['kind' => 'item', 'targetId' => $this->item, 'qty' => 1], ['kind' => 'kit', 'targetId' => $this->kit, 'qty' => 1], ['kind' => 'bulk_stock', 'targetId' => $this->stock, 'qty' => 10]]; }
    private function create(array $patch = []): \Splk\Api\Http\Response { return $this->post("/v1/funds/{$this->fund}/costs", $patch + ['spentOn' => '2026-10-24', 'amount' => '100', 'currency' => 'CZK', 'description' => 'Purchase']); }
    private function seedOther(string $amount = '100', string $currency = 'CZK'): int { return $this->insert("INSERT INTO costume_costs (unit_id, spent_on, amount, currency, description, created_by, updated_by) VALUES ({$this->other}, current_date, '$amount', '$currency', 'Other', {$this->actor}, {$this->actor})"); }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
