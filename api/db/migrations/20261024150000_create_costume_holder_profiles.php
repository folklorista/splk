<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Fund-local paper-card state and notes; shared contact stays on persons (D-60). */
final class CreateCostumeHolderProfiles extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE costume_holder_profiles (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                unit_id bigint NOT NULL REFERENCES units (id),
                person_id bigint NOT NULL REFERENCES persons (id),
                paper_state text NOT NULL DEFAULT 'paper' CHECK (paper_state IN ('paper', 'migrating', 'digital')),
                paper_checked_at timestamptz,
                migrated_at timestamptz,
                migrated_by bigint REFERENCES user_accounts (id),
                note text,
                created_at timestamptz NOT NULL DEFAULT now(),
                created_by bigint REFERENCES user_accounts (id),
                UNIQUE (unit_id, person_id),
                CHECK ((migrated_at IS NULL) = (migrated_by IS NULL))
            );
            CREATE INDEX costume_holder_profiles_person_idx ON costume_holder_profiles (person_id);
            SQL);
    }

    public function down(): void
    {
        $this->execute('DROP TABLE costume_holder_profiles');
    }
}
