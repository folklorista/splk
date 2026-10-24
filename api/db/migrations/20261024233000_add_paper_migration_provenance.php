<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** D-67: digitalization dates never stand in for an unknown physical handover. */
final class AddPaperMigrationProvenance extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            ALTER TABLE costume_loans
                ALTER COLUMN issued_at DROP NOT NULL, ALTER COLUMN issued_by DROP NOT NULL,
                ADD COLUMN origin text NOT NULL DEFAULT 'handover',
                ADD COLUMN migrated_at timestamptz,
                ADD COLUMN migrated_by bigint REFERENCES user_accounts(id),
                ADD COLUMN original_issued_on date,
                ADD CONSTRAINT costume_loans_provenance CHECK (
                    (origin = 'handover' AND issued_at IS NOT NULL AND issued_by IS NOT NULL AND migrated_at IS NULL AND migrated_by IS NULL AND original_issued_on IS NULL) OR
                    (origin = 'paper_migration' AND issued_at IS NULL AND issued_by IS NULL AND migrated_at IS NOT NULL AND migrated_by IS NOT NULL));
            ALTER TABLE attachments ADD CONSTRAINT attachments_unit_uuid_uq UNIQUE (unit_id, uuid);
            CREATE TABLE costume_paper_migration_findings (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units(id),
                person_id bigint NOT NULL REFERENCES persons(id),
                source_attachment_uuid uuid,
                item_id bigint,
                series_id bigint,
                number text,
                label text NOT NULL,
                input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object'),
                code text NOT NULL CHECK (code IN ('not_found', 'ambiguous', 'conflict', 'item_retired')),
                conflicting_loan_id bigint,
                note text CHECK (length(note) <= 2000),
                at timestamptz NOT NULL DEFAULT now(),
                by bigint NOT NULL REFERENCES user_accounts(id),
                FOREIGN KEY (unit_id, item_id) REFERENCES costume_items(unit_id, id),
                FOREIGN KEY (unit_id, series_id) REFERENCES costume_series(unit_id, id),
                FOREIGN KEY (unit_id, conflicting_loan_id) REFERENCES costume_loans(unit_id, id),
                FOREIGN KEY (unit_id, source_attachment_uuid) REFERENCES attachments(unit_id, uuid)
            );
            CREATE INDEX costume_paper_migration_person_idx ON costume_paper_migration_findings (unit_id, person_id, at, id);
            SQL);
    }

    public function down(): void
    {
        $this->execute(<<<'SQL'
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM costume_loans WHERE origin = 'paper_migration') OR EXISTS (SELECT 1 FROM costume_paper_migration_findings) THEN
                    RAISE EXCEPTION 'Paper migration evidence must be preserved; rollback refused' USING ERRCODE = '55000';
                END IF;
            END $$;
            DROP TABLE costume_paper_migration_findings;
            ALTER TABLE attachments DROP CONSTRAINT attachments_unit_uuid_uq;
            ALTER TABLE costume_loans DROP CONSTRAINT costume_loans_provenance,
                DROP COLUMN original_issued_on, DROP COLUMN migrated_by, DROP COLUMN migrated_at, DROP COLUMN origin,
                ALTER COLUMN issued_at SET NOT NULL, ALTER COLUMN issued_by SET NOT NULL;
            SQL);
    }
}
