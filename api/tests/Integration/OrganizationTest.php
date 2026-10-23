<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

/** Nastavení → Uživatelé a pověření: organization.admin only, invitations, mandate scopes, last admin guard. */
final class OrganizationTest extends ApiTestCase
{
    private int $admin;
    private int $fund;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->createAccount(email: 'admin@example.test');
        $this->grant($this->admin, 'organization.admin');
        $this->fund = $this->createUnit('Vonica');
        $this->signInAs($this->admin);
    }

    public function testEverythingButUnitListRequiresOrganizationAdmin(): void
    {
        $krojarka = $this->createAccount(email: 'k@example.test');
        $this->grant($krojarka, 'costumes.manage', $this->fund);
        $this->signInAs($krojarka);

        self::assertStatus(200, $this->get('/v1/units'));
        self::assertError(403, 'forbidden', $this->get('/v1/persons'));
        self::assertError(403, 'forbidden', $this->post('/v1/persons', ['firstName' => 'A', 'lastName' => 'B']));
        self::assertError(403, 'forbidden', $this->post('/v1/units', ['name' => 'Nová']));
        self::assertError(403, 'forbidden', $this->post('/v1/mandates', ['personId' => 1, 'kind' => 'organization.admin']));
        self::assertError(403, 'forbidden', $this->delete('/v1/mandates/1'));
        self::assertError(403, 'forbidden', $this->post('/v1/accounts', ['personId' => 1, 'email' => 'x@example.test']));
    }

    public function testAdminCreatesPersonAndInvitesAccount(): void
    {
        $person = $this->post('/v1/persons', ['firstName' => 'Lucie', 'lastName' => 'Šťastná', 'nickname' => 'Lucka']);
        self::assertStatus(201, $person);
        self::assertNull($person->decodedBody()['account']);

        $account = $this->post('/v1/accounts', ['personId' => $person->decodedBody()['id'], 'email' => 'lucka@example.test']);
        self::assertStatus(201, $account);
        self::assertTrue($account->decodedBody()['invitationSent']);
        self::assertSame('invited', $account->decodedBody()['person']['account']['status']);
        self::assertSame('lucka@example.test', $this->mailer->sent[0]['to']);
        self::assertStringContainsString('Dobrý den, Lucie', $this->mailer->sent[0]['body']);

        // the invitation link sets the first password and activates the account
        $this->signOut();
        self::assertStatus(204, $this->post('/v1/auth/password-reset/confirm', ['token' => $this->mailer->lastResetToken(), 'password' => 'první heslo 1']));
        self::assertSame('active', $this->db->query("SELECT status FROM user_accounts WHERE login_email = 'lucka@example.test'")->fetchColumn());
        self::assertSame(1, $this->auditCount('account.create'));
    }

    public function testAccountRulesAndInvitationResend(): void
    {
        $personId = $this->post('/v1/persons', ['firstName' => 'A', 'lastName' => 'B'])->decodedBody()['id'];
        $otherId = $this->post('/v1/persons', ['firstName' => 'C', 'lastName' => 'D'])->decodedBody()['id'];
        $accountId = $this->post('/v1/accounts', ['personId' => $personId, 'email' => 'a@example.test'])->decodedBody()['person']['account']['id'];

        self::assertError(422, 'account_exists', $this->post('/v1/accounts', ['personId' => $personId, 'email' => 'b@example.test']));
        self::assertError(422, 'email_taken', $this->post('/v1/accounts', ['personId' => $otherId, 'email' => 'A@example.test']));
        self::assertError(422, 'validation_failed', $this->post('/v1/accounts', ['personId' => 999999, 'email' => 'c@example.test']));

        self::assertTrue($this->post("/v1/accounts/$accountId/invite")->decodedBody()['invitationSent']);
        self::assertCount(2, $this->mailer->sent);
        self::assertError(422, 'account_not_invited', $this->post("/v1/accounts/{$this->admin}/invite"));
    }

    public function testDisablingAccountEndsItsSessionsButNotOwnAccount(): void
    {
        $other = $this->createAccount(email: 'other@example.test');
        $session = $this->app->sessions()->create($other, null)['token'];

        $disabled = $this->post("/v1/accounts/$other/disable");
        self::assertStatus(200, $disabled);
        self::assertSame('disabled', $disabled->decodedBody()['account']['status']);
        self::assertNull($this->app->sessions()->findByToken($session));
        self::assertError(422, 'cannot_disable_self', $this->post("/v1/accounts/{$this->admin}/disable"));

        self::assertSame('active', $this->post("/v1/accounts/$other/enable")->decodedBody()['account']['status']);
        self::assertError(422, 'account_not_disabled', $this->post("/v1/accounts/$other/enable"));
    }

    public function testMandateScopesFollowKinds(): void
    {
        $personId = $this->post('/v1/persons', ['firstName' => 'A', 'lastName' => 'B'])->decodedBody()['id'];
        $band = $this->createUnit('Muzika', false);
        $grant = fn (string $kind, ?int $unitId) => $this->post('/v1/mandates', ['personId' => $personId, 'kind' => $kind, 'unitId' => $unitId]);

        $manage = $grant('costumes.manage', $this->fund);
        self::assertStatus(201, $manage);
        self::assertSame(['kind' => 'costumes.manage', 'scopeType' => 'unit', 'scopeId' => $this->fund, 'scopeName' => 'Vonica'],
            array_intersect_key($manage->decodedBody(), array_flip(['kind', 'scopeType', 'scopeId', 'scopeName'])));
        self::assertStatus(201, $grant('costumes.view', null));
        self::assertStatus(201, $grant('costs.view', null));

        self::assertSame('mandate_exists', $grant('costumes.manage', $this->fund)->decodedBody()['error']['code']);
        self::assertSame('required', $grant('costumes.manage', null)->decodedBody()['error']['details']['reason']);
        self::assertSame('not_a_costume_fund', $grant('costumes.manage', $band)->decodedBody()['error']['details']['reason']);
        self::assertSame('organization_scope_only', $grant('organization.admin', $this->fund)->decodedBody()['error']['details']['reason']);
        self::assertSame('invalid', $grant('superadmin', null)->decodedBody()['error']['details']['reason']);
        self::assertCount(3, array_values(array_filter($this->get('/v1/persons')->decodedBody()['items'], fn ($p) => $p['id'] === $personId))[0]['mandates']);
    }

    public function testRevokedMandateStopsWorkingAndStaysInHistory(): void
    {
        $krojarka = $this->createAccount(email: 'k@example.test');
        $mandateId = $this->grant($krojarka, 'costumes.manage', $this->fund);

        self::assertStatus(204, $this->delete("/v1/mandates/$mandateId"));
        self::assertError(404, 'not_found', $this->delete("/v1/mandates/$mandateId"));
        self::assertNotFalse($this->db->query("SELECT revoked_at FROM mandates WHERE id = $mandateId AND revoked_by = {$this->admin}")->fetchColumn());

        $this->signInAs($krojarka);
        self::assertError(404, 'not_found', $this->get("/v1/funds/{$this->fund}/regions"));
    }

    public function testLastUsableAdminCannotBeRevoked(): void
    {
        $ownMandate = (int) $this->db->query("SELECT m.id FROM mandates m JOIN user_accounts a USING (person_id) WHERE a.id = {$this->admin}")->fetchColumn();
        $invited = $this->createAccount('invited', 'invited@example.test');
        $this->grant($invited, 'organization.admin');

        self::assertError(422, 'last_admin', $this->delete("/v1/mandates/$ownMandate"));
        self::assertSame(0, $this->auditCount('mandate.revoke'));

        $second = $this->createAccount(email: 'second@example.test');
        $this->grant($second, 'organization.admin');
        self::assertStatus(204, $this->delete("/v1/mandates/$ownMandate"));
        self::assertError(403, 'forbidden', $this->get('/v1/persons'));
    }

    public function testUnitsCanBeAddedAndEdited(): void
    {
        $unit = $this->post('/v1/units', ['name' => 'Vonička IV', 'hasCostumeFund' => true]);
        self::assertStatus(201, $unit);

        $updated = $this->patch('/v1/units/' . $unit->decodedBody()['id'], ['shortName' => 'IV', 'archived' => true]);
        self::assertSame(['IV', true, true], [$updated->decodedBody()['shortName'], $updated->decodedBody()['archived'], $updated->decodedBody()['hasCostumeFund']]);
    }

    public function testPersonEditKeepsUntouchedFields(): void
    {
        $person = $this->post('/v1/persons', ['firstName' => 'Anna', 'lastName' => 'Zelená', 'nickname' => 'Anička'])->decodedBody();

        $updated = $this->patch("/v1/persons/{$person['id']}", ['lastName' => 'Zelenková']);
        self::assertSame(['Anna', 'Zelenková', 'Anička'], [$updated->decodedBody()['firstName'], $updated->decodedBody()['lastName'], $updated->decodedBody()['nickname']]);
        self::assertError(422, 'validation_failed', $this->patch("/v1/persons/{$person['id']}", ['firstName' => '']));
    }
}
