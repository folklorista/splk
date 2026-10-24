<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Cost evidence, never accounting entries or physical inventory movements (D-23/D-68). */
final class CreateCostumeCosts extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE costume_costs (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units(id),
                spent_on date NOT NULL,
                amount numeric(18,4) NOT NULL CHECK (amount <> 'NaN'::numeric AND amount <> 'Infinity'::numeric AND amount <> '-Infinity'::numeric),
                currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
                supplier text CHECK (length(supplier) <= 500),
                document_ref text CHECK (length(document_ref) <= 500),
                description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
                purpose text CHECK (length(purpose) <= 1000),
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint NOT NULL REFERENCES user_accounts(id),
                updated_at timestamptz NOT NULL DEFAULT now(),
                updated_by bigint NOT NULL REFERENCES user_accounts(id),
                version integer NOT NULL DEFAULT 1 CHECK (version > 0),
                UNIQUE (unit_id, id)
            );
            CREATE INDEX costume_costs_fund_date_idx ON costume_costs (unit_id, spent_on DESC, id DESC);
            CREATE TABLE costume_cost_links (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL,
                cost_id bigint NOT NULL,
                item_id bigint,
                bulk_stock_id bigint,
                kit_id bigint,
                qty integer NOT NULL CHECK (qty > 0),
                CHECK (num_nonnulls(item_id, bulk_stock_id, kit_id) = 1),
                CHECK (item_id IS NULL OR qty = 1),
                CHECK (kit_id IS NULL OR qty = 1),
                FOREIGN KEY (unit_id, cost_id) REFERENCES costume_costs(unit_id, id),
                FOREIGN KEY (unit_id, item_id) REFERENCES costume_items(unit_id, id),
                FOREIGN KEY (unit_id, bulk_stock_id) REFERENCES costume_bulk_stocks(unit_id, id),
                FOREIGN KEY (unit_id, kit_id) REFERENCES costume_kits(unit_id, id)
            );
            CREATE UNIQUE INDEX costume_cost_item_uq ON costume_cost_links (cost_id, item_id) WHERE item_id IS NOT NULL;
            CREATE UNIQUE INDEX costume_cost_stock_uq ON costume_cost_links (cost_id, bulk_stock_id) WHERE bulk_stock_id IS NOT NULL;
            CREATE UNIQUE INDEX costume_cost_kit_uq ON costume_cost_links (cost_id, kit_id) WHERE kit_id IS NOT NULL;
            SQL);
    }
    public function down(): void
    {
        $this->execute(<<<'SQL'
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM costume_costs) THEN
                    RAISE EXCEPTION 'Cost evidence must be preserved; rollback refused' USING ERRCODE = '55000';
                END IF;
            END $$;
            DROP TABLE costume_cost_links;
            DROP TABLE costume_costs;
            SQL);
    }
}
