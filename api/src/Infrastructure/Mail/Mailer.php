<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Mail;

interface Mailer
{
    /** Sends a plain-text e-mail; throws on failure. */
    public function send(string $to, string $subject, string $body): void;
}
