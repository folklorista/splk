<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit\Auth;

use PHPUnit\Framework\TestCase;
use Splk\Api\Auth\SessionCookie;

final class SessionCookieTest extends TestCase
{
    public function testProductionCookieIsHostOnlySecureHttpOnlyLax(): void
    {
        $cookie = (new SessionCookie('__Host-vonica_sid', true))->issue('token', 3600);

        self::assertSame('__Host-vonica_sid=token; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure', $cookie);
        self::assertStringNotContainsStringIgnoringCase('Domain', $cookie);
    }

    public function testClearExpiresCookie(): void
    {
        self::assertSame(
            'vonica_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
            (new SessionCookie('vonica_sid', false))->clear(),
        );
    }

    public function testHostPrefixRequiresSecure(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new SessionCookie('__Host-vonica_sid', false);
    }
}
