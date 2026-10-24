<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class GroupsTest extends ApiTestCase
{
    private int $admin;
    private int $fund;
    private int $holder;

    protected function setUp(): void
    {
        parent::setUp(); $this->admin = $this->createAccount(); $this->fund = $this->createUnit();
        $this->grant($this->admin, 'organization.admin'); $this->signInAs($this->admin);
        $this->holder = (int) $this->db->query("INSERT INTO persons (first_name, last_name) VALUES ('Jan', 'Holder') RETURNING id")->fetchColumn();
    }

    public function testOnlyAdministratorCanManageGroupsAndMembershipHistory(): void
    {
        $group = $this->group();
        $added = $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder]);
        self::assertStatus(201, $added); $membership = $added->decodedBody()['memberships'][0];
        self::assertTrue($membership['active']); self::assertNull($membership['revokedAt']);
        self::assertError(422, 'group_membership_exists', $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder]));
        $removed = $this->delete('/v1/groups/' . $group['id'] . '/members/' . $membership['id']);
        self::assertStatus(200, $removed); self::assertFalse($removed->decodedBody()['memberships'][0]['active']);
        self::assertSame($this->admin, $removed->decodedBody()['memberships'][0]['revokedBy']);
        $again = $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder]);
        self::assertStatus(201, $again); self::assertCount(2, $again->decodedBody()['memberships']);
        self::assertSame(2, $this->auditCount('group.member_add')); self::assertSame(1, $this->auditCount('group.member_revoke'));
        $crojak = $this->createAccount(email: 'crojak@example.test'); $this->grant($crojak, 'costumes.manage', $this->fund); $this->signInAs($crojak);
        self::assertError(403, 'forbidden', $this->get('/v1/groups'));
        self::assertError(403, 'forbidden', $this->post('/v1/groups', ['name' => 'Forbidden']));
        self::assertError(403, 'forbidden', $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder]));
        $options = $this->get('/v1/funds/' . $this->fund . '/inventories/groups');
        self::assertStatus(200, $options); self::assertSame(['id', 'unitId', 'name'], array_keys($options->decodedBody()['items'][0]));
    }

    public function testRevocationImmediatelyChangesNewScopeButNeverAnExistingInventory(): void
    {
        $group = $this->group();
        $membership = $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder])->decodedBody()['memberships'][0]['id'];
        $type = $this->db->query("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirts') RETURNING id")->fetchColumn();
        $series = $this->db->query("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type) RETURNING id")->fetchColumn();
        $item = $this->db->query("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->fund}, $series, '1') RETURNING id")->fetchColumn();
        $loan = $this->db->query("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by) VALUES ({$this->fund}, {$this->holder}, {$this->admin}) RETURNING id")->fetchColumn();
        $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, $item, 1)");
        $this->grant($this->admin, 'costumes.manage', $this->fund);
        $base = '/v1/funds/' . $this->fund . '/inventories'; $scope = ['groupId' => $group['id']];
        $inventory = $this->post($base, ['name' => 'Frozen', 'scope' => $scope]); self::assertStatus(201, $inventory);
        self::assertSame(1, $inventory->decodedBody()['progress']['expectedQuantity']);
        self::assertStatus(200, $this->delete('/v1/groups/' . $group['id'] . '/members/' . $membership));
        $preview = $this->post($base . '/preview', ['scope' => $scope]); self::assertStatus(200, $preview);
        self::assertSame(0, $preview->decodedBody()['progress']['expectedQuantity']);
        self::assertSame(1, $this->get('/v1/inventories/' . $inventory->decodedBody()['id'] . '/targets')->decodedBody()['total']);
        self::assertSame(1, $this->db->query('SELECT count(*) FROM group_memberships')->fetchColumn());
    }

    public function testArchivedGroupsAndInvalidMembershipsAreRejectedWithoutPartialAudit(): void
    {
        $group = $this->group();
        foreach ([['personId' => $this->holder, 'validFrom' => '2026-02-30'], ['personId' => $this->holder, 'validFrom' => '2026-10-25', 'validTo' => '2026-10-24'], ['personId' => 999999999], ['personId' => $this->holder, 'active' => true]] as $body) {
            self::assertError(422, 'validation_failed', $this->post('/v1/groups/' . $group['id'] . '/members', $body));
        }
        self::assertSame(0, $this->auditCount('group.member_add'));
        $archived = $this->patch('/v1/groups/' . $group['id'], ['archived' => true]); self::assertStatus(200, $archived);
        self::assertError(422, 'validation_failed', $this->post('/v1/groups/' . $group['id'] . '/members', ['personId' => $this->holder]));
        self::assertSame($group['id'], $this->get('/v1/groups')->decodedBody()['items'][0]['id']);
        self::assertError(404, 'not_found', $this->get('/v1/funds/' . $this->fund . '/inventories/groups'));
        $this->grant($this->admin, 'costumes.view', $this->fund);
        self::assertSame([], $this->get('/v1/funds/' . $this->fund . '/inventories/groups')->decodedBody()['items']);
    }

    private function group(): array
    {
        $result = $this->post('/v1/groups', ['name' => 'Musicians', 'unitId' => $this->fund]); self::assertStatus(201, $result); return $result->decodedBody();
    }
}
