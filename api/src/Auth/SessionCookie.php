<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

/**
 * Host-only session cookie on api.vonica.cz: __Host- prefix, Secure, HttpOnly, SameSite=Lax, no Domain (D-12).
 * Local Docker over plain HTTP uses a cookie without the prefix and without Secure (config session.cookieSecure).
 */
final class SessionCookie
{
    public function __construct(
        public readonly string $name,
        private readonly bool $secure,
    ) {
        if (str_starts_with($name, '__Host-') && !$secure) {
            throw new \InvalidArgumentException('A __Host- cookie must be Secure.');
        }
    }

    public function issue(string $token, int $maxAgeSeconds): string
    {
        return $this->build($token, $maxAgeSeconds);
    }

    public function clear(): string
    {
        return $this->build('', 0);
    }

    private function build(string $value, int $maxAge): string
    {
        $parts = [$this->name . '=' . $value, 'Path=/', 'Max-Age=' . $maxAge, 'HttpOnly', 'SameSite=Lax'];
        if ($this->secure) {
            $parts[] = 'Secure';
        }

        return implode('; ', $parts);
    }
}
