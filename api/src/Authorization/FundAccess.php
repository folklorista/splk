<?php

declare(strict_types=1);

namespace Splk\Api\Authorization;

use PDO;
use Splk\Api\Http\HttpException;

/**
 * Access to the costume fund of a unit (D-21): 404 when the fund does not exist or the user has no mandate for it
 * (its existence is not revealed), 403 when a read-only mandate tries to write.
 */
final class FundAccess
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function require(Mandates $mandates, string $unitId, bool $write): int
    {
        $id = filter_var($unitId, FILTER_VALIDATE_INT);
        if ($id === false || !$mandates->canViewFund($id) || !$this->fundExists($id)) {
            throw new HttpException(404, 'not_found', 'Not found.');
        }
        if ($write && !$mandates->canManageFund($id)) {
            throw new HttpException(403, 'forbidden', 'Read-only access to this fund.');
        }

        return $id;
    }

    private function fundExists(int $unitId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM units WHERE id = :id AND has_costume_fund AND archived_at IS NULL');
        $statement->execute(['id' => $unitId]);

        return $statement->fetchColumn() !== false;
    }
}
