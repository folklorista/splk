<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Request;
use Splk\Api\Http\Response;

/** Kernel behaviour that needs no database; session and health against PostgreSQL are in Integration. */
final class AppTest extends TestCase
{
    private const ORIGIN = 'https://krojarka.vonica.cz';

    private App $app;
    private string $errorLog;

    protected function setUp(): void
    {
        // unreachable database: connection refused immediately
        $this->app = new App(new Config([
            'db' => ['host' => '127.0.0.1', 'port' => 1, 'database' => 'none', 'user' => 'none', 'password' => '', 'sslmode' => 'disable'],
            'cors' => ['allowedOrigins' => [self::ORIGIN]],
        ]));
        $this->errorLog = (string) ini_get('error_log');
        ini_set('error_log', '/dev/null');
    }

    protected function tearDown(): void
    {
        ini_set('error_log', $this->errorLog);
    }

    public function testPreflightFromAllowedOrigin(): void
    {
        $response = $this->app->handle(new Request('OPTIONS', '/v1/anything', ['Origin' => self::ORIGIN]));

        self::assertSame(204, $response->status);
        self::assertSame(self::ORIGIN, $response->header('Access-Control-Allow-Origin'));
        self::assertSame('Content-Type, X-CSRF-Token', $response->header('Access-Control-Allow-Headers'));
    }

    public function testPreflightFromForeignOriginIsRejectedWithoutCors(): void
    {
        $response = $this->app->handle(new Request('OPTIONS', '/v1/anything', ['Origin' => 'https://evil.example']));

        self::assertSame(403, $response->status);
        self::assertNull($response->header('Access-Control-Allow-Origin'));
    }

    public function testUnknownPathIsJson404(): void
    {
        $response = $this->app->handle(new Request('GET', '/v1/nope'));

        self::assertSame(404, $response->status);
        self::assertSame(['error' => ['code' => 'not_found', 'message' => 'Not found.']], $response->decodedBody());
    }

    public function testWrongMethodIs405(): void
    {
        $response = $this->app->handle(new Request('POST', '/v1/health', ['Origin' => self::ORIGIN]));

        self::assertSame(405, $response->status);
        self::assertSame('GET, OPTIONS', $response->header('Allow'));
    }

    public function testAuthenticatedRouteWithoutCookieIs401(): void
    {
        $this->app->router->add('GET', '/v1/private', fn () => Response::json(['secret' => true]));

        $response = $this->app->handle(new Request('GET', '/v1/private'));

        self::assertSame(401, $response->status);
        self::assertSame('unauthenticated', $response->decodedBody()['error']['code']);
    }

    public function testUnexpectedErrorDoesNotLeakDetails(): void
    {
        $this->app->router->add('GET', '/v1/boom', fn () => throw new \RuntimeException('SQLSTATE secret detail'), ['auth' => false]);

        $response = $this->app->handle(new Request('GET', '/v1/boom'));

        self::assertSame(500, $response->status);
        self::assertStringNotContainsString('secret', $response->body);
    }

    public function testHealthReportsUnavailableDatabase(): void
    {
        $response = $this->app->handle(new Request('GET', '/v1/health'));

        self::assertSame(503, $response->status);
        self::assertSame(['status' => 'error', 'version' => 'dev', 'database' => 'unavailable'], $response->decodedBody());
    }
}
