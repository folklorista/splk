<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Frozen inventory scope; observations never manufacture handovers (docs/06 chap. 7). */
final class CreateCostumeInventories extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE inventories (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                name text NOT NULL CHECK (btrim(name) <> ''),
                scope jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(scope) = 'object'),
                status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
                started_at timestamptz NOT NULL DEFAULT now(),
                started_by bigint NOT NULL REFERENCES user_accounts (id),
                closed_at timestamptz,
                closed_by bigint REFERENCES user_accounts (id),
                closed_with_issues boolean NOT NULL DEFAULT false,
                close_reason text,
                result_snapshot jsonb,
                version integer NOT NULL DEFAULT 1 CHECK (version > 0),
                UNIQUE (unit_id, id),
                CHECK ((status = 'closed') = (closed_at IS NOT NULL) AND (closed_at IS NULL) = (closed_by IS NULL)),
                CHECK (NOT closed_with_issues OR (status = 'closed' AND nullif(btrim(close_reason), '') IS NOT NULL)),
                CHECK ((status = 'closed') = (result_snapshot IS NOT NULL))
            );
            CREATE INDEX inventories_fund_idx ON inventories (unit_id, started_at DESC);
            CREATE TABLE inventory_targets (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                inventory_id bigint NOT NULL,
                item_id bigint,
                kit_id bigint,
                bulk_stock_id bigint,
                holder_person_id bigint REFERENCES persons (id),
                holder_unit_id bigint REFERENCES units (id),
                context_kit_id bigint,
                loan_line_id bigint,
                expected_qty integer NOT NULL DEFAULT 1 CHECK (expected_qty >= 0),
                snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
                added_explicitly boolean NOT NULL DEFAULT false,
                note text,
                UNIQUE (unit_id, inventory_id, id),
                CHECK (num_nonnulls(item_id, kit_id, bulk_stock_id) = 1),
                CHECK (num_nonnulls(holder_person_id, holder_unit_id) <= 1),
                CHECK (bulk_stock_id IS NOT NULL OR expected_qty = 1),
                CHECK (NOT added_explicitly OR nullif(btrim(note), '') IS NOT NULL),
                FOREIGN KEY (unit_id, inventory_id) REFERENCES inventories (unit_id, id),
                FOREIGN KEY (unit_id, item_id) REFERENCES costume_items (unit_id, id),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits (unit_id, id),
                FOREIGN KEY (unit_id, bulk_stock_id) REFERENCES costume_bulk_stocks (unit_id, id),
                FOREIGN KEY (unit_id, context_kit_id) REFERENCES costume_kits (unit_id, id),
                FOREIGN KEY (unit_id, loan_line_id) REFERENCES costume_loan_lines (unit_id, id)
            );
            CREATE UNIQUE INDEX inventory_targets_item_uq ON inventory_targets (inventory_id, item_id) WHERE item_id IS NOT NULL;
            CREATE UNIQUE INDEX inventory_targets_kit_uq ON inventory_targets (inventory_id, kit_id) WHERE kit_id IS NOT NULL;
            CREATE UNIQUE INDEX inventory_targets_bulk_uq ON inventory_targets (inventory_id, bulk_stock_id, context_kit_id, loan_line_id) NULLS NOT DISTINCT WHERE bulk_stock_id IS NOT NULL;
            CREATE TABLE inventory_slots (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                inventory_id bigint NOT NULL,
                starts_at timestamptz NOT NULL,
                ends_at timestamptz NOT NULL,
                capacity integer NOT NULL CHECK (capacity > 0),
                CHECK (ends_at > starts_at),
                UNIQUE (unit_id, inventory_id, id),
                FOREIGN KEY (unit_id, inventory_id) REFERENCES inventories (unit_id, id)
            );
            CREATE TABLE inventory_visits (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                inventory_id bigint NOT NULL,
                person_id bigint NOT NULL REFERENCES persons (id),
                slot_id bigint,
                status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'in_progress', 'completed', 'cancelled')),
                completed_at timestamptz,
                CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
                FOREIGN KEY (unit_id, inventory_id) REFERENCES inventories (unit_id, id),
                FOREIGN KEY (unit_id, inventory_id, slot_id) REFERENCES inventory_slots (unit_id, inventory_id, id)
            );
            CREATE UNIQUE INDEX inventory_visits_active_person_uq ON inventory_visits (inventory_id, person_id) WHERE status IN ('booked', 'in_progress');
            CREATE TABLE inventory_checks (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                inventory_id bigint NOT NULL,
                target_id bigint NOT NULL,
                mode text NOT NULL CHECK (mode IN ('people', 'store', 'kit')),
                result text NOT NULL CHECK (result IN ('presented', 'not_presented', 'found', 'not_found')),
                condition text CHECK (condition IN ('ok', 'needs_adjustment', 'damaged')),
                checked_qty integer CHECK (checked_qty >= 0),
                note text,
                by bigint NOT NULL REFERENCES user_accounts (id),
                at timestamptz NOT NULL DEFAULT now(),
                cancelled_at timestamptz,
                cancelled_by bigint REFERENCES user_accounts (id),
                CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL)),
                FOREIGN KEY (unit_id, inventory_id, target_id) REFERENCES inventory_targets (unit_id, inventory_id, id)
            );
            CREATE INDEX inventory_checks_target_idx ON inventory_checks (target_id, at DESC, id DESC) WHERE cancelled_at IS NULL;
            ALTER TABLE costume_loan_lines ADD COLUMN inventory_id bigint;
            ALTER TABLE costume_loan_lines ADD FOREIGN KEY (unit_id, inventory_id) REFERENCES inventories (unit_id, id);
            ALTER TABLE costume_loan_returns ADD COLUMN inventory_id bigint;
            ALTER TABLE costume_loan_returns ADD FOREIGN KEY (unit_id, inventory_id) REFERENCES inventories (unit_id, id);
            ALTER TABLE costume_work_orders ADD COLUMN inventory_id bigint REFERENCES inventories (id);

            CREATE FUNCTION check_costume_work_inventory_fund() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.inventory_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM inventories v JOIN costume_items i ON i.unit_id = v.unit_id
                    WHERE v.id = NEW.inventory_id AND i.id = NEW.item_id
                ) THEN
                    RAISE EXCEPTION 'Work order inventory belongs to another fund' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END;
            $$;
            CREATE TRIGGER costume_work_inventory_fund BEFORE INSERT OR UPDATE OF item_id, inventory_id ON costume_work_orders
                FOR EACH ROW EXECUTE FUNCTION check_costume_work_inventory_fund();
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            DROP TRIGGER costume_work_inventory_fund ON costume_work_orders;
            DROP FUNCTION check_costume_work_inventory_fund();
            ALTER TABLE costume_work_orders DROP COLUMN inventory_id;
            ALTER TABLE costume_loan_returns DROP COLUMN inventory_id;
            ALTER TABLE costume_loan_lines DROP COLUMN inventory_id;
            DROP TABLE inventory_checks, inventory_visits, inventory_slots, inventory_targets, inventories;
            SQL);
    }
}
