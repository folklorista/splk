<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

use PDO;

/**
 * Server-side sessions in PostgreSQL (D-12, hosting doc chap. 6).
 * The cookie carries a random 256-bit token; only its SHA-256 hash is stored.
 * An unknown token is never accepted as a new session (no session fixation).
 */
final class SessionStore
{
    private const TOUCH_INTERVAL_SECONDS = 300;

    public function __construct(
        private readonly PDO $db,
        private readonly int $absoluteLifetimeSeconds,
        private readonly int $idleTimeoutSeconds,
    ) {
    }

    /** @return array{token: string, session: Session} the token goes to the cookie only */
    public function create(int $accountId, ?string $userAgent): array
    {
        $token = self::randomToken();
        $statement = $this->db->prepare(
            'INSERT INTO sessions (token_hash, account_id, csrf_token, expires_at, user_agent)
             VALUES (:hash, :account, :csrf, now() + make_interval(secs => :lifetime), :agent)
             RETURNING id, account_id, csrf_token, last_seen_at, expires_at'
        );
        $statement->execute([
            'hash' => self::hash($token),
            'account' => $accountId,
            'csrf' => self::randomToken(),
            'lifetime' => $this->absoluteLifetimeSeconds,
            'agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
        ]);

        return ['token' => $token, 'session' => self::fromRow($statement->fetch())];
    }

    /** Returns a live session of an active account, refreshing last_seen_at at most every few minutes. */
    public function findByToken(string $token): ?Session
    {
        $statement = $this->db->prepare(
            "SELECT s.id, s.account_id, s.csrf_token, s.last_seen_at, s.expires_at
               FROM sessions s
               JOIN user_accounts a ON a.id = s.account_id
              WHERE s.token_hash = :hash
                AND s.expires_at > now()
                AND s.last_seen_at > now() - make_interval(secs => :idle)
                AND a.status = 'active'"
        );
        $statement->execute(['hash' => self::hash($token), 'idle' => $this->idleTimeoutSeconds]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        $session = self::fromRow($row);
        if ($session->lastSeenAt < new \DateTimeImmutable('-' . self::TOUCH_INTERVAL_SECONDS . ' seconds')) {
            $this->db->prepare('UPDATE sessions SET last_seen_at = now() WHERE id = :id')->execute(['id' => $session->id]);
        }

        return $session;
    }

    public function destroy(int $sessionId): void
    {
        $this->db->prepare('DELETE FROM sessions WHERE id = :id')->execute(['id' => $sessionId]);
    }

    public function destroyAllForAccount(int $accountId): void
    {
        $this->db->prepare('DELETE FROM sessions WHERE account_id = :account')->execute(['account' => $accountId]);
    }

    public function deleteExpired(): int
    {
        $statement = $this->db->prepare(
            'DELETE FROM sessions WHERE expires_at <= now() OR last_seen_at <= now() - make_interval(secs => :idle)'
        );
        $statement->execute(['idle' => $this->idleTimeoutSeconds]);

        return $statement->rowCount();
    }

    private static function randomToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    /** @param array<string, mixed> $row */
    private static function fromRow(array $row): Session
    {
        return new Session(
            (int) $row['id'],
            (int) $row['account_id'],
            (string) $row['csrf_token'],
            new \DateTimeImmutable((string) $row['last_seen_at']),
            new \DateTimeImmutable((string) $row['expires_at']),
        );
    }
}
