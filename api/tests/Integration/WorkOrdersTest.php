<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class WorkOrdersTest extends ApiTestCase
{
    private int $fund;
    private int $item;
    private int $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->account = $this->createAccount();
        $this->grant($this->account, 'costumes.manage', $this->fund);
        $this->signInAs($this->account);
        $type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt') RETURNING id")->fetchColumn();
        $series = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type) RETURNING id")->fetchColumn();
        $this->item = (int) $this->db->query("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series) RETURNING id")->fetchColumn();
    }

    public function testWorkOrderLifecycleDoesNotChangeItemFacts(): void
    {
        $before = $this->get('/v1/items/' . $this->item)->decodedBody();
        $order = $this->create();
        self::assertSame('open', $order['status']);
        foreach (['in_progress', 'done', 'cancelled', 'open'] as $status) {
            self::assertStatus(200, $this->patch('/v1/work-orders/' . $order['id'], ['status' => $status, 'assignee' => 'Seamstress', 'dueOn' => '2026-11-01']));
        }
        self::assertSame($before, $this->get('/v1/items/' . $this->item)->decodedBody());
        self::assertSame(1, $this->get($this->url() . '?status=open')->decodedBody()['total']);
        self::assertSame(0, $this->get('/v1/funds/' . $this->fund . '/work-orders?status=done')->decodedBody()['total']);
        self::assertSame(5, $this->get('/v1/items/' . $this->item . '/history')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('work_order.create'));
        self::assertSame(4, $this->auditCount('work_order.update'));
    }

    public function testInvalidTypesStatesDatesAndEmptyDescriptionsAreRejected(): void
    {
        foreach ([['type' => 'washing'], ['description' => ' '], ['dueOn' => '2026-02-30'], ['status' => 'done'], ['itemId' => 1]] as $invalid) {
            self::assertError(422, 'validation_failed', $this->post($this->url(), array_replace(['type' => 'repair', 'description' => 'Button'], $invalid)));
        }
        $order = $this->create();
        self::assertError(422, 'validation_failed', $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'approved']));
        self::assertError(422, 'validation_failed', $this->get($this->url() . '?status=approved'));
        self::assertSame(0, $this->auditCount('work_order.update'));
    }

    public function testRetiredItemCannotReceiveNewOrdersButExistingOrderCanBeClosed(): void
    {
        $order = $this->create();
        $this->post('/v1/items/' . $this->item . '/retire', ['version' => 1, 'reason' => 'Old']);
        self::assertError(422, 'item_retired', $this->post($this->url(), ['type' => 'repair', 'description' => 'No']));
        self::assertStatus(200, $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'cancelled']));
        self::assertSame(1, $this->auditCount('work_order.create'));
    }

    public function testPermissionsCoverAllEndpoints(): void
    {
        $order = $this->create();
        $reader = $this->createAccount(email: 'reader@example.test');
        $this->grant($reader, 'costumes.view', $this->fund);
        $this->signInAs($reader);
        self::assertStatus(200, $this->get($this->url()));
        self::assertStatus(200, $this->get('/v1/funds/' . $this->fund . '/work-orders'));
        self::assertError(403, 'forbidden', $this->post($this->url(), ['type' => 'repair', 'description' => 'No']));
        self::assertError(403, 'forbidden', $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'done']));
        $other = $this->createAccount(email: 'admin@example.test');
        $this->grant($other, 'organization.admin');
        $this->signInAs($other);
        $this->denied($order['id'], 404, 'not_found');
        $this->signOut();
        $this->denied($order['id'], 401, 'unauthenticated');
    }

    public function testAuditFailureRollsBackOrderAndItemEvent(): void
    {
        $this->db->exec("CREATE UNIQUE INDEX test_order_audit ON audit_log (action) WHERE action IN ('work_order.create', 'work_order.update')");
        $order = $this->create();
        self::assertStatus(422, $this->post($this->url(), ['type' => 'repair', 'description' => 'Second']));
        self::assertSame(1, $this->get($this->url())->decodedBody()['total']);
        self::assertStatus(200, $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'done']));
        self::assertStatus(422, $this->patch('/v1/work-orders/' . $order['id'], ['status' => 'cancelled']));
        self::assertSame('done', $this->get($this->url())->decodedBody()['items'][0]['status']);
        self::assertSame(2, $this->get('/v1/items/' . $this->item . '/history')->decodedBody()['total']);
    }

    private function create(): array
    {
        $response = $this->post($this->url(), ['type' => 'repair', 'description' => 'Replace button']);
        self::assertStatus(201, $response);
        return $response->decodedBody();
    }

    private function denied(int $id, int $status, string $code): void
    {
        self::assertError($status, $code, $this->get($this->url()));
        self::assertError($status, $code, $this->get('/v1/funds/' . $this->fund . '/work-orders'));
        self::assertError($status, $code, $this->post($this->url(), ['type' => 'repair', 'description' => 'No']));
        self::assertError($status, $code, $this->patch('/v1/work-orders/' . $id, ['status' => 'done']));
    }

    private function url(): string
    {
        return '/v1/items/' . $this->item . '/work-orders';
    }
}
