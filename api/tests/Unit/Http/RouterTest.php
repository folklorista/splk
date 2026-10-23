<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit\Http;

use PHPUnit\Framework\TestCase;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

final class RouterTest extends TestCase
{
    private Router $router;

    protected function setUp(): void
    {
        $this->router = new Router();
        $this->router->add('GET', '/v1/items/{id}', fn () => Response::noContent());
        $this->router->add('PATCH', '/v1/items/{id}', fn () => Response::noContent(), ['auth' => false]);
    }

    public function testMatchesPathParametersAndDefaultsToAuthenticated(): void
    {
        $route = $this->router->match('GET', '/v1/items/42');

        self::assertSame(['id' => '42'], $route['params']);
        self::assertTrue($route['options']['auth']);
        self::assertFalse($this->router->match('PATCH', '/v1/items/42')['options']['auth']);
    }

    public function testParameterDoesNotSpanSegments(): void
    {
        $this->expectExceptionObject(new HttpException(404, 'not_found', 'Not found.'));
        $this->router->match('GET', '/v1/items/42/history');
    }

    public function testUnknownMethodOnKnownPathIs405WithAllowHeader(): void
    {
        try {
            $this->router->match('DELETE', '/v1/items/42');
            self::fail('Expected 405');
        } catch (HttpException $e) {
            self::assertSame(405, $e->status);
            self::assertSame('GET, PATCH, OPTIONS', $e->headers['Allow']);
        }
    }
}
