<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Infrastructure\Db\Connection;

/** Kernel with a real database: health and session + CSRF on authenticated routes. */
final class AppTest extends DatabaseTestCase
{
    private const ORIGIN = 'https://krojarka.vonica.cz';
    private const COOKIE = '__Host-vonica_sid';

    private App $app;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app = new App(new Config(['cors' => ['allowedOrigins' => [self::ORIGIN]]]), Connection::fromPdo($this->db));
        $handler = fn (Request $request, RequestContext $context) => Response::json(['accountId' => $context->session?->accountId]);
        $this->app->router->add('GET', '/v1/private', $handler);
        $this->app->router->add('POST', '/v1/private', $handler);
    }

    public function testHealthReportsLatestMigration(): void
    {
        $response = $this->app->handle(new Request('GET', '/v1/health'));

        self::assertSame(200, $response->status);
        self::assertSame(
            ['status' => 'ok', 'version' => 'dev', 'database' => 'ok', 'migration' => ['version' => '20261023220000', 'name' => 'CreateIdentityAndAccess']],
            $response->decodedBody(),
        );
    }

    public function testValidSessionCookieAuthenticatesRead(): void
    {
        $accountId = $this->createAccount();
        $token = $this->app->sessions()->create($accountId, null)['token'];

        $response = $this->app->handle(new Request('GET', '/v1/private', cookies: [self::COOKIE => $token]));

        self::assertSame(200, $response->status);
        self::assertSame(['accountId' => $accountId], $response->decodedBody());
    }

    public function testUnknownSessionCookieIs401(): void
    {
        $response = $this->app->handle(new Request('GET', '/v1/private', cookies: [self::COOKIE => 'forged']));

        self::assertSame(401, $response->status);
    }

    public function testWriteRequiresCsrfToken(): void
    {
        $accountId = $this->createAccount();
        ['token' => $token, 'session' => $session] = $this->app->sessions()->create($accountId, null);
        $write = fn (?string $csrf) => $this->app->handle(new Request(
            'POST',
            '/v1/private',
            array_filter(['Origin' => self::ORIGIN, 'Content-Type' => 'application/json', 'X-CSRF-Token' => $csrf]),
            cookies: [self::COOKIE => $token],
            body: '{}',
        ));

        self::assertSame('csrf_token_invalid', $write(null)->decodedBody()['error']['code']);
        self::assertSame(403, $write('wrong')->status);

        $response = $write($session->csrfToken);
        self::assertSame(200, $response->status);
        self::assertSame(self::ORIGIN, $response->header('Access-Control-Allow-Origin'));
    }
}
