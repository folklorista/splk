<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit\Http;

use PHPUnit\Framework\TestCase;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Request;

final class RequestTest extends TestCase
{
    public function testHeadersAreCaseInsensitive(): void
    {
        $request = new Request('GET', '/', ['X-CSRF-Token' => 'abc', 'Content-Type' => 'Application/JSON; charset=utf-8']);

        self::assertSame('abc', $request->header('x-csrf-token'));
        self::assertSame('application/json', $request->mediaType());
    }

    public function testJsonBody(): void
    {
        self::assertSame(['name' => 'Kroj'], (new Request('POST', '/', body: '{"name":"Kroj"}'))->json());
        self::assertSame([], (new Request('POST', '/'))->json());
    }

    public function testInvalidJsonIs400(): void
    {
        foreach (['{broken', '"text"'] as $body) {
            try {
                (new Request('POST', '/', body: $body))->json();
                self::fail('Expected invalid_json');
            } catch (HttpException $e) {
                self::assertSame([400, 'invalid_json'], [$e->status, $e->errorCode]);
            }
        }
    }
}
