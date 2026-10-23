<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Mail;

/** Local development: e-mails go to the PHP error log (docker compose logs api) instead of SMTP. */
final class LogMailer implements Mailer
{
    public function send(string $to, string $subject, string $body): void
    {
        error_log("Mail to $to: $subject\n$body");
    }
}
