<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Mail;

use PHPMailer\PHPMailer\PHPMailer;

/** SMTP through smtp.websupport.cz from krojarka@vonica.cz (D-55, D-56). */
final class SmtpMailer implements Mailer
{
    /** @param array<string, mixed> $settings keys host, port, secure, username, password, from, fromName */
    public function __construct(private readonly array $settings)
    {
    }

    public function send(string $to, string $subject, string $body): void
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string) $this->settings['host'];
        $mail->Port = (int) ($this->settings['port'] ?? 465);
        $mail->SMTPSecure = (string) ($this->settings['secure'] ?? PHPMailer::ENCRYPTION_SMTPS);
        $mail->SMTPAuth = true;
        $mail->Username = (string) $this->settings['username'];
        $mail->Password = (string) $this->settings['password'];
        $mail->Timeout = 15;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->setFrom((string) $this->settings['from'], (string) ($this->settings['fromName'] ?? ''));
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->send();
    }
}
