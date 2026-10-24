<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

final class PeopleTest extends ApiTestCase
{
    private int $fund;
    private int $otherFund;
    private int $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit();
        $this->otherFund = $this->createUnit('Other');
        $this->account = $this->createAccount();
        $this->grant($this->account, 'costumes.manage', $this->fund);
        $this->signInAs($this->account);
    }

    public function testSharedContactsAndBasicIdentityDoNotExposeGlobalNotesOrAccounts(): void
    {
        $person = $this->create();
        $this->db->exec("UPDATE persons SET note = 'Organization secret' WHERE id = {$person['id']}");
        $other = $this->createAccount(email: 'other@example.test');
        $this->grant($other, 'costumes.manage', $this->otherFund);
        $this->signInAs($other);
        $list = $this->get('/v1/people?q=jan%20novak');
        self::assertStatus(200, $list);
        self::assertSame(1, $list->decodedBody()['total']);
        $row = $list->decodedBody()['items'][0];
        self::assertSame('555 123', $row['contact']); self::assertTrue($row['contactVisible']);
        self::assertArrayNotHasKey('note', $row); self::assertArrayNotHasKey('account', $row); self::assertArrayNotHasKey('mandates', $row);
        self::assertSame([], $row['affiliations']);
        self::assertSame(0, (int) $this->db->query("SELECT count(*) FROM user_accounts WHERE person_id = {$person['id']}")->fetchColumn());
        self::assertSame(0, (int) $this->db->query("SELECT count(*) FROM unit_affiliations WHERE person_id = {$person['id']}")->fetchColumn());
    }

    public function testDuplicateNamesRequireConfirmationButAreNotForbidden(): void
    {
        $first = $this->create();
        $body = ['firstName' => 'Jan', 'lastName' => 'Novak'];
        $warning = $this->post('/v1/people', $body);
        self::assertError(422, 'possible_duplicate', $warning);
        self::assertSame($first['id'], $warning->decodedBody()['error']['details']['people'][0]['id']);
        self::assertSame(1, $this->auditCount('person.create'));
        $confirmed = $this->post('/v1/people', $body + ['confirmDuplicate' => true]);
        self::assertStatus(201, $confirmed); self::assertNotSame($first['id'], $confirmed->decodedBody()['id']);
        self::assertSame(2, $this->auditCount('person.create'));
    }

    public function testSharedIdentityCanBeUpdatedWithoutChangingFundNotes(): void
    {
        $person = $this->create();
        $this->profile($this->fund, $person['id'], ['paperState' => 'paper', 'note' => 'Own shoes']);
        $updated = $this->patch('/v1/people/' . $person['id'], ['contact' => '777', 'defaultCostume' => 'female', 'nickname' => 'Nickname']);
        self::assertStatus(200, $updated);
        $card = $this->get($this->card($this->fund, $person['id']))->decodedBody();
        self::assertSame('777', $card['person']['contact']); self::assertSame('female', $card['person']['defaultCostume']);
        self::assertSame('Own shoes', $card['profile']['note']);
        self::assertError(422, 'validation_failed', $this->patch('/v1/people/' . $person['id'], ['note' => 'Global costume note is forbidden']));
    }

    public function testProfilesAreScopedAndDoNotProvePhysicalChecks(): void
    {
        $person = $this->create();
        self::assertNull($this->get($this->card($this->fund, $person['id']))->decodedBody()['profile']);
        $profile = $this->profile($this->fund, $person['id'], ['paperState' => 'digital', 'note' => 'Own shoes']);
        self::assertStatus(200, $profile);
        self::assertNotNull($profile->decodedBody()['migratedAt']);
        self::assertSame($this->account, $profile->decodedBody()['migratedBy']);
        self::assertNull($profile->decodedBody()['paperCheckedAt']);
        $firstMigration = $profile->decodedBody()['migratedAt'];
        $this->profile($this->fund, $person['id'], ['paperState' => 'migrating']);
        self::assertSame($firstMigration, $this->profile($this->fund, $person['id'], ['paperState' => 'digital'])->decodedBody()['migratedAt']);
        self::assertError(404, 'not_found', $this->get($this->card($this->otherFund, $person['id'])));
        self::assertError(404, 'not_found', $this->profile($this->otherFund, $person['id'], ['paperState' => 'paper']));
        self::assertError(404, 'not_found', $this->get('/v1/people?fund=' . $this->otherFund));
        $this->grant($this->account, 'costumes.manage', $this->otherFund);
        self::assertNull($this->get($this->card($this->otherFund, $person['id']))->decodedBody()['profile']);
        $this->profile($this->otherFund, $person['id'], ['paperState' => 'paper', 'note' => 'Other fund']);
        self::assertSame('Own shoes', $this->get($this->card($this->fund, $person['id']))->decodedBody()['profile']['note']);
        self::assertSame('Other fund', $this->get($this->card($this->otherFund, $person['id']))->decodedBody()['profile']['note']);
    }

    public function testFiltersPaginationAndAffiliations(): void
    {
        $person = $this->create();
        $this->db->exec("INSERT INTO unit_affiliations (person_id, unit_id, status) VALUES ({$person['id']}, {$this->otherFund}, 'active')");
        $this->profile($this->fund, $person['id'], ['paperState' => 'migrating']);
        $page = $this->get('/v1/people?fund=' . $this->fund . '&paperState=migrating&unit=' . $this->otherFund . '&limit=1')->decodedBody();
        self::assertSame(1, $page['total']); self::assertSame($person['id'], $page['items'][0]['id']);
        self::assertSame('migrating', $page['items'][0]['profile']['paperState']);
        self::assertSame($this->otherFund, $page['items'][0]['affiliations'][0]['unitId']);
        self::assertError(422, 'validation_failed', $this->get('/v1/people?paperState=digital'));
        self::assertError(422, 'validation_failed', $this->get('/v1/people?hasLoans=true'));
        self::assertError(422, 'validation_failed', $this->get('/v1/people?limit=201'));
    }

    public function testReadOnlyViewerCannotSeeSharedContactOrWrite(): void
    {
        $person = $this->create();
        $viewer = $this->createAccount(email: 'view@example.test'); $this->grant($viewer, 'costumes.view', $this->fund); $this->signInAs($viewer);
        $list = $this->get('/v1/people?q=Jan')->decodedBody();
        self::assertNull($list['items'][0]['contact']); self::assertFalse($list['items'][0]['contactVisible']);
        $card = $this->get($this->card($this->fund, $person['id'])); self::assertStatus(200, $card);
        self::assertNull($card->decodedBody()['person']['contact']);
        $this->writesDenied($person['id'], 403, 'forbidden');
    }

    public function testAdminAloneAndExpiredMandateCannotOpenCostumePeople(): void
    {
        $person = $this->create();
        $admin = $this->createAccount(email: 'admin@example.test'); $this->grant($admin, 'organization.admin'); $this->signInAs($admin);
        self::assertError(403, 'forbidden', $this->get('/v1/people'));
        self::assertError(404, 'not_found', $this->get($this->card($this->fund, $person['id'])));
        $this->writesDenied($person['id'], 403, 'forbidden', 404);
        $this->signInAs($this->account);
        $this->db->exec('UPDATE mandates SET valid_from = current_date - 2, valid_to = current_date - 1 WHERE kind = \'costumes.manage\'');
        self::assertError(403, 'forbidden', $this->get('/v1/people'));
        $this->signOut();
        self::assertError(401, 'unauthenticated', $this->get('/v1/people'));
        self::assertError(401, 'unauthenticated', $this->get($this->card($this->fund, $person['id'])));
        $this->writesDenied($person['id'], 401, 'unauthenticated');
    }

    public function testValidationRejectsUnknownIdentityAndProfileFields(): void
    {
        foreach ([['firstName' => ' '], ['contact' => []], ['defaultCostume' => 'other'], ['note' => 'Not fund scoped'], ['confirmDuplicate' => 'yes']] as $bad) {
            self::assertError(422, 'validation_failed', $this->post('/v1/people', array_replace(['firstName' => 'X', 'lastName' => 'Y'], $bad)));
        }
        $person = $this->create();
        self::assertError(422, 'validation_failed', $this->profile($this->fund, $person['id'], ['paperState' => 'checked']));
        self::assertError(422, 'validation_failed', $this->profile($this->fund, $person['id'], ['paperState' => 'digital', 'paperCheckedAt' => '2026-10-24']));
        self::assertError(404, 'not_found', $this->get($this->card($this->fund, 999999)));
        self::assertError(404, 'not_found', $this->patch('/v1/people/999999', ['contact' => 'No']));
    }

    public function testAuditFailureRollsBackPersonAndProfileWrites(): void
    {
        $this->db->exec("CREATE UNIQUE INDEX test_people_audit ON audit_log (action) WHERE action IN ('person.create', 'holder_profile.update')");
        $person = $this->create();
        self::assertStatus(422, $this->post('/v1/people', ['firstName' => 'Different', 'lastName' => 'Name']));
        self::assertSame(0, $this->get('/v1/people?q=Different')->decodedBody()['total']);
        self::assertStatus(200, $this->profile($this->fund, $person['id'], ['paperState' => 'paper', 'note' => 'First']));
        self::assertStatus(422, $this->profile($this->fund, $person['id'], ['paperState' => 'digital', 'note' => 'Must roll back']));
        $card = $this->get($this->card($this->fund, $person['id']))->decodedBody();
        self::assertSame('First', $card['profile']['note']); self::assertNull($card['profile']['migratedAt']);
    }

    private function create(): array
    {
        $response = $this->post('/v1/people', ['firstName' => 'Jan', 'lastName' => 'Novák', 'contact' => '555 123']);
        self::assertStatus(201, $response); return $response->decodedBody();
    }
    private function profile(int $unit, int $person, array $input): \Splk\Api\Http\Response { return $this->send('PUT', '/v1/funds/' . $unit . '/people/' . $person . '/profile', $input); }
    private function card(int $unit, int $person): string { return '/v1/funds/' . $unit . '/people/' . $person . '/card'; }
    private function writesDenied(int $person, int $status, string $code, ?int $fundStatus = null): void
    {
        self::assertError($status, $code, $this->post('/v1/people', ['firstName' => 'No', 'lastName' => 'No']));
        self::assertError($status, $code, $this->patch('/v1/people/' . $person, ['contact' => 'No']));
        self::assertError($fundStatus ?? $status, $fundStatus === 404 ? 'not_found' : $code, $this->profile($this->fund, $person, ['paperState' => 'paper']));
    }
}
