<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class BulkStocksTest extends ApiTestCase
{
    private int $fund;
    private int $type;
    private int $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->account = $this->createAccount();
        $this->grant($this->account, 'costumes.manage', $this->fund);
        $this->signInAs($this->account);
        $this->type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ({$this->fund}, 'Mašle', false) RETURNING id")->fetchColumn();
    }

    public function testCreateListAndUpdate(): void
    {
        $stock = $this->create();
        self::assertSame(5, $stock['quantityTotal']);
        self::assertSame(0, $stock['quantityInKits']);
        self::assertArrayNotHasKey('available', $stock);
        $list = $this->get($this->url() . '?limit=1&offset=0');
        self::assertStatus(200, $list);
        self::assertSame(1, $list->decodedBody()['total']);
        self::assertSame($stock, $list->decodedBody()['items'][0]);
        $updated = $this->patch('/v1/bulk-stocks/' . $stock['id'], ['quantityTotal' => 0, 'note' => 'Count corrected']);
        self::assertStatus(200, $updated);
        self::assertSame(0, $updated->decodedBody()['quantityTotal']);
        self::assertSame('Count corrected', $updated->decodedBody()['note']);
        self::assertSame(1, $this->auditCount('bulk_stock.create'));
        self::assertSame(1, $this->auditCount('bulk_stock.update'));
    }

    public function testQuantitiesAreStrictIntegersAndIdentityCannotChange(): void
    {
        foreach ([-1, 1.5, '2', true, null, 2147483648] as $quantity) {
            self::assertError(422, 'validation_failed', $this->post($this->url(), ['partTypeId' => $this->type, 'quantityTotal' => $quantity]));
        }
        $stock = $this->create();
        self::assertError(422, 'validation_failed', $this->patch('/v1/bulk-stocks/' . $stock['id'], ['partTypeId' => $this->type]));
        self::assertError(422, 'validation_failed', $this->get($this->url() . '?available=true'));
        self::assertError(422, 'validation_failed', $this->get($this->url() . '?limit=201'));
        self::assertSame(0, $this->auditCount('bulk_stock.update'));
    }

    public function testDuplicateStockDoesNotCreateOrOverwriteAnything(): void
    {
        $stock = $this->create(['variant' => 'White']);
        self::assertError(422, 'duplicate_stock', $this->post($this->url(), ['partTypeId' => $this->type, 'variant' => 'white', 'quantityTotal' => 20]));
        $other = $this->create(['variant' => null]);
        self::assertError(422, 'duplicate_stock', $this->patch('/v1/bulk-stocks/' . $other['id'], ['variant' => 'White']));
        $list = $this->get($this->url())->decodedBody();
        self::assertSame(2, $list['total']);
        self::assertSame(2, $this->auditCount('bulk_stock.create'));
        self::assertSame(0, $this->auditCount('bulk_stock.update'));
    }

    public function testOnlyActiveUnnumberedTypesInSameFundAreAccepted(): void
    {
        $other = $this->createUnit('Other');
        $foreign = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name, numbered) VALUES ($other, 'Other', false) RETURNING id")->fetchColumn();
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['partTypeId' => $foreign, 'quantityTotal' => 0]));
        $this->db->exec("UPDATE costume_part_types SET numbered = true WHERE id = {$this->type}");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['partTypeId' => $this->type, 'quantityTotal' => 0]));
        $this->db->exec("UPDATE costume_part_types SET numbered = false, archived_at = now() WHERE id = {$this->type}");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['partTypeId' => $this->type, 'quantityTotal' => 0]));
    }

    public function testCannotReduceTotalBelowRecordedKitAllocation(): void
    {
        $stock = $this->create();
        $series = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Kits') RETURNING id")->fetchColumn();
        $kit = (int) $this->db->query("INSERT INTO costume_kits (unit_id, series_id) VALUES ({$this->fund}, $series) RETURNING id")->fetchColumn();
        $this->db->exec("INSERT INTO costume_kit_bulk_lines (unit_id, kit_id, bulk_stock_id, required_qty, present_qty) VALUES ({$this->fund}, $kit, {$stock['id']}, 5, 3)");
        self::assertError(422, 'insufficient_stock', $this->patch('/v1/bulk-stocks/' . $stock['id'], ['quantityTotal' => 2]));
        self::assertSame(0, $this->auditCount('bulk_stock.update'));
        $updated = $this->patch('/v1/bulk-stocks/' . $stock['id'], ['quantityTotal' => 3]);
        self::assertStatus(200, $updated);
        self::assertSame(3, $updated->decodedBody()['quantityInKits']);
        self::assertSame('unverified', $this->db->query("SELECT composition_state FROM costume_kits WHERE id = $kit")->fetchColumn());
        self::assertError(422, 'validation_failed', $this->patch('/v1/funds/' . $this->fund . '/part-types/' . $this->type, ['numbered' => true]));
    }

    public function testPermissionsCoverAllEndpoints(): void
    {
        $stock = $this->create();
        $reader = $this->createAccount(email: 'reader@example.test');
        $this->grant($reader, 'costumes.view', $this->fund);
        $this->signInAs($reader);
        self::assertStatus(200, $this->get($this->url()));
        self::assertError(403, 'forbidden', $this->post($this->url(), ['partTypeId' => $this->type, 'quantityTotal' => 1]));
        self::assertError(403, 'forbidden', $this->patch('/v1/bulk-stocks/' . $stock['id'], ['note' => 'No']));
        $outsider = $this->createAccount(email: 'admin@example.test');
        $this->grant($outsider, 'organization.admin');
        $this->signInAs($outsider);
        $this->denied($stock['id'], 404, 'not_found');
        $this->signOut();
        $this->denied($stock['id'], 401, 'unauthenticated');
    }

    public function testAuditFailureRollsBackStockChanges(): void
    {
        $this->db->exec("CREATE UNIQUE INDEX test_stock_audit ON audit_log (action) WHERE action IN ('bulk_stock.create', 'bulk_stock.update')");
        $stock = $this->create();
        self::assertStatus(422, $this->post($this->url(), ['partTypeId' => $this->type, 'variant' => 'Other', 'quantityTotal' => 1]));
        self::assertSame(1, $this->get($this->url())->decodedBody()['total']);
        self::assertStatus(200, $this->patch('/v1/bulk-stocks/' . $stock['id'], ['quantityTotal' => 6]));
        self::assertStatus(422, $this->patch('/v1/bulk-stocks/' . $stock['id'], ['quantityTotal' => 7]));
        self::assertSame(6, $this->get($this->url())->decodedBody()['items'][0]['quantityTotal']);
    }

    private function create(array $input = []): array
    {
        $response = $this->post($this->url(), array_replace(['partTypeId' => $this->type, 'quantityTotal' => 5], $input));
        self::assertStatus(201, $response);
        return $response->decodedBody();
    }

    private function url(): string
    {
        return '/v1/funds/' . $this->fund . '/bulk-stocks';
    }

    private function denied(int $id, int $status, string $code): void
    {
        self::assertError($status, $code, $this->get($this->url()));
        self::assertError($status, $code, $this->post($this->url(), ['partTypeId' => $this->type, 'quantityTotal' => 1]));
        self::assertError($status, $code, $this->patch('/v1/bulk-stocks/' . $id, ['quantityTotal' => 0]));
    }
}
