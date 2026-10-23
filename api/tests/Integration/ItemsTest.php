<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

/** Items through the HTTP kernel, with real PostgreSQL constraints, sessions and CSRF. */
final class ItemsTest extends ApiTestCase
{
    private int $fund;
    private int $otherFund;
    private int $account;
    private int $series;
    private int $type;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->otherFund = $this->createUnit('Other');
        $this->account = $this->createAccount();
        $this->grant($this->account, 'costumes.manage', $this->fund);
        $this->signInAs($this->account);
        $this->type = (int) $this->db->query("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Košile') RETURNING id")->fetchColumn();
        $this->series = $this->series('Kopaničká košile');
    }

    public function testCreateDetailAndHistoryContainOnlyRecordedFacts(): void
    {
        $response = $this->post($this->url(), ['seriesId' => $this->series, 'number' => null]);
        self::assertStatus(201, $response);
        $item = $response->decodedBody();
        self::assertSame($this->fund, $item['unitId']);
        self::assertSame('unknown', $item['location']);
        self::assertSame('ok', $item['condition']);
        self::assertTrue($item['issuable']);
        self::assertSame(1, $item['version']);
        self::assertNull($item['number']);
        self::assertNull($item['kitId']);
        self::assertArrayNotHasKey('available', $item);
        self::assertArrayNotHasKey('holder', $item);
        self::assertSame($item, $this->get('/v1/items/' . $item['id'])->decodedBody());
        $history = $this->get('/v1/items/' . $item['id'] . '/history')->decodedBody();
        self::assertSame(1, $history['total']);
        self::assertSame('created', $history['items'][0]['event']);
        self::assertSame($this->account, $history['items'][0]['by']);
        self::assertEquals($item, $history['items'][0]['data']);
        self::assertSame(1, $this->auditCount('item.create'));
    }

    public function testUpdateVersionsAndPreservesPreviousNotesInHistory(): void
    {
        $item = $this->create(['note' => 'Old note']);
        $path = '/v1/items/' . $item['id'];
        $updated = $this->patch($path, [
            'version' => 1, 'number' => '17', 'condition' => 'damaged', 'issuable' => false,
            'location' => 'repair', 'locationNote' => 'Seamstress', 'note' => 'New note',
            'acquiredOn' => '2026-10-24', 'size' => 'L', 'description' => 'Silk shirt', 'variant' => 'Red',
        ]);
        self::assertStatus(200, $updated);
        self::assertSame(2, $updated->decodedBody()['version']);
        self::assertSame(false, $updated->decodedBody()['issuable']);
        self::assertSame('repair', $updated->decodedBody()['location']);
        self::assertError(409, 'version_conflict', $this->patch($path, ['version' => 1, 'note' => 'Stale']));
        self::assertError(409, 'version_conflict', $this->post($path . '/retire', ['version' => 1, 'reason' => 'Stale']));
        self::assertSame('New note', $this->get($path)->decodedBody()['note']);
        $history = $this->get($path . '/history')->decodedBody();
        $notes = array_values(array_filter($history['items'], static fn (array $event): bool => ($event['data']['field'] ?? null) === 'note'));
        self::assertSame('Old note', $notes[0]['data']['from']);
        self::assertSame('New note', $notes[0]['data']['to']);
        self::assertContains('condition_changed', array_column($history['items'], 'event'));
        self::assertContains('number_assigned', array_column($history['items'], 'event'));
        self::assertSame(1, $this->auditCount('item.update'));
        self::assertSame(0, $this->auditCount('item.retire'));
    }

    public function testRetireKeepsIdentityAndHistoryAndRejectsFurtherWrites(): void
    {
        $item = $this->create(['number' => '3']);
        $path = '/v1/items/' . $item['id'];
        self::assertError(422, 'validation_failed', $this->post($path . '/retire', ['version' => 1, 'reason' => ' ']));
        $retired = $this->post($path . '/retire', ['version' => 1, 'reason' => 'Worn out']);
        self::assertStatus(200, $retired);
        self::assertSame($item['id'], $retired->decodedBody()['id']);
        self::assertSame($this->account, $retired->decodedBody()['retiredBy']);
        self::assertSame('Worn out', $retired->decodedBody()['retireReason']);
        self::assertNotNull($retired->decodedBody()['retiredAt']);
        self::assertError(422, 'item_retired', $this->patch($path, ['version' => 2, 'note' => 'No']));
        self::assertError(422, 'item_retired', $this->post($path . '/retire', ['version' => 2, 'reason' => 'Again']));
        self::assertSame(0, $this->get($this->url())->decodedBody()['total']);
        self::assertSame(1, $this->get($this->url('?retired=true'))->decodedBody()['total']);
        self::assertSame(2, $this->get($path . '/history')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('item.retire'));
    }

    public function testNumberUniquenessIsPerSeriesAndRetiredNumbersFollowSeriesPolicy(): void
    {
        $old = $this->create(['number' => '3']);
        self::assertError(422, 'number_already_used', $this->post($this->url(), ['seriesId' => $this->series, 'number' => '3']));
        $other = $this->series('Other shirts');
        self::assertStatus(201, $this->post($this->url(), ['seriesId' => $other, 'number' => '3']));
        self::assertStatus(200, $this->post('/v1/items/' . $old['id'] . '/retire', ['version' => 1, 'reason' => 'Old']));
        $new = $this->create(['number' => '3']);
        self::assertNotSame($old['id'], $new['id']);
        $this->post('/v1/items/' . $new['id'] . '/retire', ['version' => 1, 'reason' => 'Old']);
        $this->db->exec("UPDATE costume_series SET allow_number_reuse = false WHERE id = {$this->series}");
        self::assertError(422, 'number_already_used', $this->post($this->url(), ['seriesId' => $this->series, 'number' => '3']));
        $item = $this->create(['number' => '4']);
        self::assertError(422, 'number_already_used', $this->patch('/v1/items/' . $item['id'], ['version' => 1, 'number' => '3']));
        self::assertSame(1, $this->get('/v1/items/' . $item['id'])->decodedBody()['version']);
        self::assertStatus(200, $this->patch('/v1/items/' . $item['id'], ['version' => 1, 'number' => '4', 'note' => 'Self is excluded']));
    }

    public function testMissingNumbersAndNumberAssignmentRemainIndependentItems(): void
    {
        $a = $this->create();
        $b = $this->create();
        self::assertNotSame($a['id'], $b['id']);
        self::assertStatus(200, $this->patch('/v1/items/' . $a['id'], ['version' => 1, 'number' => '7']));
        self::assertNull($this->get('/v1/items/' . $b['id'])->decodedBody()['number']);
    }

    public function testSeriesCannotBeForeignKitArchivedOrUnnumbered(): void
    {
        $kit = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Kits') RETURNING id")->fetchColumn();
        $foreign = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->otherFund}, 'kit', 'Foreign') RETURNING id")->fetchColumn();
        foreach ([$kit, $foreign, 999999] as $id) {
            self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $id]));
        }
        $this->db->exec("UPDATE costume_part_types SET numbered = false WHERE id = {$this->type}");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $this->series]));
        $this->db->exec("UPDATE costume_part_types SET numbered = true, archived_at = now() WHERE id = {$this->type}");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $this->series]));
        $this->db->exec("UPDATE costume_part_types SET archived_at = NULL WHERE id = {$this->type}");
        $this->db->exec("UPDATE costume_series SET archived_at = now() WHERE id = {$this->series}");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $this->series]));
        self::assertSame(0, $this->auditCount('item.create'));
    }

    public function testCatalogCannotMakeExistingPhysicalItemsUnnumbered(): void
    {
        $item = $this->create();
        $path = '/v1/funds/' . $this->fund . '/part-types/' . $this->type;
        self::assertError(422, 'validation_failed', $this->patch($path, ['numbered' => false]));
        self::assertSame(0, $this->auditCount('part_type.update'));
        self::assertStatus(200, $this->patch($path, ['numbered' => true, 'name' => 'Renamed shirt']));
        $this->post('/v1/items/' . $item['id'] . '/retire', ['version' => 1, 'reason' => 'Worn out']);
        self::assertError(422, 'validation_failed', $this->patch($path, ['numbered' => false]));
    }

    public function testArchivedRegionOrParentPreventsCreation(): void
    {
        $parent = (int) $this->db->query("INSERT INTO costume_regions (unit_id, name) VALUES ({$this->fund}, 'Slovakia') RETURNING id")->fetchColumn();
        $area = (int) $this->db->query("INSERT INTO costume_regions (unit_id, name, parent_id) VALUES ({$this->fund}, 'Area', $parent) RETURNING id")->fetchColumn();
        $this->db->exec("UPDATE costume_series SET region_id = $area WHERE id = {$this->series}");
        $this->db->exec("UPDATE costume_regions SET archived_at = now() WHERE id = $parent");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $this->series]));
        $this->db->exec("UPDATE costume_regions SET archived_at = NULL WHERE id = $parent");
        $this->db->exec("UPDATE costume_series SET region_id = NULL WHERE id = {$this->series}");
        $this->db->exec("UPDATE costume_part_types SET region_id = $area WHERE id = {$this->type}");
        $this->db->exec("UPDATE costume_regions SET archived_at = now() WHERE id = $area");
        self::assertError(422, 'validation_failed', $this->post($this->url(), ['seriesId' => $this->series]));
        self::assertSame(0, $this->auditCount('item.create'));
    }

    public function testMetadataOfArchivedSeriesItemCanBeCorrectedButNoNewNumberAssigned(): void
    {
        $item = $this->create(['number' => '1']);
        $this->db->exec("UPDATE costume_series SET archived_at = now() WHERE id = {$this->series}");
        self::assertStatus(200, $this->patch('/v1/items/' . $item['id'], ['version' => 1, 'note' => 'Corrected']));
        self::assertError(422, 'validation_failed', $this->patch('/v1/items/' . $item['id'], ['version' => 2, 'number' => '2']));
        self::assertStatus(200, $this->get('/v1/items/' . $item['id']));
    }

    public function testAllEndpointsRejectUnauthenticatedUsers(): void
    {
        $item = $this->create();
        $this->signOut();
        $this->assertAllDenied($item['id'], 401, 'unauthenticated');
    }

    public function testAllEndpointsHideForeignFundsFromManagersAndOrganizationAdmins(): void
    {
        $item = $this->create();
        $other = $this->createAccount(email: 'other@example.test');
        $this->grant($other, 'costumes.manage', $this->otherFund);
        $this->signInAs($other);
        $this->assertAllDenied($item['id'], 404, 'not_found');
        $this->grant($other, 'organization.admin');
        $this->assertAllDenied($item['id'], 404, 'not_found');
    }

    public function testRevokedAndExpiredMandatesGiveNoAccess(): void
    {
        $item = $this->create();
        $this->db->exec("UPDATE mandates SET valid_from = current_date - 2, valid_to = current_date - 1 WHERE scope_id = {$this->fund}");
        $this->assertAllDenied($item['id'], 404, 'not_found');
        $this->db->exec("UPDATE mandates SET valid_to = NULL, revoked_at = now() WHERE scope_id = {$this->fund}");
        $this->assertAllDenied($item['id'], 404, 'not_found');
    }

    public function testReadOnlyUnitAndOrganizationMandatesCanReadButNeverWrite(): void
    {
        $item = $this->create();
        foreach ([$this->fund, null] as $scope) {
            $account = $this->createAccount(email: $scope === null ? 'org@example.test' : 'unit@example.test');
            $this->grant($account, 'costumes.view', $scope);
            $this->signInAs($account);
            self::assertStatus(200, $this->get($this->url()));
            self::assertStatus(200, $this->get('/v1/items/' . $item['id']));
            self::assertStatus(200, $this->get('/v1/items/' . $item['id'] . '/history'));
            self::assertError(403, 'forbidden', $this->post($this->url(), ['seriesId' => $this->series]));
            self::assertError(403, 'forbidden', $this->patch('/v1/items/' . $item['id'], ['version' => 1]));
            self::assertError(403, 'forbidden', $this->post('/v1/items/' . $item['id'] . '/retire', ['version' => 1, 'reason' => 'No']));
        }
        self::assertSame(1, $this->auditCount('item.create'));
        self::assertSame(0, $this->auditCount('item.update'));
        self::assertSame(0, $this->auditCount('item.retire'));
    }

    public function testUnknownAndInvalidIdsAreNotFound(): void
    {
        foreach (['0', '-1', 'abc', '999999'] as $id) {
            self::assertError(404, 'not_found', $this->get('/v1/items/' . $id));
            self::assertError(404, 'not_found', $this->get('/v1/items/' . $id . '/history'));
            self::assertError(404, 'not_found', $this->patch('/v1/items/' . $id, ['version' => 1]));
            self::assertError(404, 'not_found', $this->post('/v1/items/' . $id . '/retire', ['version' => 1, 'reason' => 'No']));
        }
        self::assertError(404, 'not_found', $this->get('/v1/funds/abc/items'));
        $this->db->exec("UPDATE units SET has_costume_fund = false WHERE id = {$this->fund}");
        self::assertError(404, 'not_found', $this->get($this->url()));
    }

    public function testInputRejectsInvalidTypesDatesAndUnsupportedFields(): void
    {
        foreach ([['seriesId' => '1'], ['number' => 1], ['condition' => 'lost'], ['location' => 'loaned'],
            ['issuable' => null], ['issuable' => 'false'], ['acquiredOn' => '2026-02-30'], ['acquiredOn' => '24.10.2026'],
            ['note' => []], ['variant' => str_repeat('x', 101)], ['kitId' => 1], ['holder' => 1], ['available' => true]] as $invalid) {
            self::assertError(422, 'validation_failed', $this->post($this->url(), array_replace(['seriesId' => $this->series], $invalid)));
        }
        $item = $this->create();
        foreach ([[], ['version' => '1'], ['version' => 0], ['version' => 1, 'retiredAt' => '2026-01-01'], ['version' => 1, 'kitId' => 1]] as $invalid) {
            self::assertError(422, 'validation_failed', $this->patch('/v1/items/' . $item['id'], $invalid));
        }
        self::assertSame(1, $this->auditCount('item.create'));
        self::assertSame(0, $this->auditCount('item.update'));
    }

    public function testFiltersPaginationAndSearchAreScopedAndLiteral(): void
    {
        $a = $this->create(['number' => '17', 'condition' => 'damaged', 'location' => 'repair', 'acquiredOn' => '2026-01-10', 'note' => '100% linen']);
        $this->create(['number' => '18', 'location' => 'store', 'acquiredOn' => '2026-02-10']);
        $second = $this->series('Other');
        $this->create(['seriesId' => $second, 'number' => '19']);
        $foreignSeries = (int) $this->db->query("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->otherFund}, 'kit', 'hidden') RETURNING id")->fetchColumn();
        $this->db->exec("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->otherFund}, $foreignSeries, '17')");
        foreach ([
            '?q=' . rawurlencode('kopanicka kosile 17'), '?q=' . rawurlencode('100%'),
            '?condition=damaged', '?location=repair', '?acquiredFrom=2026-01-10&acquiredTo=2026-01-10',
        ] as $query) {
            $response = $this->get($this->url($query));
            self::assertStatus(200, $response);
            self::assertSame(1, $response->decodedBody()['total']);
            self::assertSame($a['id'], $response->decodedBody()['items'][0]['id']);
        }
        $page = $this->get($this->url('?limit=1&offset=1&sort=number'))->decodedBody();
        self::assertSame(3, $page['total']);
        self::assertCount(1, $page['items']);
        self::assertSame('18', $page['items'][0]['number']);
        self::assertSame(2, $this->get($this->url('?series=' . $this->series))->decodedBody()['total']);
        self::assertSame([], $this->get($this->url('?offset=100'))->decodedBody()['items']);
        self::assertSame(0, $this->get($this->url('?q=' . rawurlencode("' OR 1=1 --")))->decodedBody()['total']);
    }

    public function testInvalidAndPrematureFiltersAreExplicitlyRejected(): void
    {
        foreach (['limit=0', 'limit=201', 'offset=-1', 'offset=99999999999999999999999', 'sort=number;DROP', 'series=abc',
            'location=loaned', 'condition=lost', 'acquiredFrom=2026-02-30', 'acquiredFrom[]=x',
            'acquiredFrom=2026-10-24&acquiredTo=2026-10-23', 'q[]=x', 'retired=yes', 'available=true', 'holder=1'] as $query) {
            self::assertError(422, 'validation_failed', $this->get($this->url('?' . $query)));
        }
    }

    public function testHistoryPaginationUsesStableNewestFirstOrder(): void
    {
        $item = $this->create();
        $this->patch('/v1/items/' . $item['id'], ['version' => 1, 'note' => 'Updated']);
        $page = $this->get('/v1/items/' . $item['id'] . '/history?limit=1&offset=1');
        self::assertStatus(200, $page);
        self::assertSame(2, $page->decodedBody()['total']);
        self::assertSame('created', $page->decodedBody()['items'][0]['event']);
    }

    public function testCsrfAndOriginProtectEveryWriteEndpoint(): void
    {
        $item = $this->create();
        ['token' => $token, 'session' => $session] = $this->app->sessions()->create($this->account, 'Test');
        foreach ([['POST', $this->url()], ['PATCH', '/v1/items/' . $item['id']], ['POST', '/v1/items/' . $item['id'] . '/retire']] as [$method, $path]) {
            foreach ([null, 'invalid'] as $csrf) {
                $response = $this->app->handle(new \Splk\Api\Http\Request(
                    $method, $path,
                    array_filter(['Origin' => self::ORIGIN, 'Content-Type' => 'application/json', 'X-CSRF-Token' => $csrf]),
                    cookies: [self::COOKIE => $token], body: '{}',
                ));
                self::assertError(403, 'csrf_token_invalid', $response);
            }
            $response = $this->app->handle(new \Splk\Api\Http\Request(
                $method, $path,
                ['Origin' => 'https://foreign.example', 'Content-Type' => 'application/json', 'X-CSRF-Token' => $session->csrfToken],
                cookies: [self::COOKIE => $token], body: '{}',
            ));
            self::assertError(403, 'origin_not_allowed', $response);
        }
        self::assertSame(1, $this->auditCount('item.create'));
        self::assertSame(0, $this->auditCount('item.update'));
        self::assertSame(0, $this->auditCount('item.retire'));
    }

    public function testAuditFailureRollsBackItemAndEventsForCreateAndUpdate(): void
    {
        // Inject a late unique violation in the audit write, after the item and its events were written.
        $this->db->exec("CREATE UNIQUE INDEX test_single_item_audit ON audit_log (action) WHERE action IN ('item.create', 'item.update')");
        $item = $this->create();
        self::assertStatus(422, $this->post($this->url(), ['seriesId' => $this->series, 'number' => '9']));
        self::assertSame(1, $this->get($this->url())->decodedBody()['total']);
        self::assertSame(1, (int) $this->db->query('SELECT count(*) FROM costume_item_events')->fetchColumn());
        $path = '/v1/items/' . $item['id'];
        self::assertStatus(200, $this->patch($path, ['version' => 1, 'note' => 'First']));
        self::assertStatus(422, $this->patch($path, ['version' => 2, 'note' => 'Must roll back']));
        self::assertSame('First', $this->get($path)->decodedBody()['note']);
        self::assertSame(2, $this->get($path)->decodedBody()['version']);
        self::assertSame(2, $this->get($path . '/history')->decodedBody()['total']);
        self::assertSame(1, $this->auditCount('item.create'));
        self::assertSame(1, $this->auditCount('item.update'));
    }

    private function create(array $input = []): array
    {
        $response = $this->post($this->url(), array_replace(['seriesId' => $this->series, 'number' => null], $input));
        self::assertStatus(201, $response);
        return $response->decodedBody();
    }

    private function series(string $name): int
    {
        $statement = $this->db->prepare("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES (:unit, 'part', :name, :type) RETURNING id");
        $statement->execute(['unit' => $this->fund, 'name' => $name, 'type' => $this->type]);
        return (int) $statement->fetchColumn();
    }

    private function url(string $query = ''): string
    {
        return '/v1/funds/' . $this->fund . '/items' . $query;
    }

    private function assertAllDenied(int $id, int $status, string $code): void
    {
        self::assertError($status, $code, $this->get($this->url()));
        self::assertError($status, $code, $this->get('/v1/items/' . $id));
        self::assertError($status, $code, $this->get('/v1/items/' . $id . '/history'));
        self::assertError($status, $code, $this->post($this->url(), ['seriesId' => $this->series]));
        self::assertError($status, $code, $this->patch('/v1/items/' . $id, ['version' => 1]));
        self::assertError($status, $code, $this->post('/v1/items/' . $id . '/retire', ['version' => 1, 'reason' => 'No']));
    }
}
