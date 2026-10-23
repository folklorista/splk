<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestPolicy;
use Splk\Api\Http\Response;

final class RequestPolicyTest extends TestCase
{
    private const ORIGIN = 'https://krojarka.vonica.cz';

    private RequestPolicy $policy;

    protected function setUp(): void
    {
        $this->policy = new RequestPolicy([self::ORIGIN]);
    }

    /** @return iterable<string, array{string}> */
    public static function foreignOrigins(): iterable
    {
        yield 'foreign' => ['https://evil.example'];
        yield 'suffix' => ['https://krojarka.vonica.cz.evil.example'];
        yield 'plain http' => ['http://krojarka.vonica.cz'];
        yield 'null' => ['null'];
    }

    #[DataProvider('foreignOrigins')]
    public function testRejectsForeignOriginEvenForReads(string $origin): void
    {
        $this->assertRejected(new Request('GET', '/v1/health', ['Origin' => $origin]), 403, 'origin_not_allowed');
    }

    public function testAllowsReadWithoutOrigin(): void
    {
        $this->policy->check(new Request('GET', '/v1/health'));
        $this->addToAssertionCount(1);
    }

    public function testRejectsWriteWithoutOrigin(): void
    {
        $this->assertRejected($this->post(['Content-Type' => 'application/json'], origin: null), 403, 'origin_required');
    }

    public function testRejectsCrossSiteWrite(): void
    {
        $this->assertRejected(
            $this->post(['Content-Type' => 'application/json', 'Sec-Fetch-Site' => 'cross-site']),
            403,
            'cross_site_request',
        );
    }

    public function testRejectsNonJsonBody(): void
    {
        $this->assertRejected($this->post(['Content-Type' => 'text/plain']), 415, 'unsupported_media_type');
        $this->assertRejected($this->post([]), 415, 'unsupported_media_type');
    }

    public function testAllowsSameSiteJsonWrite(): void
    {
        $this->policy->check($this->post(['Content-Type' => 'application/json; charset=utf-8', 'Sec-Fetch-Site' => 'same-site']));
        $this->policy->check(new Request('DELETE', '/v1/x', ['Origin' => self::ORIGIN]));
        $this->addToAssertionCount(1);
    }

    public function testDecorateAddsCorsOnlyForAllowedOrigin(): void
    {
        $allowed = $this->policy->decorate(new Request('GET', '/', ['Origin' => self::ORIGIN]), Response::noContent());
        $foreign = $this->policy->decorate(new Request('GET', '/', ['Origin' => 'https://evil.example']), Response::noContent());

        self::assertSame(self::ORIGIN, $allowed->header('Access-Control-Allow-Origin'));
        self::assertSame('true', $allowed->header('Access-Control-Allow-Credentials'));
        self::assertNull($foreign->header('Access-Control-Allow-Origin'));
        foreach ([$allowed, $foreign] as $response) {
            self::assertSame('Origin', $response->header('Vary'));
            self::assertSame('no-store', $response->header('Cache-Control'));
            self::assertSame('nosniff', $response->header('X-Content-Type-Options'));
        }
    }

    /** @param array<string, string> $headers */
    private function post(array $headers, ?string $origin = self::ORIGIN): Request
    {
        if ($origin !== null) {
            $headers['Origin'] = $origin;
        }

        return new Request('POST', '/v1/x', $headers, body: '{"a":1}');
    }

    private function assertRejected(Request $request, int $status, string $code): void
    {
        try {
            $this->policy->check($request);
            self::fail("Expected $status $code");
        } catch (HttpException $e) {
            self::assertSame([$status, $code], [$e->status, $e->errorCode]);
        }
    }
}
