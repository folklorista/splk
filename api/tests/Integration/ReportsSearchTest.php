<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class ReportsSearchTest extends ApiTestCase
{
    private int $fund; private int $other; private int $actor; private int $series; private int $item; private int $person;
    protected function setUp(): void
    {
        parent::setUp(); $this->fund = $this->createUnit(); $this->other = $this->createUnit('Other'); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.view', $this->fund); $this->signInAs($this->actor);
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->fund}, 'Kopaničká košile', 'part', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, condition, acquired_on) VALUES ({$this->fund}, {$this->series}, '03', 'damaged', '2024-04-03')");
        $this->person = $this->insert("INSERT INTO persons (first_name, last_name, contact) VALUES ('Lojza', 'Papírový', 'Private phone')");
    }
    public function testReadersSeeTheSameFundReportsWithoutMutationOrSharedContactLeak(): void
    {
        $result = $this->get($this->url('series/' . $this->series)); self::assertStatus(200, $result); $data = $result->decodedBody();
        self::assertSame('03', $data['sections'][0]['rows'][0][2]); self::assertStringContainsString('fyzické ověření', $data['notice']);
        self::assertStatus(200, $this->get($this->url('person/' . $this->person))); self::assertStringNotContainsString('Private phone', $this->get($this->url('person/' . $this->person))->body);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn()); self::assertSame(0, $this->db->query('SELECT count(*) FROM audit_log')->fetchColumn());
    }
    public function testEverySpecificReportRejectsForeignAndMissingEntities(): void
    {
        self::assertError(404, 'not_found', $this->get("/v1/funds/{$this->other}/reports/item/{$this->item}"));
        foreach (['item', 'series', 'person', 'kit', 'inventory'] as $kind) self::assertError(404, 'not_found', $this->get($this->url("$kind/999999999")));
        $admin = $this->createAccount(email: 'admin@example.test'); $this->grant($admin, 'organization.admin'); $this->signInAs($admin);
        self::assertError(404, 'not_found', $this->get($this->url('items'))); self::assertError(403, 'forbidden', $this->get('/v1/search?q=košile'));
    }
    public function testFiltersAreValidatedAndDateBoundsAndRetirementAreHonored(): void
    {
        self::assertCount(1, $this->get($this->url('items') . '?condition=damaged&acquiredFrom=2024-01-01&acquiredTo=2024-12-31')->decodedBody()['sections'][0]['rows']);
        self::assertSame([], $this->get($this->url('items') . '?condition=ok')->decodedBody()['sections'][0]['rows']);
        $this->db->exec("UPDATE costume_items SET retired_at = now(), retired_by = {$this->actor}, retire_reason = 'Old' WHERE id = {$this->item}");
        self::assertSame([], $this->get($this->url('items') . '?retired=false')->decodedBody()['sections'][0]['rows']);
        self::assertCount(1, $this->get($this->url('items') . '?retired=true')->decodedBody()['sections'][0]['rows']);
        foreach (['retired=yes', 'condition=unknown', 'acquiredFrom=2026-02-31', 'acquiredFrom=2026-10-01&acquiredTo=2026-01-01', 'unknown=true'] as $query) self::assertError(422, 'validation_failed', $this->get($this->url('items') . '?' . $query));
    }
    public function testCsvIncludesAllRowsAndNeutralizesFormulasWithoutChangingJson(): void
    {
        $this->db->exec("UPDATE costume_series SET name = '=HYPERLINK(\"bad\")' WHERE id = {$this->series}");
        $this->db->exec("INSERT INTO costume_items (unit_id, series_id, number) SELECT {$this->fund}, {$this->series}, n::text FROM generate_series(1,205) AS n");
        $json = $this->get($this->url('items'))->decodedBody(); self::assertCount(206, $json['sections'][0]['rows']); self::assertSame('=HYPERLINK("bad")', $json['sections'][0]['rows'][0][1]);
        $csv = $this->send('GET', $this->url('items'), extraHeaders: ['Accept' => 'text/csv']); self::assertStatus(200, $csv); self::assertStringContainsString('text/csv', $csv->header('Content-Type'));
        self::assertStringStartsWith("\xEF\xBB\xBF", $csv->body); self::assertStringContainsString("'=HYPERLINK", $csv->body); self::assertStringContainsString(';205;', $csv->body);
    }
    public function testSearchUsesAccentInsensitiveTokensExactLiteralWildcardsAndFundScope(): void
    {
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->other}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->other}, 'Secret košile', 'part', $type)");
        $this->insert("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->other}, $series, '03')");
        $result = $this->get('/v1/search?q=kopanicka%20kosile%2003')->decodedBody(); self::assertSame(1, $result['total']); self::assertSame($this->item, $result['items'][0]['id']);
        self::assertSame(0, $this->get('/v1/search?q=Secret')->decodedBody()['total']); self::assertSame(0, $this->get('/v1/search?q=%25')->decodedBody()['total']);
        $person = $this->get('/v1/search?q=lojza')->decodedBody(); self::assertSame('person', $person['items'][0]['kind']); self::assertNull($person['items'][0]['unitId']); self::assertStringNotContainsString('Private phone', json_encode($person));
        self::assertError(404, 'not_found', $this->get('/v1/search?q=košile&fund=' . $this->other)); self::assertError(422, 'validation_failed', $this->get('/v1/search?q='));
    }
    public function testPaperProvenanceAndSubsequentReturnStayDistinctInHistoricalReports(): void
    {
        $this->grant($this->actor, 'costumes.manage', $this->fund);
        $import = $this->post("/v1/funds/{$this->fund}/people/{$this->person}/paper-migrations", ['entries' => [['itemId' => $this->item]]]); self::assertStatus(200, $import);
        $person = $this->get($this->url('person/' . $this->person))->decodedBody();
        self::assertStringContainsString('Převzato z papíru', $person['sections'][0]['rows'][0][6]); self::assertNull($person['sections'][0]['rows'][0][7]); self::assertNotNull($person['sections'][0]['rows'][0][8]);
        $loan = $this->get('/v1/loans/' . $import->decodedBody()['results'][0]['loanId'])->decodedBody();
        self::assertStatus(200, $this->post('/v1/loans/' . $loan['id'] . '/return', ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'returned']]]));
        $report = $this->get($this->url('item/' . $this->item)); self::assertStatus(200, $report); self::assertStringContainsString('Vrácení', $report->body);
        self::assertSame(0, $report->decodedBody()['sections'][2]['rows'][0][5]);
    }
    public function testKitReportAndKitSeriesDoNotAssertPhysicalPresence(): void
    {
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind) VALUES ({$this->fund}, 'Tašky', 'kit')");
        $kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, $series, 'A')");
        $this->db->exec("UPDATE costume_items SET kit_id = $kit WHERE id = {$this->item}");
        $report = $this->get($this->url("kit/$kit")); self::assertStatus(200, $report); self::assertStringContainsString('nikoli fyzické ověření', $report->body); self::assertSame($this->item, $report->decodedBody()['sections'][0]['rows'][0][0]);
        $bySeries = $this->get($this->url("series/$series")); self::assertStatus(200, $bySeries); self::assertSame($kit, $bySeries->decodedBody()['sections'][0]['rows'][0][0]);
        self::assertError(422, 'validation_failed', $this->get($this->url("series/$series") . '?condition=damaged'));
    }
    public function testClosedInventoryReportUsesFrozenEvidenceAfterPropertyChanges(): void
    {
        $this->grant($this->actor, 'costumes.manage', $this->fund);
        $inventory = $this->post("/v1/funds/{$this->fund}/inventories", ['name' => 'Autumn', 'scope' => []]); self::assertStatus(201, $inventory); $id = $inventory->decodedBody()['id'];
        $closed = $this->post("/v1/inventories/$id/close", ['version' => 1, 'closedWithIssues' => true, 'reason' => 'Unverified retained']); self::assertStatus(200, $closed);
        $first = $this->get($this->url("inventory/$id")); self::assertStatus(200, $first);
        $this->db->exec("UPDATE costume_items SET number = '99', condition = 'ok' WHERE id = {$this->item}");
        $second = $this->get($this->url("inventory/$id")); self::assertStatus(200, $second); self::assertSame($first->decodedBody()['sections'], $second->decodedBody()['sections']);
        self::assertStringContainsString('03', $second->body); self::assertNotEmpty($second->decodedBody()['sections'][2]['rows']);
    }
    public function testWorkOrderReportFiltersOpenWorkWithoutChangingTasks(): void
    {
        $this->grant($this->actor, 'costumes.manage', $this->fund);
        $created = $this->post("/v1/items/{$this->item}/work-orders", ['type' => 'repair', 'description' => 'Repair']); self::assertStatus(201, $created);
        $open = $this->get($this->url('work-orders') . '?status=active'); self::assertStatus(200, $open); self::assertCount(1, $open->decodedBody()['sections'][0]['rows']);
        self::assertSame([], $this->get($this->url('work-orders') . '?status=done')->decodedBody()['sections'][0]['rows']);
        self::assertError(422, 'validation_failed', $this->get($this->url('work-orders') . '?status=invalid'));
        self::assertSame('open', $this->db->query('SELECT status FROM costume_work_orders')->fetchColumn());
    }
    private function url(string $suffix): string { return "/v1/funds/{$this->fund}/reports/$suffix"; }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
