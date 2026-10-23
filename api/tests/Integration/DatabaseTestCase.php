<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDO;
use Phinx\Console\PhinxApplication;
use Phinx\Wrapper\TextWrapper;
use PHPUnit\Framework\TestCase;
use Splk\Api\Infrastructure\Db\ConnectionFactory;

/**
 * Integration tests against PostgreSQL in Docker: database <DB_NAME>_test is created and migrated once per run,
 * every test runs in a transaction that is rolled back.
 */
abstract class DatabaseTestCase extends TestCase
{
    private static ?PDO $pdo = null;

    protected PDO $db;

    protected function setUp(): void
    {
        $this->db = self::connection();
        $this->db->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    /** @return array<string, mixed> */
    protected static function settings(string $database): array
    {
        return [
            'host' => getenv('DB_HOST') ?: 'db',
            'port' => (int) (getenv('DB_PORT') ?: 5432),
            'database' => $database,
            'user' => getenv('DB_USER') ?: 'splk',
            'password' => getenv('DB_PASSWORD') ?: 'splk',
            'sslmode' => 'disable',
        ];
    }

    protected function createAccount(string $status = 'active', string $email = 'krojarka@example.test'): int
    {
        $personId = (int) $this->db->query(
            "INSERT INTO persons (first_name, last_name) VALUES ('Anna', 'Testová') RETURNING id"
        )->fetchColumn();
        $statement = $this->db->prepare(
            'INSERT INTO user_accounts (person_id, login_email, password_hash, status)
             VALUES (:person, :email, :hash, :status) RETURNING id'
        );
        $statement->execute([
            'person' => $personId,
            'email' => $email,
            'hash' => password_hash('secret', PASSWORD_ARGON2ID),
            'status' => $status,
        ]);

        return (int) $statement->fetchColumn();
    }

    protected function createUnit(string $name = 'Vonica', bool $costumeFund = true): int
    {
        $statement = $this->db->prepare('INSERT INTO units (name, has_costume_fund) VALUES (:name, :fund) RETURNING id');
        $statement->execute(['name' => $name, 'fund' => $costumeFund ? 'true' : 'false']);

        return (int) $statement->fetchColumn();
    }

    /** @return int mandate id */
    protected function grant(int $accountId, string $kind, ?int $unitId = null): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO mandates (person_id, kind, scope_type, scope_id)
             SELECT person_id, :kind, :scope, :unit FROM user_accounts WHERE id = :account RETURNING id'
        );
        $statement->execute(['kind' => $kind, 'scope' => $unitId === null ? 'organization' : 'unit', 'unit' => $unitId, 'account' => $accountId]);

        return (int) $statement->fetchColumn();
    }

    private static function connection(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $database = (getenv('DB_NAME') ?: 'splk') . '_test';
        $admin = ConnectionFactory::create(self::settings('postgres'));
        $exists = $admin->prepare('SELECT 1 FROM pg_database WHERE datname = :name');
        $exists->execute(['name' => $database]);
        if ($exists->fetchColumn() === false) {
            $admin->exec('CREATE DATABASE ' . $database);
        }

        $phinx = new TextWrapper(new PhinxApplication(), [
            'configuration' => dirname(__DIR__, 2) . '/phinx.php',
            'environment' => 'testing',
        ]);
        $output = $phinx->getMigrate();
        if ($phinx->getExitCode() !== 0) {
            throw new \RuntimeException("Test database migration failed:\n" . $output);
        }

        return self::$pdo = ConnectionFactory::create(self::settings($database));
    }
}
