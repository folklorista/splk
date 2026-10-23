<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Infrastructure\Db\Connection;

/** GET /v1/health – code version and the latest applied migration, used by deploy (D-45). */
final class HealthController
{
    public function __construct(
        private readonly Connection $db,
        private readonly string $version,
    ) {
    }

    public function __invoke(Request $request, RequestContext $context): Response
    {
        try {
            $pdo = $this->db->pdo();
            $migration = null;
            if ($pdo->query("SELECT to_regclass('phinxlog') IS NOT NULL")->fetchColumn()) {
                $row = $pdo->query(
                    'SELECT version, migration_name FROM phinxlog ORDER BY version DESC LIMIT 1'
                )->fetch();
                $migration = $row === false ? null : ['version' => (string) $row['version'], 'name' => $row['migration_name']];
            }
        } catch (\PDOException $e) {
            error_log('Health check: database unavailable: ' . $e->getMessage());

            return Response::json(['status' => 'error', 'version' => $this->version, 'database' => 'unavailable'], 503);
        }

        return Response::json(['status' => 'ok', 'version' => $this->version, 'database' => 'ok', 'migration' => $migration]);
    }
}
