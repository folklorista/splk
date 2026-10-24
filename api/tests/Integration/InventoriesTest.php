<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Domain\Costumes\InventoryRepository;

final class InventoriesTest extends ApiTestCase
{
    private int $fund;
    private int $actor;
    private int $series;
    private int $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirts')");
        $this->series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        $this->item = $this->newItem('3');
    }

    public function testPreviewHasNoWritesAndCreationFreezesItsTargetsWithAudit(): void
    {
        $preview = $this->post($this->base() . '/preview', ['scope' => (object) []]);
        self::assertStatus(200, $preview); self::assertSame(1, $preview->decodedBody()['unloanedItemCount']);
        self::assertSame(0, $this->db->query('SELECT count(*) FROM inventories')->fetchColumn());
        self::assertSame(0, $this->auditCount('inventory.create'));
        $inventory = $this->create();
        self::assertSame(1, $inventory['progress']['expectedQuantity']); self::assertSame(0, $inventory['progress']['verifiedQuantity']);
        self::assertSame(1, $this->auditCount('inventory.create'));
        $this->newItem('4');
        $page = $this->get('/v1/inventories/' . $inventory['id'] . '/targets?limit=1')->decodedBody();
        self::assertSame(1, $page['total']); self::assertSame($this->item, $page['items'][0]['itemId']);
        self::assertSame(1, $this->get($this->base())->decodedBody()['total']);
    }

    public function testExplicitAdditionNeedsANoteAndVersionAndRejectsDuplicates(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'] . '/targets';
        $item = $this->newItem('4');
        self::assertError(422, 'validation_failed', $this->post($url, ['version' => 1, 'itemId' => $item]));
        self::assertError(409, 'version_conflict', $this->post($url, ['version' => 2, 'itemId' => $item, 'note' => 'New acquisition']));
        $added = $this->post($url, ['version' => 1, 'itemId' => $item, 'note' => 'New acquisition']);
        self::assertStatus(201, $added); self::assertSame(2, $added->decodedBody()['version']);
        self::assertError(422, 'inventory_target_exists', $this->post($url, ['version' => 2, 'itemId' => $item, 'note' => 'Again']));
        $rows = $this->get($url)->decodedBody()['items'];
        self::assertTrue($rows[1]['addedExplicitly']); self::assertSame('New acquisition', $rows[1]['note']);
        self::assertSame(1, $this->auditCount('inventory.add_target'));
    }

    public function testForeignAndReadOnlyAccessNeverLeaksOrChangesTheInventory(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $reader = $this->createAccount(email: 'reader@example.test'); $this->grant($reader, 'costumes.view', $this->fund);
        $this->signInAs($reader); self::assertStatus(200, $this->get($url));
        self::assertError(403, 'forbidden', $this->post($url . '/close', ['version' => 1, 'closedWithIssues' => true, 'reason' => 'Missing']));
        self::assertError(403, 'forbidden', $this->post($this->base() . '/preview', ['scope' => (object) []]));
        $other = $this->createAccount(email: 'other@example.test'); $this->grant($other, 'costumes.manage', $this->createUnit('Other'));
        $this->signInAs($other);
        foreach (['', '/targets', '/checks', '/issues', '/slots', '/visits'] as $suffix) self::assertError(404, 'not_found', $this->get($url . $suffix));
        self::assertError(404, 'not_found', $this->post($url . '/close', ['version' => 1, 'closedWithIssues' => true, 'reason' => 'Missing']));
        self::assertSame(0, $this->auditCount('inventory.close'));
    }

    public function testClosureRequiresResolvedIssuesOrReasonAndKeepsImmutableReads(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        self::assertError(422, 'inventory_has_issues', $this->post($url . '/close', ['version' => 1, 'closedWithIssues' => false]));
        self::assertError(422, 'validation_failed', $this->post($url . '/close', ['version' => 1, 'closedWithIssues' => true]));
        $closed = $this->post($url . '/close', ['version' => 1, 'closedWithIssues' => true, 'reason' => 'Piece not located']);
        self::assertStatus(200, $closed); self::assertSame('closed', $closed->decodedBody()['status']);
        $targets = $this->get($url . '/targets')->decodedBody();
        $this->db->exec("UPDATE costume_items SET condition = 'damaged', number = 'Changed' WHERE id = {$this->item}");
        self::assertSame($targets, $this->get($url . '/targets')->decodedBody());
        self::assertSame($closed->decodedBody(), $this->get($url)->decodedBody());
        self::assertError(409, 'inventory_closed', $this->post($url . '/targets', ['version' => 2, 'itemId' => $this->item, 'note' => 'Late']));
        self::assertSame(1, $this->auditCount('inventory.close'));
    }

    public function testCancellingAnObservationPreservesItsHistoryAndUsesHeaderVersion(): void
    {
        $inventory = $this->create(); $url = '/v1/inventories/' . $inventory['id'];
        $target = $this->get($url . '/targets')->decodedBody()['items'][0];
        $repository = new InventoryRepository($this->db);
        $check = $repository->addCheck($this->fund, $inventory['id'], $target['id'], 'store', 'found', null, null, null, $this->actor);
        self::assertError(409, 'version_conflict', $this->delete("/v1/inventory-checks/$check?version=2"));
        self::assertStatus(200, $this->delete("/v1/inventory-checks/$check?version=1"));
        self::assertSame(0, $this->get($url)->decodedBody()['progress']['verifiedQuantity']);
        $checks = $this->get($url . '/checks')->decodedBody();
        self::assertSame(1, $checks['total']); self::assertNotNull($checks['items'][0]['cancelledAt']);
        self::assertSame(1, $this->auditCount('inventory.cancel_check'));
    }

    public function testMalformedAndCrossFundScopeCannotCreateInventoryOrAudit(): void
    {
        foreach ([['scope' => 'all'], ['scope' => ['gender' => 'all']], ['scope' => ['groupId' => 0]], ['scope' => [], 'extra' => 1]] as $body) {
            self::assertError(422, 'validation_failed', $this->post($this->base(), ['name' => 'Bad'] + $body));
        }
        self::assertSame(0, $this->auditCount('inventory.create'));
        self::assertError(422, 'validation_failed', $this->get($this->base() . '?limit=201'));
        $this->signOut(); self::assertError(401, 'unauthenticated', $this->get($this->base()));
    }

    private function create(): array
    {
        $response = $this->post($this->base(), ['name' => 'Autumn', 'scope' => (object) []]);
        self::assertStatus(201, $response); return $response->decodedBody();
    }
    private function base(): string { return '/v1/funds/' . $this->fund . '/inventories'; }
    private function newItem(string $number): int
    {
        return $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, {$this->series}, '$number', 'store')");
    }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
