<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\App;
use Splk\Api\Auth\LoginThrottle;
use Splk\Api\Config;
use Splk\Api\Http\Request;
use Splk\Api\Http\Response;
use Splk\Api\Infrastructure\Db\Connection;
use Splk\Api\Tests\Support\RecordingMailer;

/** /v1/auth/* end to end through the kernel, including rejected cases (D-44). */
final class AuthTest extends DatabaseTestCase
{
    private const ORIGIN = 'https://krojarka.vonica.cz';
    private const COOKIE = '__Host-vonica_sid';
    private const EMAIL = 'krojarka@example.test';
    private const PASSWORD = 'secret'; // DatabaseTestCase::createAccount

    private App $app;
    private RecordingMailer $mailer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mailer = new RecordingMailer();
        $this->app = new App(
            new Config(['cors' => ['allowedOrigins' => [self::ORIGIN]], 'app' => ['krojarkaUrl' => 'https://krojarka.test']]),
            Connection::fromPdo($this->db),
            $this->mailer,
        );
    }

    public function testLoginSetsHostOnlyCookieAndReturnsProfileWithCsrfToken(): void
    {
        $accountId = $this->createAccount();
        $personId = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = $accountId")->fetchColumn();
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type) VALUES ($personId, 'organization.admin', 'organization')");
        $unitId = $this->db->query("INSERT INTO units (name, has_costume_fund) VALUES ('Děvčice', true) RETURNING id")->fetchColumn();
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type, scope_id) VALUES ($personId, 'costumes.manage', 'unit', $unitId)");
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type, valid_from, valid_to) VALUES ($personId, 'costs.view', 'organization', current_date - 10, current_date - 1)");

        $response = $this->login(self::EMAIL, self::PASSWORD);
        $body = $response->decodedBody();

        self::assertSame(200, $response->status);
        self::assertMatchesRegularExpression('#^__Host-vonica_sid=[A-Za-z0-9_-]{43}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$#', $response->cookies[0]);
        self::assertSame(['id' => $accountId, 'loginEmail' => self::EMAIL, 'status' => 'active'], $body['account']);
        self::assertSame('Anna', $body['person']['firstName']);
        self::assertSame(['organization.admin', 'costumes.manage'], array_column($body['mandates'], 'kind'), 'expired mandates are left out');
        self::assertSame([null, 'Děvčice'], array_column($body['mandates'], 'scopeName'));
        self::assertSame(43, strlen($body['csrfToken']));
        self::assertNotNull($this->db->query("SELECT last_login_at FROM user_accounts WHERE id = $accountId")->fetchColumn());
    }

    public function testLoginEmailIsCaseInsensitive(): void
    {
        $this->createAccount();

        self::assertSame(200, $this->login('KROJARKA@example.test', self::PASSWORD)->status);
    }

    public function testWrongPasswordUnknownEmailAndInactiveAccountsGetTheSameError(): void
    {
        $this->createAccount();
        $this->createAccount('disabled', 'disabled@example.test');
        $this->createAccount('invited', 'invited@example.test');

        foreach ([[self::EMAIL, 'wrong'], ['nobody@example.test', self::PASSWORD], ['disabled@example.test', self::PASSWORD], ['invited@example.test', self::PASSWORD]] as [$email, $password]) {
            $response = $this->login($email, $password);
            self::assertSame(401, $response->status, $email);
            self::assertSame('invalid_credentials', $response->decodedBody()['error']['code']);
            self::assertSame([], $response->cookies);
        }
    }

    public function testLoginIsThrottledAfterRepeatedFailures(): void
    {
        $this->createAccount();
        for ($i = 0; $i < LoginThrottle::MAX_FAILURES_PER_EMAIL; $i++) {
            $this->login(self::EMAIL, 'wrong');
        }

        $response = $this->login(self::EMAIL, self::PASSWORD);

        self::assertSame(429, $response->status);
        self::assertSame('900', $response->header('Retry-After'));
    }

    public function testLoginValidatesInputAndRequiresOrigin(): void
    {
        self::assertSame('validation_failed', $this->post('/v1/auth/login', ['email' => 'not-an-email', 'password' => 'x'])->decodedBody()['error']['code']);
        $noOrigin = $this->app->handle(new Request('POST', '/v1/auth/login', ['Content-Type' => 'application/json'], body: '{}'));
        self::assertSame(403, $noOrigin->status);
    }

    public function testLoginReplacesSessionTheBrowserAlreadyHad(): void
    {
        $this->createAccount();
        $first = $this->tokenFrom($this->login(self::EMAIL, self::PASSWORD));

        $second = $this->tokenFrom($this->post('/v1/auth/login', ['email' => self::EMAIL, 'password' => self::PASSWORD], $first));

        self::assertNotSame($first, $second);
        self::assertSame(401, $this->get('/v1/auth/me', $first)->status);
        self::assertSame(200, $this->get('/v1/auth/me', $second)->status);
    }

    public function testMeRequiresSession(): void
    {
        self::assertSame(401, $this->get('/v1/auth/me', null)->status);
    }

    public function testLogoutRequiresCsrfAndEndsSession(): void
    {
        $this->createAccount();
        $login = $this->login(self::EMAIL, self::PASSWORD);
        $token = $this->tokenFrom($login);

        self::assertSame(403, $this->post('/v1/auth/logout', [], $token)->status);

        $response = $this->post('/v1/auth/logout', [], $token, $login->decodedBody()['csrfToken']);
        self::assertSame(204, $response->status);
        self::assertStringContainsString('Max-Age=0', $response->cookies[0]);
        self::assertSame(401, $this->get('/v1/auth/me', $token)->status);
    }

    public function testChangePasswordChecksCurrentPasswordAndEndsOtherSessions(): void
    {
        $this->createAccount();
        $login = $this->login(self::EMAIL, self::PASSWORD);
        [$token, $csrf] = [$this->tokenFrom($login), $login->decodedBody()['csrfToken']];
        $other = $this->tokenFrom($this->login(self::EMAIL, self::PASSWORD));

        $wrong = $this->post('/v1/auth/password', ['currentPassword' => 'bad', 'newPassword' => 'new password 123'], $token, $csrf);
        self::assertSame('password_incorrect', $wrong->decodedBody()['error']['details']['reason']);
        $short = $this->post('/v1/auth/password', ['currentPassword' => self::PASSWORD, 'newPassword' => 'short'], $token, $csrf);
        self::assertSame('password_too_short', $short->decodedBody()['error']['details']['reason']);

        $ok = $this->post('/v1/auth/password', ['currentPassword' => self::PASSWORD, 'newPassword' => 'new password 123'], $token, $csrf);
        self::assertSame(204, $ok->status);
        self::assertSame(200, $this->get('/v1/auth/me', $token)->status);
        self::assertSame(401, $this->get('/v1/auth/me', $other)->status);
        self::assertSame(200, $this->login(self::EMAIL, 'new password 123')->status);
    }

    public function testPasswordResetActivatesInvitedAccountAndLinkIsSingleUse(): void
    {
        $this->createAccount('invited');

        self::assertSame(204, $this->post('/v1/auth/password-reset', ['email' => self::EMAIL])->status);
        self::assertCount(1, $this->mailer->sent);
        self::assertSame(self::EMAIL, $this->mailer->sent[0]['to']);
        self::assertStringContainsString('https://krojarka.test/obnova-hesla?token=', $this->mailer->sent[0]['body']);
        $token = $this->mailer->lastResetToken();

        $short = $this->post('/v1/auth/password-reset/confirm', ['token' => $token, 'password' => 'short']);
        self::assertSame(422, $short->status);

        self::assertSame(204, $this->post('/v1/auth/password-reset/confirm', ['token' => $token, 'password' => 'first password 1'])->status);
        self::assertSame(200, $this->login(self::EMAIL, 'first password 1')->status);

        $again = $this->post('/v1/auth/password-reset/confirm', ['token' => $token, 'password' => 'other password 2']);
        self::assertSame('reset_token_invalid', $again->decodedBody()['error']['code']);
    }

    public function testPasswordResetDoesNotRevealAccountsAndIsLimited(): void
    {
        $this->createAccount();
        $this->createAccount('disabled', 'disabled@example.test');

        self::assertSame(204, $this->post('/v1/auth/password-reset', ['email' => 'nobody@example.test'])->status);
        self::assertSame(204, $this->post('/v1/auth/password-reset', ['email' => 'disabled@example.test'])->status);
        self::assertSame([], $this->mailer->sent);

        for ($i = 0; $i < 5; $i++) {
            $this->post('/v1/auth/password-reset', ['email' => self::EMAIL]);
        }
        self::assertCount(3, $this->mailer->sent);
    }

    public function testPasswordResetEndsAllSessionsAndRejectsExpiredToken(): void
    {
        $accountId = $this->createAccount();
        $session = $this->tokenFrom($this->login(self::EMAIL, self::PASSWORD));
        $this->post('/v1/auth/password-reset', ['email' => self::EMAIL]);
        $this->post('/v1/auth/password-reset', ['email' => self::EMAIL]);
        $latest = $this->mailer->lastResetToken();

        $this->db->exec("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = '" . hash('sha256', $latest) . "'");
        self::assertSame(422, $this->post('/v1/auth/password-reset/confirm', ['token' => $latest, 'password' => 'new password 123'])->status);

        preg_match('#token=([A-Za-z0-9_-]+)#', $this->mailer->sent[0]['body'], $m);
        self::assertSame(204, $this->post('/v1/auth/password-reset/confirm', ['token' => $m[1], 'password' => 'new password 123'])->status);
        self::assertSame(401, $this->get('/v1/auth/me', $session)->status);
        self::assertSame(0, (int) $this->db->query("SELECT count(*) FROM password_reset_tokens WHERE account_id = $accountId AND used_at IS NULL")->fetchColumn());
    }

    public function testSessionsListAndDeleteOnlyOwn(): void
    {
        $this->createAccount();
        $this->createAccount(email: 'other@example.test');
        $login = $this->login(self::EMAIL, self::PASSWORD);
        [$token, $csrf] = [$this->tokenFrom($login), $login->decodedBody()['csrfToken']];
        $this->login(self::EMAIL, self::PASSWORD);
        $foreign = $this->tokenFrom($this->login('other@example.test', self::PASSWORD));
        $foreignId = (int) $this->db->query("SELECT id FROM sessions WHERE token_hash = '" . hash('sha256', $foreign) . "'")->fetchColumn();

        $items = $this->get('/v1/auth/sessions', $token)->decodedBody()['items'];
        self::assertCount(2, $items);
        self::assertSame([true], array_values(array_unique(array_column(array_filter($items, fn ($i) => $i['current']), 'current'))));

        self::assertSame(404, $this->request('DELETE', "/v1/auth/sessions/$foreignId", $token, $csrf)->status);
        self::assertSame(200, $this->get('/v1/auth/me', $foreign)->status);

        $otherOwn = array_values(array_filter($items, fn ($i) => !$i['current']))[0]['id'];
        self::assertSame(204, $this->request('DELETE', "/v1/auth/sessions/$otherOwn", $token, $csrf)->status);
        self::assertCount(1, $this->get('/v1/auth/sessions', $token)->decodedBody()['items']);
    }

    private function login(string $email, string $password): Response
    {
        return $this->post('/v1/auth/login', ['email' => $email, 'password' => $password]);
    }

    /** @param array<string, mixed> $body */
    private function post(string $path, array $body, ?string $session = null, ?string $csrf = null): Response
    {
        return $this->request('POST', $path, $session, $csrf, json_encode($body, JSON_THROW_ON_ERROR));
    }

    private function get(string $path, ?string $session): Response
    {
        return $this->request('GET', $path, $session);
    }

    private function request(string $method, string $path, ?string $session, ?string $csrf = null, string $body = ''): Response
    {
        $headers = array_filter([
            'Origin' => self::ORIGIN,
            'Content-Type' => $body === '' ? null : 'application/json',
            'X-CSRF-Token' => $csrf,
            'User-Agent' => 'PHPUnit',
        ]);

        return $this->app->handle(new Request($method, $path, $headers, cookies: $session === null ? [] : [self::COOKIE => $session], body: $body, clientIp: '192.0.2.1'));
    }

    private function tokenFrom(Response $response): string
    {
        self::assertSame(200, $response->status, $response->body);
        preg_match('#^__Host-vonica_sid=([^;]+);#', $response->cookies[0], $matches);

        return $matches[1];
    }
}
