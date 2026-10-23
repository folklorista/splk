<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Catalog of a costume fund (api-v1-a-schema chap. 3.2, D-20, D-35, D-37), the audit log (chap. 3.7)
 * and revocation of mandates (a mandate is never deleted, it is revoked).
 * Catalog rows are archived, not deleted, because items will refer to them.
 */
final class CreateCatalogAndAudit extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE costume_regions (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                name text NOT NULL,
                parent_id bigint REFERENCES costume_regions (id),
                archived_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id)
            );
            CREATE UNIQUE INDEX costume_regions_name_uq ON costume_regions (unit_id, parent_id, lower(name)) NULLS NOT DISTINCT
                WHERE archived_at IS NULL;

            CREATE TABLE costume_part_types (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                name text NOT NULL,
                gender text CHECK (gender IN ('male', 'female')),
                region_id bigint REFERENCES costume_regions (id),
                numbered boolean NOT NULL DEFAULT true,
                archived_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id)
            );
            CREATE UNIQUE INDEX costume_part_types_name_uq ON costume_part_types (unit_id, gender, region_id, lower(name)) NULLS NOT DISTINCT
                WHERE archived_at IS NULL;

            CREATE TABLE costume_series (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                kind text NOT NULL CHECK (kind IN ('part', 'kit')),
                name text NOT NULL,
                part_type_id bigint REFERENCES costume_part_types (id),
                region_id bigint REFERENCES costume_regions (id),
                gender text CHECK (gender IN ('male', 'female')),
                variant text,
                allow_number_reuse boolean NOT NULL DEFAULT true,
                archived_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                CHECK ((kind = 'part') = (part_type_id IS NOT NULL))
            );
            CREATE UNIQUE INDEX costume_series_name_uq ON costume_series (unit_id, kind, gender, region_id, lower(name), lower(variant)) NULLS NOT DISTINCT
                WHERE archived_at IS NULL;

            CREATE TABLE audit_log (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                at timestamptz NOT NULL DEFAULT now(),
                actor_account_id bigint REFERENCES user_accounts (id),
                action text NOT NULL,
                entity_type text NOT NULL,
                entity_id bigint,
                unit_id bigint REFERENCES units (id),
                data jsonb
            );
            CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
            CREATE INDEX audit_log_unit_at_idx ON audit_log (unit_id, at);

            ALTER TABLE mandates
                ADD COLUMN revoked_at timestamptz,
                ADD COLUMN revoked_by bigint REFERENCES user_accounts (id);
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            ALTER TABLE mandates DROP COLUMN revoked_by, DROP COLUMN revoked_at;
            DROP TABLE audit_log;
            DROP TABLE costume_series;
            DROP TABLE costume_part_types;
            DROP TABLE costume_regions;
            SQL);
    }
}
