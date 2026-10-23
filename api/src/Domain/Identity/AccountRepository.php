<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Identity;

use PDO;

final class AccountRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return array{id: int, person_id: int, password_hash: ?string, status: string}|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->db->prepare(
            'SELECT id, person_id, password_hash, status FROM user_accounts WHERE login_email = :email'
        );
        $statement->execute(['email' => $email]);

        return self::account($statement->fetch());
    }

    /** @return array{id: int, person_id: int, password_hash: ?string, status: string}|null */
    public function findById(int $id): ?array
    {
        $statement = $this->db->prepare('SELECT id, person_id, password_hash, status FROM user_accounts WHERE id = :id');
        $statement->execute(['id' => $id]);

        return self::account($statement->fetch());
    }

    /** Account, person and mandates valid today – the body of GET /v1/auth/me without the CSRF token. */
    public function profile(int $accountId): array
    {
        $statement = $this->db->prepare(
            'SELECT a.id, a.login_email, a.status, p.id AS person_id, p.first_name, p.last_name, p.nickname
               FROM user_accounts a JOIN persons p ON p.id = a.person_id
              WHERE a.id = :id'
        );
        $statement->execute(['id' => $accountId]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new \RuntimeException("Account $accountId not found");
        }

        $mandates = $this->db->prepare(
            "SELECT m.id, m.kind, m.scope_type, m.scope_id, u.name AS scope_name
               FROM mandates m
               LEFT JOIN units u ON m.scope_type = 'unit' AND u.id = m.scope_id
              WHERE m.person_id = :person
                AND m.valid_from <= current_date AND (m.valid_to IS NULL OR m.valid_to >= current_date)
              ORDER BY m.id"
        );
        $mandates->execute(['person' => $row['person_id']]);

        return [
            'account' => ['id' => (int) $row['id'], 'loginEmail' => $row['login_email'], 'status' => $row['status']],
            'person' => [
                'id' => (int) $row['person_id'],
                'firstName' => $row['first_name'],
                'lastName' => $row['last_name'],
                'nickname' => $row['nickname'],
            ],
            'mandates' => array_map(static fn (array $m): array => [
                'id' => (int) $m['id'],
                'kind' => $m['kind'],
                'scopeType' => $m['scope_type'],
                'scopeId' => $m['scope_id'] === null ? null : (int) $m['scope_id'],
                'scopeName' => $m['scope_name'],
            ], $mandates->fetchAll()),
        ];
    }

    public function recordLogin(int $accountId): void
    {
        $this->db->prepare('UPDATE user_accounts SET last_login_at = now() WHERE id = :id')->execute(['id' => $accountId]);
    }

    /** Sets a new password; an invited account becomes active (first password via the reset link). */
    public function setPassword(int $accountId, string $hash): void
    {
        $this->db->prepare(
            "UPDATE user_accounts
                SET password_hash = :hash, status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
              WHERE id = :id"
        )->execute(['hash' => $hash, 'id' => $accountId]);
    }

    /** @return array{id: int, person_id: int, password_hash: ?string, status: string}|null */
    private static function account(array|false $row): ?array
    {
        if ($row === false) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'person_id' => (int) $row['person_id'],
            'password_hash' => $row['password_hash'],
            'status' => $row['status'],
        ];
    }
}
