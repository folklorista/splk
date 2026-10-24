<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class InventoryOperationsTest extends ApiTestCase
{
    private int $fund;
    private int $person;
    private int $item;
    private int $otherItem;
    private int $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $actor = $this->createAccount();
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = $actor")->fetchColumn();
        $this->grant($actor, 'costumes.manage', $this->fund); $this->signInAs($actor);
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirts')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, $series, '1', 'store')");
        $this->otherItem = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, $series, '2', 'store')");
        $response = $this->post('/v1/funds/' . $this->fund . '/inventories', ['name' => 'Movements', 'scope' => (object) []]);
        self::assertStatus(201, $response); $this->inventory = $response->decodedBody()['id'];
    }

    public function testOrdinaryIssueAndReturnPreserveInventoryContextWithoutPhysicalChecks(): void
    {
        $issued = $this->post($this->loans(), $this->issue() + $this->context(1));
        self::assertStatus(201, $issued); $loan = $issued->decodedBody();
        self::assertSame($this->inventory, $loan['lines'][0]['inventoryId']);
        $response = $this->post('/v1/loans/' . $loan['id'] . '/return', ['lines' => [['lineId' => $loan['lines'][0]['id'], 'returnedQty' => 1, 'closeType' => 'returned']]] + $this->context(2));
        self::assertStatus(200, $response); self::assertSame($this->inventory, $response->decodedBody()['returns'][0]['inventoryId']);
        self::assertSame(3, $this->get($this->url())->decodedBody()['version']);
        self::assertSame(0, $this->get($this->url())->decodedBody()['progress']['verifiedQuantity']);
        self::assertSame(0, $this->get($this->url() . '/checks')->decodedBody()['total']);
        $movements = $this->get($this->url() . '/movements')->decodedBody();
        self::assertSame(2, $movements['total']); self::assertSame([$this->inventory, $this->inventory], array_column($movements['items'], 'inventoryId'));
        self::assertSame($movements, $this->get('/v1/funds/' . $this->fund . '/movements?inventoryId=' . $this->inventory)->decodedBody());
        self::assertNull($this->get($this->url() . '/targets')->decodedBody()['items'][0]['holderPersonId']);
    }

    public function testExchangeLinksBothSidesAndDoesNotSilentlyChangeFrozenTargets(): void
    {
        $loan = $this->post($this->loans(), $this->issue())->decodedBody();
        $response = $this->post('/v1/loans/' . $loan['id'] . '/exchange', ['lineId' => $loan['lines'][0]['id'], 'itemId' => $this->otherItem] + $this->context(1));
        self::assertStatus(201, $response); self::assertSame($this->inventory, $response->decodedBody()['lines'][0]['inventoryId']);
        $old = $this->get('/v1/loans/' . $loan['id'])->decodedBody();
        self::assertNull($old['lines'][0]['inventoryId']); self::assertSame($this->inventory, $old['returns'][0]['inventoryId']);
        self::assertSame(2, $this->get($this->url() . '/targets')->decodedBody()['total']);
        self::assertSame(2, $this->get($this->url() . '/movements')->decodedBody()['total']);
    }

    public function testWorkOrderCanContinueAfterClosureWithoutRewritingTheInventoryResult(): void
    {
        $response = $this->post('/v1/items/' . $this->item . '/work-orders', ['type' => 'repair', 'description' => 'Seam'] + $this->context(1));
        self::assertStatus(201, $response); $order = $response->decodedBody();
        self::assertSame($this->inventory, $order['inventoryId']);
        self::assertSame('Seam', $this->get($this->url() . '/work-orders')->decodedBody()['items'][0]['description']);
        $closed = $this->post($this->url() . '/close', ['version' => 2, 'closedWithIssues' => true, 'reason' => 'Repair remains open']);
        self::assertStatus(200, $closed);
        self::assertStatus(200, $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'done']));
        self::assertSame($closed->decodedBody(), $this->get($this->url())->decodedBody());
        self::assertSame('open', $this->get($this->url() . '/work-orders')->decodedBody()['items'][0]['status']);
        self::assertError(409, 'inventory_closed', $this->post('/v1/items/' . $this->item . '/work-orders', ['type' => 'repair', 'description' => 'Later'] + $this->context(3)));
    }

    public function testStaleMissingForeignAndClosedContextNeverPartiallyIssuesProperty(): void
    {
        self::assertError(409, 'version_conflict', $this->post($this->loans(), $this->issue() + $this->context(2)));
        self::assertError(422, 'validation_failed', $this->post($this->loans(), $this->issue() + ['inventoryId' => $this->inventory]));
        $foreign = $this->createUnit('Foreign');
        $actor = $this->db->query('SELECT id FROM user_accounts ORDER BY id LIMIT 1')->fetchColumn();
        $inventory = $this->insert("INSERT INTO inventories (unit_id, name, started_by) VALUES ($foreign, 'Foreign', $actor)");
        self::assertError(404, 'not_found', $this->post($this->loans(), $this->issue() + ['inventoryId' => $inventory, 'inventoryVersion' => 1]));
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
        self::assertSame(0, $this->auditCount('loan.issue')); self::assertSame(1, $this->get($this->url())->decodedBody()['version']);
        self::assertStatus(200, $this->post($this->url() . '/close', ['version' => 1, 'closedWithIssues' => true, 'reason' => 'Stop']));
        self::assertError(409, 'inventory_closed', $this->post($this->loans(), $this->issue() + $this->context(2)));
        self::assertStatus(201, $this->post($this->loans(), $this->issue()));
    }

    public function testRejectedMovementRollsBackInventoryVersionAndAudit(): void
    {
        self::assertStatus(201, $this->post($this->loans(), $this->issue()));
        self::assertError(422, 'item_unavailable', $this->post($this->loans(), $this->issue() + $this->context(1)));
        self::assertSame(1, $this->get($this->url())->decodedBody()['version']);
        self::assertSame(0, $this->get($this->url() . '/movements')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('loan.issue'));
    }

    private function context(int $version): array { return ['inventoryId' => $this->inventory, 'inventoryVersion' => $version]; }
    private function url(): string { return '/v1/inventories/' . $this->inventory; }
    private function loans(): string { return '/v1/funds/' . $this->fund . '/loans'; }
    private function issue(): array { return ['holder' => ['personId' => $this->person], 'items' => [$this->item]]; }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
