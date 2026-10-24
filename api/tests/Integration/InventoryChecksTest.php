<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class InventoryChecksTest extends ApiTestCase
{
    private int $fund;
    private int $actor;
    private int $series;
    private int $item;
    private int $person;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirts')");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, {$this->series}, '03', 'store')");
    }

    public function testWarehouseBatchReportsEveryEntryAndNeverInflatesCoverage(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $entry = ['seriesId' => $this->series, 'number' => '03', 'result' => 'found'];
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [$entry, $entry, array_replace($entry, ['number' => '999'])]]);
        self::assertStatus(200, $response); $result = $response->decodedBody();
        self::assertSame(['ok', 'already_checked', 'unknown_number'], array_column($result['results'], 'code'));
        self::assertSame(1, $result['inventory']['progress']['verifiedQuantity']); self::assertSame(2, $result['inventory']['version']);
        self::assertSame(1, $this->get($url . '/checks')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('inventory.check'));
        $event = $this->get('/v1/items/' . $this->item . '/history')->decodedBody()['items'][0];
        self::assertSame('inventory_checked', $event['event']); self::assertSame('found', $event['data']['result']);
        self::assertError(409, 'version_conflict', $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [$entry]]));
    }

    public function testLoanAndLocationConflictsRequireSeparateExplicitOperations(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $loan = $this->loan();
        $entry = ['seriesId' => $this->series, 'number' => '03', 'result' => 'found', 'confirmConflict' => true, 'note' => 'Seen'];
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [$entry]]);
        self::assertStatus(200, $response); self::assertSame('loaned_to', $response->decodedBody()['results'][0]['code']);
        self::assertSame(['personId' => $this->person], $response->decodedBody()['results'][0]['context']['holder']);
        self::assertNull($this->db->query("SELECT closed_at FROM costume_loan_lines WHERE loan_id = $loan")->fetchColumn());
        self::assertSame(0, $this->get($url . '/checks')->decodedBody()['total']);
        $this->db->exec("UPDATE costume_loan_lines SET returned_qty = 1, closed_at = now(), closed_by = {$this->actor}, close_type = 'returned' WHERE loan_id = $loan");
        $this->db->exec("UPDATE costume_items SET location = 'repair' WHERE id = {$this->item}");
        $entry['confirmConflict'] = false;
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [$entry]]);
        self::assertSame('not_in_store', $response->decodedBody()['results'][0]['code']);
        $entry['confirmConflict'] = true;
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [$entry]]);
        self::assertSame('ok', $response->decodedBody()['results'][0]['code']);
        self::assertTrue($response->decodedBody()['results'][0]['check']['context']['confirmedLocationConflict']);
        self::assertSame('repair', $this->db->query("SELECT location FROM costume_items WHERE id = {$this->item}")->fetchColumn());
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loan_returns')->fetchColumn());
    }

    public function testPeopleObservationCapturesPresenterAndDoesNotPretendAbsenceIsALoss(): void
    {
        $loan = $this->loan(); $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $target = $this->get($url . '/targets')->decodedBody()['items'][0]['id'];
        $body = ['version' => 1, 'mode' => 'people', 'personId' => $this->person, 'entries' => [['targetId' => $target, 'result' => 'presented', 'condition' => 'damaged']]];
        $first = $this->post($url . '/checks', $body); self::assertStatus(200, $first);
        self::assertSame($this->person, $first->decodedBody()['results'][0]['check']['context']['personId']);
        self::assertSame($loan, $first->decodedBody()['results'][0]['check']['context']['loanId']);
        $body['version'] = 2; $body['entries'] = [['targetId' => $target, 'result' => 'not_presented']];
        $second = $this->post($url . '/checks', $body); self::assertStatus(200, $second);
        self::assertSame(1, $second->decodedBody()['inventory']['progress']['verifiedQuantity']);
        self::assertContains('not_presented', array_column($second->decodedBody()['inventory']['progress']['issues'], 'kind'));
        self::assertNull($this->db->query("SELECT retired_at FROM costume_items WHERE id = {$this->item}")->fetchColumn());
        self::assertNull($this->db->query("SELECT closed_at FROM costume_loan_lines WHERE loan_id = $loan")->fetchColumn());
        self::assertSame(2, $this->get($url . '/checks')->decodedBody()['total']);
    }

    public function testInvalidEntryRollsBackEarlierObservationsAndAuditInSameBatch(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $target = $this->get($url . '/targets')->decodedBody()['items'][0]['id'];
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [
            ['targetId' => $target, 'result' => 'found'], ['targetId' => $target, 'result' => 'found', 'checkedQty' => 1],
        ]]);
        self::assertError(422, 'validation_failed', $response);
        self::assertSame(0, $this->get($url . '/checks')->decodedBody()['total']);
        self::assertSame(1, $this->get($url)->decodedBody()['version']); self::assertSame(0, $this->auditCount('inventory.check'));
        self::assertSame(0, $this->db->query("SELECT count(*) FROM costume_item_events WHERE item_id = {$this->item}")->fetchColumn());
    }

    public function testBulkComparisonUsesRecordedContextWithoutAddingToPhysicalCoverage(): void
    {
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Ribbons', false)");
        $stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $type, 3)");
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $targets = $this->get($url . '/targets')->decodedBody()['items'];
        $target = array_values(array_filter($targets, static fn (array $t): bool => $t['bulkStockId'] === $stock))[0];
        $this->db->exec("UPDATE costume_bulk_stocks SET quantity_total = 4 WHERE id = $stock");
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [['targetId' => $target['id'], 'result' => 'found', 'checkedQty' => 4]]]);
        self::assertStatus(200, $response); $body = $response->decodedBody();
        self::assertSame(4, $body['results'][0]['check']['context']['expectedQty']);
        self::assertSame(1, $body['inventory']['progress']['expectedQuantity']); self::assertSame(0, $body['inventory']['progress']['verifiedQuantity']);
        self::assertSame(1, $body['inventory']['progress']['comparedBulkTargetCount']);
        self::assertNotContains('quantity_mismatch', array_column($body['inventory']['progress']['issues'], 'kind'));
        self::assertSame(3, $this->get($url . '/targets')->decodedBody()['items'][1]['expectedQty']);
    }

    private function create(): array
    {
        $response = $this->post('/v1/funds/' . $this->fund . '/inventories', ['name' => 'Autumn', 'scope' => (object) []]);
        self::assertStatus(201, $response); return $response->decodedBody();
    }

    public function testNumberLookupUsesCurrentIdentityWithoutExpandingTheFrozenScope(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $this->db->exec("UPDATE costume_items SET number = '04' WHERE id = {$this->item}");
        $this->db->exec("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, {$this->series}, '03', 'store')");
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'store', 'entries' => [
            ['seriesId' => $this->series, 'number' => '03', 'result' => 'found'],
            ['seriesId' => $this->series, 'number' => '04', 'result' => 'found'],
        ]]);
        self::assertStatus(200, $response);
        self::assertSame(['unknown_number', 'ok'], array_column($response->decodedBody()['results'], 'code'));
        self::assertSame(1, $this->get($url . '/targets')->decodedBody()['total']);
        self::assertSame('03', $this->get($url . '/targets')->decodedBody()['items'][0]['snapshot']['number']);
    }

    public function testKitCheckDoesNotReturnIndividuallyLoanedComponentsOrChangeRecordedCounts(): void
    {
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Bags')");
        $kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, $series, '1')");
        $this->db->exec("UPDATE costume_items SET kit_id = $kit WHERE id = {$this->item}");
        $this->loan();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Ribbons', false)");
        $stock = $this->insert("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $type, 3)");
        $allocation = $this->insert("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, $kit, $stock, 2, 2)");
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $targets = $this->get($url . '/targets')->decodedBody()['items'];
        $itemTarget = array_values(array_filter($targets, fn (array $t): bool => $t['itemId'] === $this->item))[0];
        $bulkTarget = array_values(array_filter($targets, static fn (array $t): bool => $t['bulkStockId'] === $stock && $t['contextKitId'] === $kit))[0];
        $response = $this->post($url . '/checks', ['version' => 1, 'mode' => 'kit', 'kitId' => $kit, 'entries' => [
            ['targetId' => $itemTarget['id'], 'result' => 'found'],
            ['targetId' => $bulkTarget['id'], 'result' => 'found', 'checkedQty' => 1],
        ]]);
        self::assertStatus(200, $response); $body = $response->decodedBody();
        self::assertSame(['loaned_to', 'ok'], array_column($body['results'], 'code'));
        self::assertSame(0, $body['inventory']['progress']['verifiedQuantity']);
        self::assertContains('quantity_mismatch', array_column($body['inventory']['progress']['issues'], 'kind'));
        self::assertSame(2, $this->db->query("SELECT present_qty FROM costume_kit_bulk_lines WHERE id = $allocation")->fetchColumn());
        self::assertSame('unverified', $this->db->query("SELECT composition_state FROM costume_kits WHERE id = $kit")->fetchColumn());
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loan_returns')->fetchColumn());
    }
    private function loan(): int
    {
        $id = $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by) VALUES ({$this->fund}, {$this->person}, {$this->actor})");
        $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $id, {$this->item}, 1)");
        return $id;
    }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
