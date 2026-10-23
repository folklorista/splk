<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Identity;

use PDO;

/** Persons, accounts, mandates and units as managed by organization.admin (api-v1 chap. 4.2, D-48). */
final class OrganizationRepository
{
    private const MANDATE_ACTIVE = 'm.revoked_at IS NULL AND m.valid_from <= current_date AND (m.valid_to IS NULL OR m.valid_to >= current_date)';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function units(): array
    {
        return array_map(self::unit(...), $this->db->query(
            'SELECT id, name, short_name, has_costume_fund, archived_at FROM units ORDER BY archived_at NULLS FIRST, id'
        )->fetchAll());
    }

    public function findUnit(int $id): ?array
    {
        $statement = $this->db->prepare('SELECT id, name, short_name, has_costume_fund, archived_at FROM units WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : self::unit($row);
    }

    /** @param array<string, mixed> $unit */
    public function insertUnit(array $unit, int $actor): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO units (name, short_name, has_costume_fund, created_by) VALUES (:name, :short, :fund, :actor) RETURNING id'
        );
        $statement->execute(['name' => $unit['name'], 'short' => $unit['shortName'], 'fund' => $unit['hasCostumeFund'] ? 'true' : 'false', 'actor' => $actor]);

        return (int) $statement->fetchColumn();
    }

    /** @param array<string, mixed> $unit */
    public function updateUnit(int $id, array $unit): void
    {
        $this->db->prepare(
            'UPDATE units SET name = :name, short_name = :short, has_costume_fund = :fund,
                    archived_at = CASE WHEN :archived THEN coalesce(archived_at, now()) ELSE NULL END
              WHERE id = :id'
        )->execute(['id' => $id, 'name' => $unit['name'], 'short' => $unit['shortName'],
            'fund' => $unit['hasCostumeFund'] ? 'true' : 'false', 'archived' => $unit['archived'] ? 'true' : 'false']);
    }

    /** Persons with their account and mandates valid today – the "Uživatelé a pověření" screen. */
    public function persons(): array
    {
        $persons = $this->db->query(
            'SELECT p.id, p.first_name, p.last_name, p.nickname, p.contact, p.note,
                    a.id AS account_id, a.login_email, a.status, a.last_login_at
               FROM persons p LEFT JOIN user_accounts a ON a.person_id = p.id
              ORDER BY p.last_name, p.first_name, p.id'
        )->fetchAll();
        $mandates = [];
        foreach ($this->activeMandates() as $mandate) {
            $mandates[$mandate['personId']][] = $mandate;
        }

        return array_map(static fn (array $row): array => self::person($row, $mandates[(int) $row['id']] ?? []), $persons);
    }

    public function findPerson(int $id): ?array
    {
        $statement = $this->db->prepare(
            'SELECT p.id, p.first_name, p.last_name, p.nickname, p.contact, p.note,
                    a.id AS account_id, a.login_email, a.status, a.last_login_at
               FROM persons p LEFT JOIN user_accounts a ON a.person_id = p.id
              WHERE p.id = :id'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        return self::person($row, array_values(array_filter($this->activeMandates(), static fn (array $m): bool => $m['personId'] === $id)));
    }

    /** @param array<string, mixed> $person */
    public function insertPerson(array $person, int $actor): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO persons (first_name, last_name, nickname, contact, note, created_by)
             VALUES (:first, :last, :nickname, :contact, :note, :actor) RETURNING id'
        );
        $statement->execute(self::personParams($person) + ['actor' => $actor]);

        return (int) $statement->fetchColumn();
    }

    /** @param array<string, mixed> $person */
    public function updatePerson(int $id, array $person): void
    {
        $this->db->prepare(
            'UPDATE persons SET first_name = :first, last_name = :last, nickname = :nickname, contact = :contact, note = :note WHERE id = :id'
        )->execute(self::personParams($person) + ['id' => $id]);
    }

    public function insertAccount(int $personId, string $email, int $actor): int
    {
        $statement = $this->db->prepare(
            "INSERT INTO user_accounts (person_id, login_email, status, created_by) VALUES (:person, :email, 'invited', :actor) RETURNING id"
        );
        $statement->execute(['person' => $personId, 'email' => $email, 'actor' => $actor]);

        return (int) $statement->fetchColumn();
    }

    /** @return array{id: int, personId: int, loginEmail: string, status: string, hasPassword: bool}|null */
    public function findAccount(int $id): ?array
    {
        $statement = $this->db->prepare('SELECT id, person_id, login_email, status, password_hash IS NOT NULL AS has_password FROM user_accounts WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : [
            'id' => (int) $row['id'],
            'personId' => (int) $row['person_id'],
            'loginEmail' => $row['login_email'],
            'status' => $row['status'],
            'hasPassword' => (bool) $row['has_password'],
        ];
    }

    public function setAccountStatus(int $id, string $status): void
    {
        $this->db->prepare('UPDATE user_accounts SET status = :status WHERE id = :id')->execute(['id' => $id, 'status' => $status]);
    }

    /** @return list<array<string, mixed>> */
    public function activeMandates(): array
    {
        return array_map(self::mandate(...), $this->db->query(
            'SELECT m.id, m.person_id, m.kind, m.scope_type, m.scope_id, u.name AS scope_name, m.valid_from
               FROM mandates m LEFT JOIN units u ON m.scope_type = \'unit\' AND u.id = m.scope_id
              WHERE ' . self::MANDATE_ACTIVE . ' ORDER BY m.id'
        )->fetchAll());
    }

    public function findActiveMandate(int $id): ?array
    {
        foreach ($this->activeMandates() as $mandate) {
            if ($mandate['id'] === $id) {
                return $mandate;
            }
        }

        return null;
    }

    public function hasActiveMandate(int $personId, string $kind, ?int $unitId): bool
    {
        $statement = $this->db->prepare(
            'SELECT 1 FROM mandates m WHERE m.person_id = :person AND m.kind = :kind AND m.scope_id IS NOT DISTINCT FROM :unit AND ' . self::MANDATE_ACTIVE
        );
        $statement->execute(['person' => $personId, 'kind' => $kind, 'unit' => $unitId]);

        return $statement->fetchColumn() !== false;
    }

    /** Active organization admins who can still sign in (an invited or disabled account cannot manage anything). */
    public function countUsableAdmins(): int
    {
        return (int) $this->db->query(
            "SELECT count(DISTINCT m.person_id) FROM mandates m
               JOIN user_accounts a ON a.person_id = m.person_id AND a.status = 'active'
              WHERE m.kind = 'organization.admin' AND " . self::MANDATE_ACTIVE
        )->fetchColumn();
    }

    public function insertMandate(int $personId, string $kind, ?int $unitId, int $actor): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO mandates (person_id, kind, scope_type, scope_id, granted_by)
             VALUES (:person, :kind, :scope, :unit, :actor) RETURNING id'
        );
        $statement->execute(['person' => $personId, 'kind' => $kind, 'scope' => $unitId === null ? 'organization' : 'unit', 'unit' => $unitId, 'actor' => $actor]);

        return (int) $statement->fetchColumn();
    }

    public function revokeMandate(int $id, int $actor): void
    {
        $this->db->prepare('UPDATE mandates SET revoked_at = now(), revoked_by = :actor WHERE id = :id')->execute(['id' => $id, 'actor' => $actor]);
    }

    /** @param array<string, mixed> $person */
    private static function personParams(array $person): array
    {
        return ['first' => $person['firstName'], 'last' => $person['lastName'], 'nickname' => $person['nickname'],
            'contact' => $person['contact'], 'note' => $person['note']];
    }

    private static function unit(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'shortName' => $row['short_name'],
            'hasCostumeFund' => (bool) $row['has_costume_fund'],
            'archived' => $row['archived_at'] !== null,
        ];
    }

    /** @param list<array<string, mixed>> $mandates */
    private static function person(array $row, array $mandates): array
    {
        return [
            'id' => (int) $row['id'],
            'firstName' => $row['first_name'],
            'lastName' => $row['last_name'],
            'nickname' => $row['nickname'],
            'contact' => $row['contact'],
            'note' => $row['note'],
            'account' => $row['account_id'] === null ? null : [
                'id' => (int) $row['account_id'],
                'loginEmail' => $row['login_email'],
                'status' => $row['status'],
                'lastLoginAt' => $row['last_login_at'] === null ? null : (new \DateTimeImmutable((string) $row['last_login_at']))->format(DATE_ATOM),
            ],
            'mandates' => array_map(static fn (array $m): array => array_diff_key($m, ['personId' => 0]), $mandates),
        ];
    }

    private static function mandate(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'personId' => (int) $row['person_id'],
            'kind' => $row['kind'],
            'scopeType' => $row['scope_type'],
            'scopeId' => $row['scope_id'] === null ? null : (int) $row['scope_id'],
            'scopeName' => $row['scope_name'],
            'validFrom' => $row['valid_from'],
        ];
    }
}
