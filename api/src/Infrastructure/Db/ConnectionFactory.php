<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Db;

use PDO;

/** Creates PDO connections to PostgreSQL with the settings from hosting doc chap. 7. */
final class ConnectionFactory
{
    /** @param array<string, mixed> $db keys host, port, database, user, password, sslmode */
    public static function create(array $db): PDO
    {
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
            $db['host'] ?? 'localhost',
            (int) ($db['port'] ?? 5432),
            $db['database'] ?? '',
            $db['sslmode'] ?? 'prefer',
        );

        $pdo = new PDO($dsn, (string) ($db['user'] ?? ''), (string) ($db['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET TIME ZONE 'Europe/Prague'");
        $pdo->exec("SET statement_timeout = '30s'");

        return $pdo;
    }
}
