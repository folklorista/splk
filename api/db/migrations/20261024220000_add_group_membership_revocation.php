<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** Removing today's membership must preserve its history without inventing an earlier end date. */
final class AddGroupMembershipRevocation extends AbstractMigration
{
    public function up(): void
    {
        $this->execute('ALTER TABLE group_memberships ADD COLUMN revoked_at timestamptz, ADD COLUMN revoked_by bigint REFERENCES user_accounts (id), ADD CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))');
    }

    public function down(): void
    {
        $this->execute('ALTER TABLE group_memberships DROP COLUMN revoked_at, DROP COLUMN revoked_by');
    }
}
