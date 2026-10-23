<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

final class Session
{
    public function __construct(
        public readonly int $id,
        public readonly int $accountId,
        public readonly string $csrfToken,
        public readonly \DateTimeImmutable $lastSeenAt,
        public readonly \DateTimeImmutable $expiresAt,
    ) {
    }

    /** Synchronizer token check (hosting doc chap. 7, layer 4). */
    public function isValidCsrfToken(?string $token): bool
    {
        return $token !== null && $token !== '' && hash_equals($this->csrfToken, $token);
    }
}
