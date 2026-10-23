<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\Auth\SessionStore;

final class SessionStoreTest extends DatabaseTestCase
{
    private SessionStore $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->store = new SessionStore($this->db, 3600, 600);
    }

    public function testCreatedSessionIsFoundByTokenAndStoresOnlyHash(): void
    {
        $accountId = $this->createAccount();

        ['token' => $token, 'session' => $session] = $this->store->create($accountId, 'Test agent');
        $found = $this->store->findByToken($token);

        self::assertSame($session->id, $found?->id);
        self::assertSame($accountId, $found->accountId);
        self::assertSame(43, strlen($token));
        self::assertSame(43, strlen($session->csrfToken));
        self::assertSame(hash('sha256', $token), $this->db->query("SELECT token_hash FROM sessions WHERE id = {$session->id}")->fetchColumn());
        self::assertSame(0, (int) $this->db->query("SELECT count(*) FROM sessions WHERE token_hash = '$token'")->fetchColumn());
    }

    public function testUnknownTokenIsNotAccepted(): void
    {
        self::assertNull($this->store->findByToken('attacker-chosen-token'));
        self::assertSame(0, (int) $this->db->query('SELECT count(*) FROM sessions')->fetchColumn());
    }

    public function testSessionOfDisabledAccountIsRejected(): void
    {
        $accountId = $this->createAccount();
        $token = $this->store->create($accountId, null)['token'];
        $this->db->exec("UPDATE user_accounts SET status = 'disabled' WHERE id = $accountId");

        self::assertNull($this->store->findByToken($token));
    }

    public function testExpiredAndIdleSessionsAreRejected(): void
    {
        $accountId = $this->createAccount();
        ['token' => $expired, 'session' => $a] = $this->store->create($accountId, null);
        ['token' => $idle, 'session' => $b] = $this->store->create($accountId, null);
        $this->db->exec("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = {$a->id}");
        $this->db->exec("UPDATE sessions SET last_seen_at = now() - interval '11 minutes' WHERE id = {$b->id}");

        self::assertNull($this->store->findByToken($expired));
        self::assertNull($this->store->findByToken($idle));
        self::assertSame(2, $this->store->deleteExpired());
    }

    public function testDestroyedSessionCannotBeReused(): void
    {
        $accountId = $this->createAccount();
        ['token' => $token, 'session' => $session] = $this->store->create($accountId, null);
        $other = $this->store->create($accountId, null)['token'];

        $this->store->destroy($session->id);
        self::assertNull($this->store->findByToken($token));
        self::assertNotNull($this->store->findByToken($other));

        $this->store->destroyAllForAccount($accountId);
        self::assertNull($this->store->findByToken($other));
    }
}
