<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

use PDO;
use Splk\Api\Http\HttpException;

/**
 * Rate limiting of logins by e-mail and IP in the database (hosting doc chap. 6).
 * The IP limit is loose on purpose: behind the hosting proxy REMOTE_ADDR may be shared.
 */
final class LoginThrottle
{
    public const WINDOW_MINUTES = 15;
    public const MAX_FAILURES_PER_EMAIL = 5;
    public const MAX_FAILURES_PER_IP = 50;

    public function __construct(private readonly PDO $db)
    {
    }

    public function assertAllowed(string $email, string $ip): void
    {
        $statement = $this->db->prepare(
            'SELECT
                count(*) FILTER (WHERE login_email = :email),
                count(*) FILTER (WHERE ip = CAST(:ip AS inet))
               FROM login_attempts
              WHERE NOT success AND at > now() - make_interval(mins => :window)
                AND (login_email = :email OR ip = CAST(:ip AS inet))'
        );
        $statement->execute(['email' => $email, 'ip' => self::ip($ip), 'window' => self::WINDOW_MINUTES]);
        [$byEmail, $byIp] = $statement->fetch(PDO::FETCH_NUM);

        if ($byEmail >= self::MAX_FAILURES_PER_EMAIL || $byIp >= self::MAX_FAILURES_PER_IP) {
            throw new HttpException(
                429,
                'too_many_attempts',
                'Too many failed login attempts. Try again later.',
                [],
                ['Retry-After' => (string) (self::WINDOW_MINUTES * 60)],
            );
        }
    }

    public function record(string $email, string $ip, bool $success): void
    {
        $this->db->prepare(
            'INSERT INTO login_attempts (login_email, ip, success) VALUES (:email, CAST(:ip AS inet), :success)'
        )->execute(['email' => $email, 'ip' => self::ip($ip), 'success' => $success ? 'true' : 'false']);
    }

    private static function ip(string $ip): ?string
    {
        return filter_var($ip, FILTER_VALIDATE_IP) === false ? null : $ip;
    }
}
