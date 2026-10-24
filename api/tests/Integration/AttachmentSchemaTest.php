<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDOException;
use Splk\Api\Infrastructure\Db\Transaction;

final class AttachmentSchemaTest extends DatabaseTestCase
{
    private int $fund;
    private int $actor;
    private int $person;
    private int $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, name, kind, part_type_id) VALUES ({$this->fund}, 'Shirts', 'part', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series)");
    }

    public function testOwnersMustExistAndPhysicalOwnersCannotCrossFunds(): void
    {
        $this->attachment();
        $other = $this->createUnit('Other');
        $this->reject(fn () => $this->attachment($other), '23503');
        $this->reject(fn () => $this->attachment(owner: $this->item + 1000000), '23503');
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachments')->fetchColumn());
    }

    public function testPersonCardsAreScopedToAFundWithoutInventingProfilesOrMemberships(): void
    {
        $this->attachment(type: 'person', owner: $this->person, kind: 'person_card');
        $this->attachment($this->createUnit('Other'), 'person', $this->person, 'person_card');
        self::assertSame(2, $this->db->query('SELECT count(DISTINCT unit_id) FROM attachments')->fetchColumn());
        foreach (['costume_holder_profiles', 'unit_affiliations', 'costume_loans', 'inventory_checks'] as $table) {
            self::assertSame(0, $this->db->query("SELECT count(*) FROM $table")->fetchColumn());
        }
    }

    public function testArchiveUsesItsFundAsOwnerAndKindsMatchOwners(): void
    {
        $this->attachment(type: 'archive', owner: $this->fund, kind: 'loan_book');
        $this->reject(fn () => $this->attachment(type: 'archive', owner: $this->createUnit('Other'), kind: 'loan_book'), '23503');
        $this->reject(fn () => $this->attachment(kind: 'person_card'), '23514');
        $this->reject(fn () => $this->attachment(type: 'unknown'), '23514');
    }

    public function testPrivateKeysDigestAndRetentionAreConstrained(): void
    {
        $id = $this->attachment();
        foreach (["storage_key = '../public/scan.jpg'", "sha256 = 'invalid'", 'size = 0', 'page = 0', 'purged_at = now()', "mime = 'image/svg+xml'", "thumbnail_mime = 'image/jpeg'"] as $assignment) {
            $this->reject(fn () => $this->db->exec("UPDATE attachments SET $assignment WHERE id = $id"), '23514');
        }
        $this->db->exec("UPDATE attachments SET archived_at = now(), purged_at = now() WHERE id = $id");
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachments WHERE purged_at IS NOT NULL')->fetchColumn());
        self::assertSame($this->item, $this->db->query("SELECT owner_id FROM attachments WHERE id = $id")->fetchColumn());
    }

    public function testOwnerDeletionCannotOrphanRetainedAttachmentMetadata(): void
    {
        $this->attachment();
        $this->reject(fn () => $this->db->exec("DELETE FROM costume_items WHERE id = {$this->item}"), '23503');
        $other = $this->createUnit('Other');
        $this->reject(fn () => $this->db->exec("UPDATE costume_items SET unit_id = $other WHERE id = {$this->item}"), '23503');
        $this->attachment(type: 'person', owner: $this->person, kind: 'person_card');
        // A separate person avoids relying on account foreign keys to reject deletion.
        $person = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('External', 'Holder')");
        $this->attachment(type: 'person', owner: $person, kind: 'person_card');
        $this->reject(fn () => $this->db->exec("DELETE FROM persons WHERE id = $person"), '23503');
    }

    public function testMigrationDownAndUpPreservesExistingPropertyAndPeople(): void
    {
        require_once dirname(__DIR__, 2) . '/db/migrations/20261024230000_create_attachments.php';
        $migration = new \CreateAttachments('testing', 20261024230000);
        $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->db]));
        $this->attachment(); $migration->down();
        self::assertSame($this->item, $this->db->query("SELECT id FROM costume_items WHERE id = {$this->item}")->fetchColumn());
        self::assertSame($this->person, $this->db->query("SELECT id FROM persons WHERE id = {$this->person}")->fetchColumn());
        $migration->up(); $this->attachment();
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachments')->fetchColumn());
        $this->reject(fn () => $this->db->exec("DELETE FROM costume_items WHERE id = {$this->item}"), '23503');
    }

    private function attachment(?int $fund = null, string $type = 'item', ?int $owner = null, string $kind = 'item_photo'): int
    {
        $statement = $this->db->prepare("INSERT INTO attachments (uuid, unit_id, owner_type, owner_id, kind, storage_key, mime, size, sha256, uploaded_by)
            SELECT uuid, :fund, :type, :owner, :kind, uuid::text, 'image/jpeg', 123, repeat('a', 64), :actor FROM (SELECT gen_random_uuid() AS uuid) AS identity RETURNING id");
        $statement->execute(['fund' => $fund ?? $this->fund, 'type' => $type, 'owner' => $owner ?? $this->item, 'kind' => $kind, 'actor' => $this->actor]);
        return (int) $statement->fetchColumn();
    }

    private function reject(callable $operation, string $state): void
    {
        try { Transaction::run($this->db, $operation); self::fail('Invalid attachment data accepted'); }
        catch (PDOException $error) { self::assertSame($state, $error->getCode()); }
    }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
