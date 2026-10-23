<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Physical inventory only (docs/06 chap. 3–4); loans and physical checks arrive in later steps. */
final class CreateCostumeInventory extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            ALTER TABLE costume_series ADD CONSTRAINT costume_series_unit_id_uq UNIQUE (unit_id, id);
            ALTER TABLE costume_part_types ADD CONSTRAINT costume_part_types_unit_id_uq UNIQUE (unit_id, id);

            CREATE TABLE costume_kits (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                series_id bigint NOT NULL,
                number text CHECK (number IS NULL OR btrim(number) <> ''),
                description text,
                composition_state text NOT NULL DEFAULT 'unverified'
                    CHECK (composition_state IN ('unverified', 'complete', 'incomplete', 'pending_check')),
                note text,
                retired_at timestamptz,
                version integer NOT NULL DEFAULT 1 CHECK (version > 0),
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                UNIQUE (unit_id, id),
                FOREIGN KEY (unit_id, series_id) REFERENCES costume_series (unit_id, id)
            );
            CREATE UNIQUE INDEX costume_kits_number_uq ON costume_kits (series_id, number)
                WHERE retired_at IS NULL AND number IS NOT NULL;

            CREATE TABLE costume_items (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                series_id bigint NOT NULL,
                number text CHECK (number IS NULL OR btrim(number) <> ''),
                variant text,
                size text,
                description text,
                note text,
                condition text NOT NULL DEFAULT 'ok' CHECK (condition IN ('ok', 'needs_adjustment', 'damaged')),
                issuable boolean NOT NULL DEFAULT true,
                location text NOT NULL DEFAULT 'unknown' CHECK (location IN ('store', 'holder', 'seamstress', 'repair', 'unknown')),
                location_note text,
                acquired_on date,
                kit_id bigint,
                retired_at timestamptz,
                retired_by bigint REFERENCES user_accounts (id),
                retire_reason text,
                version integer NOT NULL DEFAULT 1 CHECK (version > 0),
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                UNIQUE (unit_id, id),
                FOREIGN KEY (unit_id, series_id) REFERENCES costume_series (unit_id, id),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits (unit_id, id),
                CHECK ((retired_at IS NULL AND retired_by IS NULL AND retire_reason IS NULL)
                    OR (retired_at IS NOT NULL AND retired_by IS NOT NULL AND retire_reason IS NOT NULL AND btrim(retire_reason) <> ''))
            );
            CREATE UNIQUE INDEX costume_items_number_uq ON costume_items (series_id, number)
                WHERE retired_at IS NULL AND number IS NOT NULL;
            CREATE INDEX costume_items_kit_idx ON costume_items (kit_id);
            CREATE INDEX costume_items_fund_idx ON costume_items (unit_id, series_id);

            CREATE TABLE costume_bulk_stocks (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                part_type_id bigint NOT NULL,
                variant text,
                quantity_total integer NOT NULL DEFAULT 0 CHECK (quantity_total >= 0),
                note text,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                UNIQUE (unit_id, id),
                FOREIGN KEY (unit_id, part_type_id) REFERENCES costume_part_types (unit_id, id)
            );
            CREATE UNIQUE INDEX costume_bulk_stocks_type_variant_uq
                ON costume_bulk_stocks (unit_id, part_type_id, lower(variant)) NULLS NOT DISTINCT;

            CREATE TABLE costume_kit_bulk_lines (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                kit_id bigint NOT NULL,
                bulk_stock_id bigint NOT NULL,
                required_qty integer NOT NULL CHECK (required_qty > 0),
                present_qty integer NOT NULL DEFAULT 0 CHECK (present_qty >= 0 AND present_qty <= required_qty),
                UNIQUE (kit_id, bulk_stock_id),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits (unit_id, id),
                FOREIGN KEY (unit_id, bulk_stock_id) REFERENCES costume_bulk_stocks (unit_id, id)
            );
            COMMENT ON COLUMN costume_items.kit_id IS 'Intended composition, not proof of physical presence or a loan.';
            COMMENT ON COLUMN costume_kit_bulk_lines.present_qty IS 'Recorded quantity allocated to the kit; not a physical inventory check.';
            COMMENT ON COLUMN costume_kits.composition_state IS 'Explicit composition state; copied labels start unverified, never inferred from row counts.';

            CREATE TABLE costume_kit_changes (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                kit_id bigint NOT NULL,
                item_id bigint,
                bulk_stock_id bigint,
                change text NOT NULL CHECK (change IN ('added', 'removed', 'moved')),
                qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
                at timestamptz NOT NULL DEFAULT now(),
                by bigint NOT NULL REFERENCES user_accounts (id),
                note text,
                CHECK (num_nonnulls(item_id, bulk_stock_id) = 1),
                CHECK (item_id IS NULL OR qty = 1),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits (unit_id, id),
                FOREIGN KEY (unit_id, item_id) REFERENCES costume_items (unit_id, id),
                FOREIGN KEY (unit_id, bulk_stock_id) REFERENCES costume_bulk_stocks (unit_id, id)
            );
            CREATE INDEX costume_kit_changes_kit_idx ON costume_kit_changes (kit_id, at, id);

            CREATE TABLE costume_item_events (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                item_id bigint NOT NULL REFERENCES costume_items (id),
                at timestamptz NOT NULL DEFAULT now(),
                by bigint NOT NULL REFERENCES user_accounts (id),
                event text NOT NULL CHECK (btrim(event) <> ''),
                data jsonb NOT NULL DEFAULT '{}'
            );
            CREATE INDEX costume_item_events_item_idx ON costume_item_events (item_id, at, id);

            CREATE TABLE costume_work_orders (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                item_id bigint NOT NULL REFERENCES costume_items (id),
                type text NOT NULL CHECK (type IN ('adjustment', 'repair', 'resewing')),
                description text NOT NULL CHECK (btrim(description) <> ''),
                assignee text,
                due_on date,
                status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id)
            );
            CREATE INDEX costume_work_orders_item_idx ON costume_work_orders (item_id, status);

            -- Lock the stock before counting allocations, including concurrent changes in other kits.
            CREATE FUNCTION check_costume_bulk_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE stock_id bigint; total integer; allocated bigint;
            BEGIN
                IF TG_TABLE_NAME = 'costume_bulk_stocks' THEN
                    stock_id := NEW.id;
                    total := NEW.quantity_total;
                ELSE
                    stock_id := NEW.bulk_stock_id;
                    SELECT quantity_total INTO total FROM costume_bulk_stocks WHERE id = stock_id FOR UPDATE;
                END IF;
                SELECT coalesce(sum(present_qty), 0) INTO allocated
                    FROM costume_kit_bulk_lines WHERE bulk_stock_id = stock_id;
                IF allocated > total THEN
                    RAISE EXCEPTION 'Recorded kit quantities exceed the total stock' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END;
            $$;
            CREATE TRIGGER costume_bulk_capacity AFTER INSERT OR UPDATE ON costume_kit_bulk_lines
                FOR EACH ROW EXECUTE FUNCTION check_costume_bulk_capacity();
            CREATE TRIGGER costume_bulk_total_capacity AFTER UPDATE OF quantity_total ON costume_bulk_stocks
                FOR EACH ROW EXECUTE FUNCTION check_costume_bulk_capacity();
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            DROP TABLE costume_work_orders, costume_item_events, costume_kit_changes, costume_kit_bulk_lines;
            DROP TABLE costume_bulk_stocks, costume_items, costume_kits;
            DROP FUNCTION check_costume_bulk_capacity();
            ALTER TABLE costume_part_types DROP CONSTRAINT costume_part_types_unit_id_uq;
            ALTER TABLE costume_series DROP CONSTRAINT costume_series_unit_id_uq;
            SQL);
    }
}
