<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Audit;

use PDO;

/** Every write of the API leaves a row here (api-v1-a-schema chap. 3.7), in the same transaction as the write. */
final class AuditLog
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @param array<string, mixed> $data what changed – never passwords or tokens */
    public function record(int $actorAccountId, string $action, string $entityType, ?int $entityId, ?int $unitId = null, array $data = []): void
    {
        $this->db->prepare(
            'INSERT INTO audit_log (actor_account_id, action, entity_type, entity_id, unit_id, data)
             VALUES (:actor, :action, :type, :id, :unit, CAST(:data AS jsonb))'
        )->execute([
            'actor' => $actorAccountId,
            'action' => $action,
            'type' => $entityType,
            'id' => $entityId,
            'unit' => $unitId,
            'data' => json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
    }
}
