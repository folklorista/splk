<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Request;
use Splk\Api\Http\Response;
use Splk\Api\Infrastructure\Db\Connection;
use Splk\Api\Tests\Support\RecordingMailer;

/** Endpoint tests through the kernel with a real database; sessions are created directly (no Argon2 login). */
abstract class ApiTestCase extends DatabaseTestCase
{
    protected const ORIGIN = 'https://krojarka.vonica.cz';
    protected const COOKIE = '__Host-vonica_sid';

    protected App $app;
    protected RecordingMailer $mailer;

    /** @var array{token: string, csrf: string}|null */
    private ?array $signedIn = null;

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

    /** Requests from now on run as this account. */
    protected function signInAs(int $accountId): void
    {
        ['token' => $token, 'session' => $session] = $this->app->sessions()->create($accountId, 'PHPUnit');
        $this->signedIn = ['token' => $token, 'csrf' => $session->csrfToken];
    }

    protected function signOut(): void
    {
        $this->signedIn = null;
    }

    protected function get(string $path): Response
    {
        return $this->send('GET', $path);
    }

    /** @param array<string, mixed> $body */
    protected function post(string $path, array $body = []): Response
    {
        return $this->send('POST', $path, $body);
    }

    /** @param array<string, mixed> $body */
    protected function patch(string $path, array $body): Response
    {
        return $this->send('PATCH', $path, $body);
    }

    protected function delete(string $path): Response
    {
        return $this->send('DELETE', $path);
    }

    /** @param array<string, mixed>|null $body */
    protected function send(string $method, string $path, ?array $body = null): Response
    {
        $headers = ['Origin' => self::ORIGIN];
        if ($body !== null) {
            $headers['Content-Type'] = 'application/json';
        }
        if ($this->signedIn !== null) {
            $headers['X-CSRF-Token'] = $this->signedIn['csrf'];
        }

        return $this->app->handle(new Request(
            $method,
            $path,
            $headers,
            cookies: $this->signedIn === null ? [] : [self::COOKIE => $this->signedIn['token']],
            body: $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR),
            clientIp: '192.0.2.1',
        ));
    }

    protected static function assertStatus(int $expected, Response $response): void
    {
        self::assertSame($expected, $response->status, $response->body);
    }

    protected static function assertError(int $status, string $code, Response $response): void
    {
        self::assertStatus($status, $response);
        self::assertSame($code, $response->decodedBody()['error']['code']);
    }

    protected function auditCount(string $action): int
    {
        $statement = $this->db->prepare('SELECT count(*) FROM audit_log WHERE action = :action');
        $statement->execute(['action' => $action]);

        return (int) $statement->fetchColumn();
    }
}
