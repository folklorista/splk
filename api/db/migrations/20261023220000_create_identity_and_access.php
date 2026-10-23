<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Identity and access for Krojařka v1 (api-v1-a-schema chap. 3.1, D-07, D-09, D-10, D-12).
 * Conventions (chap. 2.1): identity keys, timestamptz, states as text + CHECK, nothing deleted physically
 * where history depends on it. Mandate kinds are the v1 set from chap. 2.3.
 */
final class CreateIdentityAndAccess extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE EXTENSION IF NOT EXISTS citext;
            CREATE EXTENSION IF NOT EXISTS unaccent;
            CREATE EXTENSION IF NOT EXISTS pg_trgm;

            CREATE TABLE persons (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                first_name text NOT NULL,
                last_name text NOT NULL,
                nickname text,
                contact text,
                note text,
                default_costume text NOT NULL DEFAULT 'unspecified'
                    CHECK (default_costume IN ('male', 'female', 'unspecified')),
                deceased_at date,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint
            );

            CREATE TABLE user_accounts (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                person_id bigint NOT NULL UNIQUE REFERENCES persons (id),
                login_email citext NOT NULL UNIQUE,
                password_hash text,
                status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
                last_login_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                CHECK (status = 'invited' OR password_hash IS NOT NULL)
            );

            ALTER TABLE persons ADD FOREIGN KEY (created_by) REFERENCES user_accounts (id);

            CREATE TABLE sessions (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                token_hash text NOT NULL UNIQUE,
                account_id bigint NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
                csrf_token text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                last_seen_at timestamptz NOT NULL DEFAULT now(),
                expires_at timestamptz NOT NULL,
                user_agent text
            );
            CREATE INDEX sessions_account_id_idx ON sessions (account_id);

            CREATE TABLE login_attempts (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                login_email citext NOT NULL,
                ip inet,
                at timestamptz NOT NULL DEFAULT now(),
                success boolean NOT NULL
            );
            CREATE INDEX login_attempts_email_at_idx ON login_attempts (login_email, at);
            CREATE INDEX login_attempts_ip_at_idx ON login_attempts (ip, at);

            CREATE TABLE password_reset_tokens (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                account_id bigint NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
                token_hash text NOT NULL UNIQUE,
                created_at timestamptz NOT NULL DEFAULT now(),
                expires_at timestamptz NOT NULL,
                used_at timestamptz
            );
            CREATE INDEX password_reset_tokens_account_id_idx ON password_reset_tokens (account_id);

            CREATE TABLE units (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name text NOT NULL,
                short_name text,
                has_costume_fund boolean NOT NULL DEFAULT false,
                archived_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id)
            );

            CREATE TABLE unit_affiliations (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                person_id bigint NOT NULL REFERENCES persons (id),
                unit_id bigint NOT NULL REFERENCES units (id),
                status text NOT NULL CHECK (status IN ('interested', 'active')),
                valid_from date NOT NULL DEFAULT current_date,
                valid_to date,
                end_reason text,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                CHECK (valid_to IS NULL OR valid_to >= valid_from)
            );
            CREATE INDEX unit_affiliations_person_id_idx ON unit_affiliations (person_id);
            CREATE INDEX unit_affiliations_unit_id_idx ON unit_affiliations (unit_id);

            CREATE TABLE groups (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint REFERENCES units (id),
                name text NOT NULL,
                archived_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id)
            );

            CREATE TABLE group_memberships (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                group_id bigint NOT NULL REFERENCES groups (id),
                person_id bigint NOT NULL REFERENCES persons (id),
                valid_from date NOT NULL DEFAULT current_date,
                valid_to date,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                CHECK (valid_to IS NULL OR valid_to >= valid_from)
            );
            CREATE INDEX group_memberships_group_id_idx ON group_memberships (group_id);
            CREATE INDEX group_memberships_person_id_idx ON group_memberships (person_id);

            CREATE TABLE mandates (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                person_id bigint NOT NULL REFERENCES persons (id),
                kind text NOT NULL
                    CHECK (kind IN ('costumes.manage', 'costumes.view', 'costs.view', 'organization.admin')),
                scope_type text NOT NULL CHECK (scope_type IN ('organization', 'unit')),
                scope_id bigint,
                valid_from date NOT NULL DEFAULT current_date,
                valid_to date,
                granted_by bigint REFERENCES user_accounts (id),
                created_at timestamptz NOT NULL DEFAULT now(),
                CHECK ((scope_type = 'organization') = (scope_id IS NULL)),
                CHECK (valid_to IS NULL OR valid_to >= valid_from)
            );
            CREATE INDEX mandates_person_id_idx ON mandates (person_id);
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            DROP TABLE mandates;
            DROP TABLE group_memberships;
            DROP TABLE groups;
            DROP TABLE unit_affiliations;
            DROP TABLE units;
            DROP TABLE password_reset_tokens;
            DROP TABLE login_attempts;
            DROP TABLE sessions;
            ALTER TABLE persons DROP COLUMN created_by;
            DROP TABLE user_accounts;
            DROP TABLE persons;
            SQL);
    }
}
