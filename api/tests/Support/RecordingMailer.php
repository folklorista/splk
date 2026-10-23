<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Support;

use Splk\Api\Infrastructure\Mail\Mailer;

final class RecordingMailer implements Mailer
{
    /** @var list<array{to: string, subject: string, body: string}> */
    public array $sent = [];

    public function send(string $to, string $subject, string $body): void
    {
        $this->sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];
    }

    /** Token from the reset link in the last e-mail. */
    public function lastResetToken(): string
    {
        $body = end($this->sent)['body'] ?? '';
        if (!preg_match('#/obnova-hesla\?token=([A-Za-z0-9_-]+)#', $body, $matches)) {
            throw new \RuntimeException('No reset link in the last e-mail');
        }

        return $matches[1];
    }
}
