<?php

declare(strict_types=1);

namespace Splk\Api\Http;

use Splk\Api\Auth\Session;

/** Per-request data resolved by App: route parameters and, for authenticated routes, the session. */
final class RequestContext
{
    /** @param array<string, string> $params */
    public function __construct(
        public readonly array $params = [],
        public readonly ?Session $session = null,
    ) {
    }
}
