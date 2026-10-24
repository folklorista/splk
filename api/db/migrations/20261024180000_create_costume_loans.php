<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Actual handovers only; kit allocations survive issue and return (D-61). */
final class CreateCostumeLoans extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE costume_loans (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                holder_person_id bigint REFERENCES persons (id),
                holder_unit_id bigint REFERENCES units (id),
                kit_id bigint,
                issued_at timestamptz NOT NULL DEFAULT now(),
                issued_by bigint NOT NULL REFERENCES user_accounts (id),
                due_at timestamptz,
                note text,
                replaces_loan_id bigint,
                UNIQUE (unit_id, id),
                CHECK (num_nonnulls(holder_person_id, holder_unit_id) = 1),
                CHECK (holder_unit_id IS DISTINCT FROM unit_id),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits (unit_id, id),
                FOREIGN KEY (unit_id, replaces_loan_id) REFERENCES costume_loans (unit_id, id)
            );
            CREATE TABLE costume_loan_lines (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                loan_id bigint NOT NULL,
                item_id bigint,
                bulk_stock_id bigint,
                qty integer NOT NULL CHECK (qty > 0),
                returned_qty integer NOT NULL DEFAULT 0 CHECK (returned_qty >= 0 AND returned_qty <= qty),
                closed_at timestamptz,
                closed_by bigint REFERENCES user_accounts (id),
                close_type text CHECK (close_type IN ('returned', 'exchanged', 'settled')),
                close_note text,
                UNIQUE (unit_id, id),
                CHECK (num_nonnulls(item_id, bulk_stock_id) = 1),
                CHECK (item_id IS NULL OR qty = 1),
                CHECK ((closed_at IS NULL) = (closed_by IS NULL) AND (closed_at IS NULL) = (close_type IS NULL)),
                CHECK (closed_at IS NOT NULL OR returned_qty < qty),
                CHECK (close_type IS DISTINCT FROM 'returned' OR returned_qty = qty),
                FOREIGN KEY (unit_id, loan_id) REFERENCES costume_loans (unit_id, id),
                FOREIGN KEY (unit_id, item_id) REFERENCES costume_items (unit_id, id),
                FOREIGN KEY (unit_id, bulk_stock_id) REFERENCES costume_bulk_stocks (unit_id, id),
                UNIQUE (loan_id, item_id),
                UNIQUE (loan_id, bulk_stock_id)
            );
            CREATE UNIQUE INDEX costume_loan_lines_open_item_uq ON costume_loan_lines (item_id) WHERE closed_at IS NULL;
            CREATE INDEX costume_loans_fund_idx ON costume_loans (unit_id, issued_at DESC);
            CREATE INDEX costume_loan_lines_loan_idx ON costume_loan_lines (loan_id);
            CREATE INDEX costume_loan_lines_stock_idx ON costume_loan_lines (bulk_stock_id) WHERE closed_at IS NULL;

            -- Each partial return has its own immutable timestamp and note (docs/06 chap. 5.2).
            CREATE TABLE costume_loan_returns (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                line_id bigint NOT NULL,
                qty integer NOT NULL CHECK (qty >= 0),
                close_type text NOT NULL CHECK (close_type IN ('returned', 'exchanged', 'settled')),
                note text,
                at timestamptz NOT NULL DEFAULT now(),
                by bigint NOT NULL REFERENCES user_accounts (id),
                CHECK (close_type <> 'returned' OR qty > 0),
                FOREIGN KEY (unit_id, line_id) REFERENCES costume_loan_lines (unit_id, id)
            );
            CREATE INDEX costume_loan_returns_line_idx ON costume_loan_returns (line_id, at);

            -- Union of kit allocation and outstanding kit handover, never their sum (D-61).
            -- Greatest also protects an outstanding snapshot after a subsequent composition change.
            CREATE FUNCTION costume_bulk_reserved(stock bigint) RETURNS bigint LANGUAGE sql STABLE AS $$
                WITH handed AS (
                    SELECT l.kit_id, sum(ll.qty::bigint - ll.returned_qty) AS qty
                    FROM costume_loan_lines ll JOIN costume_loans l ON l.id = ll.loan_id
                    WHERE ll.bulk_stock_id = stock AND ll.closed_at IS NULL GROUP BY l.kit_id
                ), kits AS (
                    SELECT coalesce(k.kit_id, h.kit_id) AS kit_id,
                        greatest(coalesce(k.present_qty, 0), coalesce(h.qty, 0)) AS qty
                    FROM (SELECT kit_id, present_qty FROM costume_kit_bulk_lines WHERE bulk_stock_id = stock) k
                    FULL JOIN (SELECT * FROM handed WHERE kit_id IS NOT NULL) h USING (kit_id)
                )
                SELECT coalesce((SELECT sum(qty) FROM kits), 0)::bigint
                    + coalesce((SELECT sum(qty) FROM handed WHERE kit_id IS NULL), 0)::bigint;
            $$;
            CREATE OR REPLACE FUNCTION check_costume_bulk_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE stock_id bigint; total integer;
            BEGIN
                IF TG_TABLE_NAME = 'costume_bulk_stocks' THEN
                    stock_id := NEW.id;
                ELSE
                    stock_id := NEW.bulk_stock_id;
                END IF;
                IF stock_id IS NULL THEN RETURN NEW; END IF;
                SELECT quantity_total INTO total FROM costume_bulk_stocks WHERE id = stock_id FOR UPDATE;
                IF costume_bulk_reserved(stock_id) > total THEN
                    RAISE EXCEPTION 'Allocations and outstanding handovers exceed total stock' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END;
            $$;
            CREATE TRIGGER costume_loan_bulk_capacity AFTER INSERT OR UPDATE ON costume_loan_lines
                FOR EACH ROW EXECUTE FUNCTION check_costume_bulk_capacity();
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            DROP TABLE costume_loan_returns, costume_loan_lines, costume_loans;
            DROP FUNCTION costume_bulk_reserved(bigint);
            CREATE OR REPLACE FUNCTION check_costume_bulk_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE stock_id bigint; total integer; allocated bigint;
            BEGIN
                IF TG_TABLE_NAME = 'costume_bulk_stocks' THEN
                    stock_id := NEW.id;
                    total := NEW.quantity_total;
                ELSE
                    stock_id := NEW.bulk_stock_id;
                    SELECT quantity_total INTO total FROM costume_bulk_stocks WHERE id = stock_id FOR UPDATE;
                END IF;
                SELECT coalesce(sum(present_qty), 0) INTO allocated FROM costume_kit_bulk_lines WHERE bulk_stock_id = stock_id;
                IF allocated > total THEN
                    RAISE EXCEPTION 'Recorded kit quantities exceed the total stock' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END;
            $$;
            SQL);
    }
}
