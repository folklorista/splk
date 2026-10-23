<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDOException;

final class MigrationTest extends DatabaseTestCase
{
    public function testIdentityAndAccessTablesExist(): void
    {
        $tables = $this->db->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )->fetchAll(\PDO::FETCH_COLUMN);

        foreach (['persons', 'user_accounts', 'sessions', 'login_attempts', 'password_reset_tokens', 'units',
            'unit_affiliations', 'groups', 'group_memberships', 'mandates'] as $table) {
            self::assertContains($table, $tables);
        }
    }

    public function testLoginEmailIsCaseInsensitiveUnique(): void
    {
        $this->createAccount(email: 'Krojarka@Example.test');

        $this->expectException(PDOException::class);
        $this->createAccount(email: 'krojarka@example.test');
    }

    public function testActiveAccountRequiresPassword(): void
    {
        $personId = $this->db->query("INSERT INTO persons (first_name, last_name) VALUES ('A', 'B') RETURNING id")->fetchColumn();

        $this->expectException(PDOException::class);
        $this->db->exec("INSERT INTO user_accounts (person_id, login_email, status) VALUES ($personId, 'a@b.test', 'active')");
    }

    public function testMandateScopeMustMatchScopeType(): void
    {
        $personId = $this->db->query("INSERT INTO persons (first_name, last_name) VALUES ('A', 'B') RETURNING id")->fetchColumn();
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type) VALUES ($personId, 'organization.admin', 'organization')");

        $this->expectException(PDOException::class);
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type) VALUES ($personId, 'costumes.manage', 'unit')");
    }

    public function testUnknownMandateKindIsRejected(): void
    {
        $personId = $this->db->query("INSERT INTO persons (first_name, last_name) VALUES ('A', 'B') RETURNING id")->fetchColumn();

        $this->expectException(PDOException::class);
        $this->db->exec("INSERT INTO mandates (person_id, kind, scope_type) VALUES ($personId, 'superadmin', 'organization')");
    }

    public function testSearchExtensionsAreEnabled(): void
    {
        $extensions = $this->db->query('SELECT extname FROM pg_extension')->fetchAll(\PDO::FETCH_COLUMN);

        self::assertEqualsCanonicalizing(['citext', 'pg_trgm', 'plpgsql', 'unaccent'], $extensions);
    }
}
