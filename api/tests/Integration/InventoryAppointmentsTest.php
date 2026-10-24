<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class InventoryAppointmentsTest extends ApiTestCase
{
    private int $fund;
    private string $url;
    private int $first;
    private int $second;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $actor = $this->createAccount();
        $this->grant($actor, 'costumes.manage', $this->fund); $this->signInAs($actor);
        $this->first = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('First', 'Holder')");
        $this->second = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('Second', 'Holder')");
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirts')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        foreach ([$this->first, $this->second] as $number => $person) {
            $item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number) VALUES ({$this->fund}, $series, '$number')");
            $loan = $this->insert("INSERT INTO costume_loans (unit_id, holder_person_id, issued_by) VALUES ({$this->fund}, $person, $actor)");
            $this->db->exec("INSERT INTO costume_loan_lines (unit_id, loan_id, item_id, qty) VALUES ({$this->fund}, $loan, $item, 1)");
        }
        $created = $this->post('/v1/funds/' . $this->fund . '/inventories', ['name' => 'Visits', 'scope' => (object) []]);
        self::assertStatus(201, $created); $this->url = '/v1/inventories/' . $created->decodedBody()['id'];
    }

    public function testCapacityIsEnforcedAndCancellationReleasesAReservation(): void
    {
        $slot = $this->slot(1)['slot']['id'];
        $first = $this->post($this->url . '/visits', ['version' => 2, 'personId' => $this->first, 'slotId' => $slot]);
        self::assertStatus(201, $first);
        self::assertError(422, 'inventory_slot_full', $this->post($this->url . '/visits', ['version' => 3, 'personId' => $this->second, 'slotId' => $slot]));
        self::assertSame(1, $this->get($this->url . '/visits')->decodedBody()['total']);
        $cancel = $this->patch($this->url . '/visits/' . $first->decodedBody()['visit']['id'], ['version' => 3, 'status' => 'cancelled']);
        self::assertStatus(200, $cancel);
        self::assertStatus(201, $this->post($this->url . '/visits', ['version' => 4, 'personId' => $this->second, 'slotId' => $slot]));
        self::assertSame(2, $this->get($this->url . '/visits')->decodedBody()['total']);
        self::assertSame(2, $this->auditCount('inventory.visit_create'));
    }

    public function testCompletedVisitDoesNotVerifyAnyItemAndItsHistoryCannotBeOverwritten(): void
    {
        $response = $this->post($this->url . '/visits', ['version' => 1, 'personId' => $this->first, 'status' => 'completed']);
        self::assertStatus(201, $response); $result = $response->decodedBody();
        self::assertSame(1, $result['inventory']['progress']['visitedPeopleCount']);
        self::assertSame(0, $result['inventory']['progress']['verifiedQuantity']);
        self::assertNotNull($result['visit']['completedAt']);
        self::assertError(409, 'inventory_visit_closed', $this->patch($this->url . '/visits/' . $result['visit']['id'], ['version' => 2, 'status' => 'booked']));
        $repeat = $this->post($this->url . '/visits', ['version' => 2, 'personId' => $this->first, 'status' => 'completed']);
        self::assertStatus(201, $repeat);
        self::assertSame(1, $repeat->decodedBody()['inventory']['progress']['visitedPeopleCount']);
        self::assertSame(2, $this->get($this->url . '/visits')->decodedBody()['total']);
        self::assertSame(0, $this->get($this->url . '/checks')->decodedBody()['total']);
    }

    public function testOnlyFrozenAffectedPeopleCanBookAndConcurrentVisitsAreRejected(): void
    {
        $outsider = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('Other', 'Person')");
        self::assertError(422, 'validation_failed', $this->post($this->url . '/visits', ['version' => 1, 'personId' => $outsider]));
        self::assertStatus(201, $this->post($this->url . '/visits', ['version' => 1, 'personId' => $this->first]));
        self::assertError(422, 'inventory_visit_exists', $this->post($this->url . '/visits', ['version' => 2, 'personId' => $this->first]));
        self::assertSame(2, $this->get($this->url)->decodedBody()['version']);
        self::assertSame(1, $this->auditCount('inventory.visit_create'));
    }

    public function testSlotEditsCannotReduceCapacityBelowItsReservations(): void
    {
        $slot = $this->slot(2)['slot']['id'];
        self::assertStatus(201, $this->post($this->url . '/visits', ['version' => 2, 'personId' => $this->first, 'slotId' => $slot]));
        self::assertStatus(201, $this->post($this->url . '/visits', ['version' => 3, 'personId' => $this->second, 'slotId' => $slot]));
        self::assertError(422, 'inventory_slot_full', $this->patch($this->url . '/slots/' . $slot, ['version' => 4, 'capacity' => 1]));
        $updated = $this->patch($this->url . '/slots/' . $slot, ['version' => 4, 'capacity' => 3]);
        self::assertStatus(200, $updated); self::assertSame(3, $updated->decodedBody()['slot']['capacity']);
    }

    public function testMalformedTimesVersionsAndOtherInventorySlotsAreRejectedAtomically(): void
    {
        foreach ([['startsAt' => '2026-02-30T10:00:00Z'], ['endsAt' => '2026-10-25T08:00:00Z'], ['capacity' => '3'], ['capacity' => 0]] as $bad) {
            self::assertError(422, 'validation_failed', $this->post($this->url . '/slots', array_replace($this->slotInput(3), $bad)));
        }
        $slot = $this->slot(3)['slot']['id'];
        $other = $this->post('/v1/funds/' . $this->fund . '/inventories', ['name' => 'Other', 'scope' => (object) []])->decodedBody()['id'];
        self::assertError(404, 'not_found', $this->post('/v1/inventories/' . $other . '/visits', ['version' => 1, 'personId' => $this->first, 'slotId' => $slot]));
        self::assertError(404, 'not_found', $this->patch('/v1/inventories/' . $other . '/slots/' . $slot, ['version' => 1, 'capacity' => 4]));
        self::assertError(409, 'version_conflict', $this->post($this->url . '/visits', ['version' => 1, 'personId' => $this->first]));
        self::assertSame(1, $this->auditCount('inventory.slot_create')); self::assertSame(0, $this->auditCount('inventory.visit_create'));
    }

    private function slot(int $capacity): array
    {
        $response = $this->post($this->url . '/slots', $this->slotInput($capacity)); self::assertStatus(201, $response); return $response->decodedBody();
    }
    private function slotInput(int $capacity): array
    {
        return ['version' => 1, 'startsAt' => '2026-10-25T10:00:00+01:00', 'endsAt' => '2026-10-25T10:30:00+01:00', 'capacity' => $capacity];
    }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
