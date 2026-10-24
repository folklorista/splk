<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Private files and retained metadata; paper scans never manufacture loan or verification history. */
final class CreateAttachments extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE attachments (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
                unit_id bigint NOT NULL REFERENCES units(id),
                owner_type text NOT NULL CHECK (owner_type IN ('person', 'kit', 'series', 'item', 'inventory_check', 'archive')),
                owner_id bigint NOT NULL CHECK (owner_id > 0),
                kind text NOT NULL CHECK (
                    (owner_type = 'person' AND kind IN ('person_card', 'loose_slip')) OR
                    (owner_type = 'kit' AND kind IN ('kit_card', 'kit_label', 'loose_slip')) OR
                    (owner_type = 'series' AND kind IN ('series_card', 'loose_slip')) OR
                    (owner_type = 'item' AND kind IN ('item_photo', 'loose_slip')) OR
                    (owner_type = 'inventory_check' AND kind = 'check_photo') OR
                    (owner_type = 'archive' AND kind IN ('loan_book', 'loose_slip'))),
                storage_key text NOT NULL UNIQUE CHECK (storage_key = uuid::text),
                mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'application/pdf')),
                size bigint NOT NULL CHECK (size > 0),
                sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
                thumbnail_mime text CHECK (thumbnail_mime = 'image/jpeg'),
                thumbnail_size bigint CHECK (thumbnail_size > 0),
                page integer NOT NULL DEFAULT 1 CHECK (page > 0),
                caption text CHECK (length(caption) <= 2000),
                original_date date,
                uploaded_by bigint NOT NULL REFERENCES user_accounts(id),
                uploaded_at timestamptz NOT NULL DEFAULT now(),
                archived_at timestamptz,
                purged_at timestamptz,
                version integer NOT NULL DEFAULT 1 CHECK (version > 0),
                CHECK ((thumbnail_mime IS NULL) = (thumbnail_size IS NULL)),
                CHECK (purged_at IS NULL OR archived_at IS NOT NULL)
            );
            CREATE INDEX attachments_owner_idx ON attachments (unit_id, owner_type, owner_id, page, uploaded_at);

            CREATE TABLE attachment_exports (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
                unit_id bigint NOT NULL REFERENCES units(id),
                created_by bigint NOT NULL REFERENCES user_accounts(id),
                created_at timestamptz NOT NULL DEFAULT now(),
                manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'array' AND jsonb_array_length(manifest) > 0)
            );

            CREATE FUNCTION check_attachment_owner() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE owner_table text; found_owner bigint;
            BEGIN
                owner_table := CASE NEW.owner_type
                    WHEN 'person' THEN 'persons' WHEN 'kit' THEN 'costume_kits'
                    WHEN 'series' THEN 'costume_series' WHEN 'item' THEN 'costume_items'
                    WHEN 'inventory_check' THEN 'inventory_checks' WHEN 'archive' THEN 'units' END;
                IF owner_table IS NULL THEN RAISE EXCEPTION 'Unknown attachment owner' USING ERRCODE = '23514'; END IF;
                IF NEW.owner_type = 'person' THEN
                    SELECT id INTO found_owner FROM persons WHERE id = NEW.owner_id FOR KEY SHARE;
                ELSIF NEW.owner_type = 'archive' THEN
                    SELECT id INTO found_owner FROM units WHERE id = NEW.owner_id AND id = NEW.unit_id FOR KEY SHARE;
                ELSE
                    EXECUTE format('SELECT id FROM %I WHERE id = $1 AND unit_id = $2 FOR KEY SHARE', owner_table)
                        INTO found_owner USING NEW.owner_id, NEW.unit_id;
                END IF;
                IF found_owner IS NULL THEN RAISE EXCEPTION 'Attachment owner is absent or belongs to another fund' USING ERRCODE = '23503'; END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER attachment_owner BEFORE INSERT OR UPDATE OF owner_type, owner_id, unit_id ON attachments
                FOR EACH ROW EXECUTE FUNCTION check_attachment_owner();

            CREATE FUNCTION protect_attachment_owner() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE owner_kind text;
            BEGIN
                owner_kind := CASE TG_TABLE_NAME
                    WHEN 'persons' THEN 'person' WHEN 'costume_kits' THEN 'kit'
                    WHEN 'costume_series' THEN 'series' WHEN 'costume_items' THEN 'item'
                    WHEN 'inventory_checks' THEN 'inventory_check' WHEN 'units' THEN 'archive' END;
                IF EXISTS (SELECT 1 FROM attachments WHERE owner_type = owner_kind AND owner_id = OLD.id) THEN
                    RAISE EXCEPTION 'Attachment metadata still references this owner' USING ERRCODE = '23503';
                END IF;
                IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
                RETURN OLD;
            END $$;
            SQL);
        foreach (['persons', 'costume_kits', 'costume_series', 'costume_items', 'inventory_checks', 'units'] as $table) {
            $columns = in_array($table, ['persons', 'units'], true) ? 'id' : 'id, unit_id';
            $this->execute("CREATE TRIGGER attachment_owner_delete BEFORE DELETE OR UPDATE OF $columns ON $table FOR EACH ROW EXECUTE FUNCTION protect_attachment_owner()");
        }
    }

    public function down(): void
    {
        foreach (['persons', 'costume_kits', 'costume_series', 'costume_items', 'inventory_checks', 'units'] as $table) {
            $this->execute("DROP TRIGGER attachment_owner_delete ON $table");
        }
        $this->execute('DROP FUNCTION protect_attachment_owner(); DROP TABLE attachment_exports; DROP TABLE attachments; DROP FUNCTION check_attachment_owner()');
    }
}
