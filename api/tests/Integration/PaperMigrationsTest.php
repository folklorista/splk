<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Infrastructure\Db\ConnectionFactory;

final class PaperMigrationsTest extends ApiTestCase
{
    private int $fund;
    private int $actor;
    private int $person;
    private int $series;
    private int $item;
    protected function setUp(): void
    {
        parent::setUp(); $this->fund = $this->createUnit(); $this->actor = $this->createAccount(); $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $this->person = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('Paper', 'Holder')");
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->fund}, 'Shirts', 'part', $type)");
        $this->item = $this->piece('03');
    }
    public function testMigrationReservesTheActualPieceWithoutInventingPhysicalIssueOrVerification(): void
    {
        $this->db->exec("UPDATE costume_items SET condition = 'damaged', issuable = false, location = 'unknown' WHERE id = {$this->item}");
        $result = $this->post($this->url(), ['entries' => [['itemId' => $this->item]], 'note' => 'Current paper custody']); self::assertStatus(200, $result);
        $entry = $result->decodedBody()['results'][0]; self::assertSame('migrated', $entry['status']);
        $loan = $this->get('/v1/loans/' . $entry['loanId'])->decodedBody(); self::assertSame('paper_migration', $loan['origin']);
        self::assertNull($loan['issuedAt']); self::assertNull($loan['issuedBy']); self::assertNull($loan['originalIssuedOn']);
        self::assertNotNull($loan['migratedAt']); self::assertSame($this->actor, $loan['migratedBy']);
        $item = $this->get('/v1/items/' . $this->item)->decodedBody(); self::assertFalse($item['available']); self::assertSame(['personId' => $this->person], $item['holder']);
        self::assertSame('unknown', $item['location']); self::assertSame('damaged', $item['condition']); self::assertFalse($item['issuable']); self::assertSame(1, $item['version']);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM inventory_checks')->fetchColumn());
        self::assertSame(['paper_migration'], $this->db->query('SELECT event FROM costume_item_events')->fetchAll(\PDO::FETCH_COLUMN));
        $movements = $this->get("/v1/funds/{$this->fund}/movements")->decodedBody()['items']; self::assertSame('paper_migration', $movements[0]['type']); self::assertSame($loan['migratedAt'], $movements[0]['at']);
        self::assertSame(1, $this->auditCount('loan.paper_migration')); self::assertSame(1, $this->auditCount('person.paper_migration'));
    }
    public function testKnownHistoricalDateIsSeparateAndRepeatingDoesNotCreateAnotherOpenHolding(): void
    {
        $body = ['entries' => [['seriesId' => $this->series, 'number' => '03', 'originalIssuedOn' => '2020-04-15']]];
        $first = $this->post($this->url(), $body); self::assertStatus(200, $first); $loanId = $first->decodedBody()['results'][0]['loanId'];
        self::assertSame('2020-04-15', $this->get("/v1/loans/$loanId")->decodedBody()['originalIssuedOn']);
        $second = $this->post($this->url(), $body); self::assertStatus(200, $second); self::assertSame('already_recorded', $second->decodedBody()['results'][0]['status']);
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn()); self::assertSame(1, $this->auditCount('loan.paper_migration'));
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_item_events')->fetchColumn());
        self::assertError(422, 'item_unavailable', $this->post("/v1/funds/{$this->fund}/loans", ['holder' => ['personId' => $this->person], 'items' => [$this->item]]));
    }
    public function testOrdinaryReturnPreservesProvenanceAndThenFreesThePiece(): void
    {
        $response = $this->post($this->url(), ['entries' => [['itemId' => $this->item]]]); $id = $response->decodedBody()['results'][0]['loanId'];
        $loan = $this->get("/v1/loans/$id")->decodedBody();
        $returned = $this->post("/v1/loans/$id/return", ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'returned']]]); self::assertStatus(200, $returned);
        self::assertSame('paper_migration', $returned->decodedBody()['origin']); self::assertNull($returned->decodedBody()['issuedAt']); self::assertSame($loan['migratedAt'], $returned->decodedBody()['migratedAt']);
        self::assertTrue($this->get('/v1/items/' . $this->item)->decodedBody()['available']);
        $types = array_column($this->get("/v1/funds/{$this->fund}/movements")->decodedBody()['items'], 'type'); sort($types); self::assertSame(['paper_migration', 'returned'], $types);
    }
    public function testConflictsMissingRetiredAndReusedNumbersRemainPersistentFindings(): void
    {
        $other = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('Other', 'Holder')");
        self::assertStatus(201, $this->post("/v1/funds/{$this->fund}/loans", ['holder' => ['personId' => $other], 'items' => [$this->item]]));
        $retired = $this->piece('7'); $this->db->exec("UPDATE costume_items SET retired_at = now(), retired_by = {$this->actor}, retire_reason = 'Old' WHERE id = $retired"); $this->piece('7');
        $result = $this->post($this->url(), ['entries' => [['itemId' => $this->item], ['seriesId' => $this->series, 'number' => '99'], ['seriesId' => $this->series, 'number' => '7'], ['itemId' => $retired]], 'note' => 'Needs clarification']);
        self::assertStatus(200, $result); self::assertSame(['conflict', 'not_found', 'ambiguous', 'item_retired'], array_column($result->decodedBody()['results'], 'status'));
        $findings = $this->get($this->url('paper-migration-findings') . '?limit=2')->decodedBody(); self::assertSame(4, $findings['total']); self::assertCount(2, $findings['items']);
        self::assertSame('Needs clarification', $findings['items'][0]['note']); self::assertSame(['personId' => $other], $this->get('/v1/items/' . $this->item)->decodedBody()['holder']);
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn()); self::assertSame(0, $this->auditCount('loan.paper_migration'));
        self::assertStatus(200, $this->send('PUT', "/v1/funds/{$this->fund}/people/{$this->person}/profile", ['paperState' => 'digital', 'note' => 'Unresolved conversion findings retained']));
        self::assertSame(4, $this->get($this->url('paper-migration-findings'))->decodedBody()['total']);
    }
    public function testForeignReadOnlyAndMalformedRequestsCannotMutateEvidence(): void
    {
        foreach ([['entries' => []], ['entries' => [['itemId' => $this->item, 'originalIssuedOn' => '2026-02-31']]], ['entries' => [['itemId' => $this->item], ['itemId' => $this->item]]], ['entries' => [['itemId' => $this->item]], 'issuedAt' => '2000-01-01']] as $body) self::assertError(422, 'validation_failed', $this->post($this->url(), $body));
        $reader = $this->createAccount(email: 'reader@example.test'); $this->grant($reader, 'costumes.view', $this->fund); $this->signInAs($reader);
        self::assertStatus(200, $this->get($this->url('paper-migration-findings'))); self::assertError(403, 'forbidden', $this->post($this->url(), ['entries' => [['itemId' => $this->item]]]));
        $admin = $this->createAccount(email: 'admin@example.test'); $this->grant($admin, 'organization.admin'); $this->signInAs($admin);
        self::assertError(404, 'not_found', $this->get($this->url('paper-migration-findings'))); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
    }
    public function testAuditFailureRollsBackImportsFindingsAndEventsTogether(): void
    {
        $this->db->exec("CREATE UNIQUE INDEX test_paper_migration_audit ON audit_log (unit_id) WHERE action = 'person.paper_migration'");
        self::assertStatus(200, $this->post($this->url(), ['entries' => [['seriesId' => $this->series, 'number' => 'Missing']]]));
        $response = $this->post($this->url(), ['entries' => [['itemId' => $this->item], ['seriesId' => $this->series, 'number' => 'Another missing']]]);
        self::assertError(422, 'duplicate_name', $response); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame(1, $this->db->query('SELECT count(*) FROM costume_paper_migration_findings')->fetchColumn()); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_item_events')->fetchColumn());
    }
    public function testConcurrentPropertyChangeReturnsRetryableConflictWithoutPartialImport(): void
    {
        $other = ConnectionFactory::create(self::settings((getenv('DB_NAME') ?: 'splk') . '_test')); $other->beginTransaction();
        try { $other->exec('LOCK TABLE costume_items IN ROW EXCLUSIVE MODE'); self::assertError(409, 'paper_migration_busy', $this->post($this->url(), ['entries' => [['itemId' => $this->item]]])); }
        finally { $other->rollBack(); }
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn()); self::assertStatus(200, $this->post($this->url(), ['entries' => [['itemId' => $this->item]]]));
    }
    public function testMigrationRoundTripPreservesOrdinaryLoansAndRefusesLossOfImportedEvidence(): void
    {
        self::assertStatus(201, $this->post("/v1/funds/{$this->fund}/loans", ['holder' => ['personId' => $this->person], 'items' => [$this->item]]));
        $before = $this->db->query('SELECT id, issued_at, issued_by FROM costume_loans')->fetchAll();
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024233000_add_paper_migration_provenance.php';
        $migration = new \AddPaperMigrationProvenance('testing', 20261024233000);
        $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]));
        $migration->down(); $migration->up();
        self::assertSame($before, $this->db->query('SELECT id, issued_at, issued_by FROM costume_loans')->fetchAll());
        self::assertSame('handover', $this->db->query('SELECT origin FROM costume_loans')->fetchColumn());
        self::assertStatus(200, $this->post($this->url(), ['entries' => [['itemId' => $this->piece('04')]]]));
        try { \Splk\Api\Infrastructure\Db\Transaction::run($this->db, fn () => $migration->down()); self::fail('Evidence rollback accepted'); }
        catch (\PDOException $error) { self::assertSame('55000', $error->getCode()); }
        self::assertSame(1, $this->db->query("SELECT count(*) FROM costume_loans WHERE origin = 'paper_migration' AND issued_at IS NULL")->fetchColumn());
    }
    public function testDatabaseRejectsFakeIssueDatesAndIncompleteMigrationProvenance(): void
    {
        $result = $this->post($this->url(), ['entries' => [['itemId' => $this->item]]]);
        $id = $result->decodedBody()['results'][0]['loanId'];
        foreach (["issued_at = now()", "issued_by = {$this->actor}", 'migrated_at = NULL', 'migrated_by = NULL', "origin = 'unknown'"] as $assignment) {
            try { \Splk\Api\Infrastructure\Db\Transaction::run($this->db, fn () => $this->db->exec("UPDATE costume_loans SET $assignment WHERE id = $id")); self::fail('Invalid provenance accepted'); }
            catch (\PDOException $error) { self::assertSame('23514', $error->getCode()); }
        }
    }
    private function url(string $suffix = 'paper-migrations'): string { return "/v1/funds/{$this->fund}/people/{$this->person}/$suffix"; }
    private function piece(string $number): int { return $this->insert("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->fund}, {$this->series}, '$number')"); }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
