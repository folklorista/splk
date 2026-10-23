<?php

declare(strict_types=1);

namespace Splk\Api\Authorization;

use PDO;
use Splk\Api\Http\HttpException;

/**
 * Mandates of the signed-in person valid today – the only source of permissions (D-09, D-10, api-v1 chap. 2.3).
 * organization.admin gives no access to costume funds (D-48); there is no superadmin.
 */
final class Mandates
{
    /** @param list<array{kind: string, scope_type: string, scope_id: ?int}> $mandates */
    private function __construct(private readonly array $mandates)
    {
    }

    public static function forAccount(PDO $db, int $accountId): self
    {
        $statement = $db->prepare(
            'SELECT m.kind, m.scope_type, m.scope_id
               FROM mandates m JOIN user_accounts a ON a.person_id = m.person_id
              WHERE a.id = :account AND m.revoked_at IS NULL
                AND m.valid_from <= current_date AND (m.valid_to IS NULL OR m.valid_to >= current_date)'
        );
        $statement->execute(['account' => $accountId]);

        return new self(array_map(static fn (array $row): array => [
            'kind' => $row['kind'],
            'scope_type' => $row['scope_type'],
            'scope_id' => $row['scope_id'] === null ? null : (int) $row['scope_id'],
        ], $statement->fetchAll()));
    }

    public function isOrganizationAdmin(): bool
    {
        return $this->has('organization.admin', null);
    }

    public function canManageFund(int $unitId): bool
    {
        return $this->has('costumes.manage', $unitId);
    }

    public function canViewFund(int $unitId): bool
    {
        return $this->canManageFund($unitId) || $this->has('costumes.view', $unitId) || $this->has('costumes.view', null);
    }

    /** @throws HttpException 403 for everybody without organization.admin */
    public function requireOrganizationAdmin(): void
    {
        if (!$this->isOrganizationAdmin()) {
            throw new HttpException(403, 'forbidden', 'Organization administration requires organization.admin.');
        }
    }

    /** $unitId null = a mandate for the whole organization */
    private function has(string $kind, ?int $unitId): bool
    {
        foreach ($this->mandates as $mandate) {
            if ($mandate['kind'] !== $kind) {
                continue;
            }
            if ($mandate['scope_type'] === 'organization' || ($unitId !== null && $mandate['scope_id'] === $unitId)) {
                return true;
            }
        }

        return false;
    }
}
