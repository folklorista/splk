<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class KitsTest extends ApiTestCase
{
    private int $fund;
    private int $series;
    private int $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->account = $this->createAccount();
        $this->grant($this->account, 'costumes.manage', $this->fund);
        $this->signInAs($this->account);
        $this->series = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Kopaničké komplety') RETURNING id")->fetchColumn();
    }

    public function testCreateListUpdateAndNumberRules(): void
    {
        $kit = $this->kit('K1');
        self::assertSame('unverified', $kit['compositionState']);
        self::assertSame([], $kit['items']);
        self::assertSame([], $kit['bulkLines']);
        self::assertSame([], $kit['changes']);
        self::assertArrayNotHasKey('holder', $kit);
        self::assertSame(1, $this->get($this->url() . '?q=kopanicke&limit=1')->decodedBody()['total']);
        self::assertError(422, 'number_already_used', $this->post($this->url(), ['seriesId' => $this->series, 'number' => 'K1']));
        self::assertStatus(200, $this->patch('/v1/kits/' . $kit['id'], ['version' => 1, 'description' => 'Copied label', 'compositionState' => 'pending_check']));
        self::assertError(409, 'version_conflict', $this->patch('/v1/kits/' . $kit['id'], ['version' => 1, 'note' => 'Stale']));
        $this->db->exec("UPDATE costume_kits SET retired_at = now() WHERE id = {$kit['id']}");
        $this->db->exec("UPDATE costume_series SET allow_number_reuse = false WHERE id = {$this->series}");
        self::assertError(422, 'number_already_used', $this->post($this->url(), ['seriesId' => $this->series, 'number' => 'K1']));
        self::assertSame(1, $this->auditCount('kit.create'));
        self::assertSame(1, $this->auditCount('kit.update'));
    }

    public function testIntendedItemCanBeAddedMovedAndRemovedWithoutInventingPresence(): void
    {
        $source = $this->kit('K1');
        $target = $this->kit('K2');
        $item = $this->item();
        $added = $this->compose($source['id'], ['version' => 1, 'action' => 'add', 'itemId' => $item, 'itemVersion' => 1]);
        self::assertStatus(200, $added);
        self::assertSame('unverified', $added->decodedBody()['compositionState']);
        self::assertSame('unknown', $added->decodedBody()['items'][0]['location']);
        self::assertSame(2, $added->decodedBody()['items'][0]['version']);
        self::assertError(422, 'composition_conflict', $this->compose($target['id'], ['version' => 1, 'action' => 'add', 'itemId' => $item, 'itemVersion' => 2]));
        $move = ['version' => 2, 'action' => 'move', 'itemId' => $item, 'itemVersion' => 2, 'targetKitId' => $target['id'], 'targetVersion' => 1, 'note' => 'Relabelled'];
        self::assertStatus(200, $this->compose($source['id'], $move));
        $target = $this->get('/v1/kits/' . $target['id'])->decodedBody();
        self::assertSame(2, $target['version']);
        self::assertSame($item, $target['items'][0]['id']);
        self::assertSame('moved', $target['changes'][0]['change']);
        self::assertStatus(200, $this->compose($target['id'], ['version' => 2, 'action' => 'remove', 'itemId' => $item, 'itemVersion' => 3]));
        $itemState = $this->get('/v1/items/' . $item)->decodedBody();
        self::assertNull($itemState['kitId']);
        self::assertSame(4, $itemState['version']);
        self::assertSame('unknown', $itemState['location']);
        self::assertSame(3, $this->get('/v1/items/' . $item . '/history')->decodedBody()['total']);
        self::assertSame(4, $this->auditCount('kit.composition'));
    }

    public function testCompositionVersionChecksRejectEveryStaleParticipant(): void
    {
        $a = $this->kit('A');
        $b = $this->kit('B');
        $item = $this->item();
        self::assertError(409, 'version_conflict', $this->compose($a['id'], ['action' => 'add', 'version' => 9, 'itemId' => $item, 'itemVersion' => 1]));
        self::assertError(409, 'version_conflict', $this->compose($a['id'], ['action' => 'add', 'version' => 1, 'itemId' => $item, 'itemVersion' => 9]));
        self::assertStatus(200, $this->compose($a['id'], ['action' => 'add', 'version' => 1, 'itemId' => $item, 'itemVersion' => 1]));
        self::assertError(409, 'version_conflict', $this->compose($a['id'], ['action' => 'move', 'version' => 2, 'itemId' => $item, 'itemVersion' => 2, 'targetKitId' => $b['id'], 'targetVersion' => 9]));
        self::assertSame([], $this->get('/v1/kits/' . $b['id'])->decodedBody()['items']);
        self::assertSame(1, $this->auditCount('kit.composition'));
    }

    public function testBulkRequirementsPresenceAndPartialMoveAreIndependent(): void
    {
        $a = $this->kit('A');
        $b = $this->kit('B');
        $stock = $this->stock(3);
        $line = ['action' => 'add', 'bulkStockId' => $stock, 'requiredQty' => 5, 'presentQty' => 2, 'version' => 1];
        $added = $this->compose($a['id'], $line);
        self::assertStatus(200, $added);
        self::assertSame(5, $added->decodedBody()['bulkLines'][0]['requiredQty']);
        self::assertSame(2, $added->decodedBody()['bulkLines'][0]['presentQty']);
        self::assertSame('unverified', $added->decodedBody()['compositionState']);
        self::assertError(422, 'insufficient_stock', $this->compose($b['id'], array_replace($line, ['presentQty' => 2])));
        self::assertStatus(200, $this->compose($a['id'], ['action' => 'move', 'bulkStockId' => $stock, 'requiredQty' => 2, 'presentQty' => 1,
            'version' => 2, 'targetKitId' => $b['id'], 'targetVersion' => 1]));
        $source = $this->get('/v1/kits/' . $a['id'])->decodedBody();
        $target = $this->get('/v1/kits/' . $b['id'])->decodedBody();
        self::assertSame([3, 1], [$source['bulkLines'][0]['requiredQty'], $source['bulkLines'][0]['presentQty']]);
        self::assertSame([2, 1], [$target['bulkLines'][0]['requiredQty'], $target['bulkLines'][0]['presentQty']]);
        self::assertStatus(200, $this->compose($a['id'], ['action' => 'remove', 'version' => 3, 'bulkStockId' => $stock]));
        self::assertSame(1, $this->get('/v1/funds/' . $this->fund . '/bulk-stocks')->decodedBody()['items'][0]['quantityInKits']);
    }

    public function testAccumulatedQuantitiesCannotOverflowAndMissingQuantitiesCanBeRecorded(): void
    {
        $kit = $this->kit('K');
        $stock = $this->stock(0);
        self::assertStatus(200, $this->compose($kit['id'], ['version' => 1, 'action' => 'add', 'bulkStockId' => $stock, 'requiredQty' => 2147483647, 'presentQty' => 0]));
        self::assertError(422, 'validation_failed', $this->compose($kit['id'], ['version' => 2, 'action' => 'add', 'bulkStockId' => $stock, 'requiredQty' => 1, 'presentQty' => 0]));
        self::assertSame(2, $this->get('/v1/kits/' . $kit['id'])->decodedBody()['version']);
        self::assertSame(1, $this->auditCount('kit.composition'));
    }

    public function testChangingConfirmedCompositionRequiresNewCheck(): void
    {
        $kit = $this->kit('K');
        $this->patch('/v1/kits/' . $kit['id'], ['version' => 1, 'compositionState' => 'complete']);
        $response = $this->compose($kit['id'], ['version' => 2, 'action' => 'add', 'itemId' => $this->item(), 'itemVersion' => 1]);
        self::assertStatus(200, $response);
        self::assertSame('pending_check', $response->decodedBody()['compositionState']);
    }

    public function testMalformedOperationsAndRetiredItemsAreRejected(): void
    {
        $kit = $this->kit('K');
        $item = $this->item();
        foreach ([['action' => 'wrong'], ['action' => 'add', 'itemId' => $item, 'bulkStockId' => 1],
            ['action' => 'add', 'itemId' => $item, 'itemVersion' => 1, 'presentQty' => 1],
            ['action' => 'move', 'itemId' => $item, 'itemVersion' => 1, 'targetKitId' => $kit['id'], 'targetVersion' => 1],
            ['action' => 'remove', 'itemId' => $item, 'itemVersion' => 1]] as $data) {
            self::assertStatus(422, $this->compose($kit['id'], ['version' => 1] + $data));
        }
        $this->post('/v1/items/' . $item . '/retire', ['version' => 1, 'reason' => 'Old']);
        self::assertError(422, 'item_retired', $this->compose($kit['id'], ['version' => 1, 'action' => 'add', 'itemId' => $item, 'itemVersion' => 2]));
        self::assertSame(0, $this->auditCount('kit.composition'));
        self::assertSame([], $this->get('/v1/kits/' . $kit['id'])->decodedBody()['changes']);
    }

    public function testEveryEndpointEnforcesFundAndReadOnlyPermissions(): void
    {
        $kit = $this->kit('K');
        $reader = $this->createAccount(email: 'reader@example.test');
        $this->grant($reader, 'costumes.view', $this->fund);
        $this->signInAs($reader);
        self::assertStatus(200, $this->get($this->url()));
        self::assertStatus(200, $this->get('/v1/kits/' . $kit['id']));
        $this->writesDenied($kit['id'], 403, 'forbidden');
        $other = $this->createAccount(email: 'admin@example.test');
        $this->grant($other, 'organization.admin');
        $this->signInAs($other);
        self::assertError(404, 'not_found', $this->get($this->url()));
        self::assertError(404, 'not_found', $this->get('/v1/kits/' . $kit['id']));
        $this->writesDenied($kit['id'], 404, 'not_found');
        $this->signOut();
        self::assertError(401, 'unauthenticated', $this->get($this->url()));
        self::assertError(401, 'unauthenticated', $this->get('/v1/kits/' . $kit['id']));
        $this->writesDenied($kit['id'], 401, 'unauthenticated');
    }

    public function testCrossFundComponentsAndTargetsStayHidden(): void
    {
        $kit = $this->kit('K');
        $other = $this->createUnit('Other');
        $series = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ($other, 'kit', 'Other') RETURNING id")->fetchColumn();
        $foreign = (int) $this->db->query("INSERT INTO costume_kits (unit_id, series_id) VALUES ($other, $series) RETURNING id")->fetchColumn();
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $series]));
        $localItem = $this->item();
        self::assertError(404, 'not_found', $this->compose($kit['id'], ['version' => 1, 'action' => 'move', 'itemId' => $localItem, 'itemVersion' => 1, 'targetKitId' => $foreign, 'targetVersion' => 1]));
        $foreignItem = (int) $this->db->query("INSERT INTO costume_items (unit_id, series_id) VALUES ($other, $series) RETURNING id")->fetchColumn();
        self::assertError(404, 'not_found', $this->compose($kit['id'], ['version' => 1, 'action' => 'add', 'itemId' => $foreignItem, 'itemVersion' => 1]));
    }

    public function testLateAuditFailureRollsBackBothKitsAndItem(): void
    {
        $a = $this->kit('A');
        $b = $this->kit('B');
        $item = $this->item();
        $this->compose($a['id'], ['version' => 1, 'action' => 'add', 'itemId' => $item, 'itemVersion' => 1]);
        $this->db->exec("CREATE UNIQUE INDEX test_kit_audit ON audit_log (action, entity_id) WHERE action = 'kit.composition'");
        self::assertStatus(422, $this->compose($a['id'], ['version' => 2, 'action' => 'move', 'itemId' => $item, 'itemVersion' => 2, 'targetKitId' => $b['id'], 'targetVersion' => 1]));
        self::assertSame(2, $this->get('/v1/kits/' . $a['id'])->decodedBody()['version']);
        self::assertSame(1, $this->get('/v1/kits/' . $b['id'])->decodedBody()['version']);
        self::assertSame($a['id'], $this->get('/v1/items/' . $item)->decodedBody()['kitId']);
        self::assertSame(1, $this->get('/v1/items/' . $item . '/history')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('kit.composition'));
    }

    private function kit(string $number): array
    {
        $response = $this->post($this->url(), ['seriesId' => $this->series, 'number' => $number]);
        self::assertStatus(201, $response);
        return $response->decodedBody();
    }

    private function item(): int
    {
        $type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt') RETURNING id")->fetchColumn();
        $series = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type) RETURNING id")->fetchColumn();
        return (int) $this->db->query("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series) RETURNING id")->fetchColumn();
    }

    private function stock(int $total): int
    {
        $type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Ribbons', false) RETURNING id")->fetchColumn();
        return (int) $this->db->query("INSERT INTO costume_bulk_stocks (unit_id, part_type_id, quantity_total) VALUES ({$this->fund}, $type, $total) RETURNING id")->fetchColumn();
    }

    private function compose(int $id, array $body): \Splk\Api\Http\Response
    {
        return $this->post('/v1/kits/' . $id . '/composition', $body);
    }

    private function writesDenied(int $id, int $status, string $code): void
    {
        self::assertError($status, $code, $this->post($this->url(), ['seriesId' => $this->series]));
        self::assertError($status, $code, $this->patch('/v1/kits/' . $id, ['version' => 1]));
        self::assertError($status, $code, $this->compose($id, ['version' => 1, 'action' => 'add']));
    }

    private function url(): string
    {
        return '/v1/funds/' . $this->fund . '/kits';
    }
}
