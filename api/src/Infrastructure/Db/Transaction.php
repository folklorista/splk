<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Db;

use PDO;

/**
 * Runs a unit of work atomically. Inside an open transaction it uses a savepoint, so a failed statement
 * (e.g. a unique violation turned into a 422) does not abort the outer transaction.
 */
final class Transaction
{
    private static int $depth = 0;

    /**
     * @template T
     * @param callable(): T $work
     * @return T
     */
    public static function run(PDO $db, callable $work): mixed
    {
        $nested = $db->inTransaction();
        $savepoint = 'sp_' . ++self::$depth;
        $nested ? $db->exec("SAVEPOINT $savepoint") : $db->beginTransaction();
        try {
            $result = $work();
            $nested ? $db->exec("RELEASE SAVEPOINT $savepoint") : $db->commit();

            return $result;
        } catch (\Throwable $e) {
            $nested ? $db->exec("ROLLBACK TO SAVEPOINT $savepoint") : $db->rollBack();
            throw $e;
        } finally {
            self::$depth--;
        }
    }

    /** SQLSTATE 23505 – a unique index rejected the row. */
    public static function isUniqueViolation(\Throwable $e): bool
    {
        return $e instanceof \PDOException && $e->getCode() === '23505';
    }
}
