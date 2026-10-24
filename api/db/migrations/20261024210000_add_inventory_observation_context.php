<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Preserve who/where and the recorded count at observation time without rewriting frozen targets. */
final class AddInventoryObservationContext extends AbstractMigration
{
    public function up(): void
    {
        $this->execute("ALTER TABLE inventory_checks ADD COLUMN context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(context) = 'object')");
    }

    public function down(): void
    {
        $this->execute('ALTER TABLE inventory_checks DROP COLUMN context');
    }
}
