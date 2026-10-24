<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Response;
use Splk\Api\Http\UploadedFile;
use Splk\Api\Infrastructure\Db\Connection;

final class AttachmentExportsTest extends ApiTestCase
{
    private string $root;
    private int $fund;
    private int $actor;
    private int $person;

    protected function setUp(): void
    {
        parent::setUp();
        $this->root = sys_get_temp_dir() . '/splk-export-' . bin2hex(random_bytes(8)); mkdir($this->root, 0700); $this->configure();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        if (isset($this->root) && is_dir($this->root)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($iterator as $path) $path->isDir() ? rmdir($path->getPathname()) : unlink($path->getPathname());
            rmdir($this->root);
        }
    }

    public function testZipContainsExactStoredFilesAndReadableManifestWithoutPrivatePaths(): void
    {
        $first = $this->attachment('First'); $second = $this->attachment('Second');
        $response = $this->export([$first, $second]); self::assertStatus(200, $response);
        self::assertSame('application/zip', $response->header('Content-Type'));
        self::assertMatchesRegularExpression('/^[a-f0-9-]{36}$/D', $response->header('X-Attachment-Export-Id'));
        self::assertStringContainsString('X-Attachment-Export-Id', $response->header('Access-Control-Expose-Headers'));
        $temporary = $this->root . '/inspection.zip'; file_put_contents($temporary, $response->body);
        $zip = new \ZipArchive(); self::assertTrue($zip->open($temporary)); self::assertSame(3, $zip->numFiles);
        foreach ([$first, $second] as $row) self::assertSame($row['sha256'], hash('sha256', $zip->getFromName($row['id'] . '.pdf')));
        $manifest = json_decode($zip->getFromName('manifest.json'), true, 64, JSON_THROW_ON_ERROR);
        $captions = array_column($manifest, 'caption'); sort($captions);
        self::assertSame(['First', 'Second'], $captions);
        self::assertStringNotContainsString($this->root, $zip->getFromName('manifest.json')); $zip->close();
        self::assertSame(1, $this->auditCount('attachment.export')); self::assertSame(1, $this->db->query('SELECT count(*) FROM attachment_exports')->fetchColumn());
        $audit = json_decode($this->db->query("SELECT data FROM audit_log WHERE action = 'attachment.export'")->fetchColumn(), true);
        self::assertArrayNotHasKey('bytes', $audit); self::assertCount(2, $audit['attachments']);
        self::assertSame([], glob($this->root . '/.export-*'));
    }

    public function testPurgeRequiresExternalArchiveConfirmationAndRemovesContentButKeepsMetadata(): void
    {
        $row = $this->attachment();
        self::assertError(422, 'attachment_export_required', $this->post($this->base() . '/purge', ['attachments' => $this->versions([$row]), 'confirmArchived' => true]));
        $export = $this->export([$row]); self::assertStatus(200, $export); $receipt = $export->header('X-Attachment-Export-Id');
        foreach ([false, 'true', null] as $confirmation) self::assertError(422, 'attachment_export_required', $this->purge([$row], $receipt, $confirmation));
        self::assertFileExists($this->file($row));
        $purged = $this->purge([$row], $receipt); self::assertStatus(200, $purged);
        $metadata = $purged->decodedBody()['items'][0]; self::assertNotNull($metadata['purgedAt']); self::assertNotNull($metadata['archivedAt']);
        self::assertSame(2, $metadata['version']); self::assertFalse($metadata['hasThumbnail']); self::assertFileDoesNotExist($this->file($row));
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachments')->fetchColumn());
        self::assertSame($this->person, $this->db->query("SELECT id FROM persons WHERE id = {$this->person}")->fetchColumn());
        self::assertStatus(200, $this->get('/v1/attachments/' . $row['id']));
        self::assertError(410, 'attachment_purged', $this->get('/v1/attachments/' . $row['id'] . '/content'));
        self::assertStatus(200, $this->purge([$row], $receipt)); self::assertSame(1, $this->auditCount('attachment.purge'));
    }

    public function testBatchCannotPurgeAnUnexportedAttachmentAndRollsBackAllChanges(): void
    {
        $rows = [$this->attachment(), $this->attachment('Unexported')];
        usort($rows, static fn (array $a, array $b): int => strcmp($a['id'], $b['id']));
        [$first, $second] = $rows; $export = $this->export([$first]);
        self::assertError(422, 'attachment_export_required', $this->purge([$first, $second], $export->header('X-Attachment-Export-Id')));
        foreach ([$first, $second] as $row) { self::assertFileExists($this->file($row)); self::assertNull($this->get('/v1/attachments/' . $row['id'])->decodedBody()['purgedAt']); }
        self::assertSame(0, $this->auditCount('attachment.purge'));
    }

    public function testMetadataChangesInvalidateTheOldExportReceipt(): void
    {
        $row = $this->attachment(); $export = $this->export([$row]);
        $updated = $this->patch('/v1/attachments/' . $row['id'], ['version' => 1, 'caption' => 'New interpretation']); self::assertStatus(200, $updated);
        self::assertError(409, 'version_conflict', $this->purge([$row], $export->header('X-Attachment-Export-Id')));
        self::assertError(422, 'attachment_export_required', $this->purge([$updated->decodedBody()], $export->header('X-Attachment-Export-Id')));
        self::assertFileExists($this->file($row));
        $fresh = $this->export([$updated->decodedBody()]); self::assertStatus(200, $fresh);
        self::assertStatus(200, $this->purge([$updated->decodedBody()], $fresh->header('X-Attachment-Export-Id')));
    }

    public function testPurgeAuditFailureNeverDeletesAnyFiles(): void
    {
        $row = $this->attachment(); $export = $this->export([$row]);
        $this->db->exec("CREATE UNIQUE INDEX test_attachment_purge_audit ON audit_log (entity_id) WHERE action IN ('attachment.upload', 'attachment.purge')");
        self::assertError(500, 'internal_error', $this->purge([$row], $export->header('X-Attachment-Export-Id')));
        self::assertFileExists($this->file($row)); self::assertNull($this->get('/v1/attachments/' . $row['id'])->decodedBody()['purgedAt']);
        self::assertSame(0, $this->auditCount('attachment.purge'));
    }

    public function testExportAuditFailureDoesNotLeaveAReceiptOrTemporaryZip(): void
    {
        $row = $this->attachment(); self::assertStatus(200, $this->export([$row]));
        $this->db->exec("CREATE UNIQUE INDEX test_attachment_export_audit ON audit_log (unit_id) WHERE action = 'attachment.export'");
        self::assertError(422, 'duplicate_name', $this->export([$row]));
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachment_exports')->fetchColumn());
        self::assertSame(1, $this->auditCount('attachment.export')); self::assertSame([], glob($this->root . '/.export-*')); self::assertFileExists($this->file($row));
    }

    public function testCorruptedContentCannotBeExportedAsAValidArchive(): void
    {
        $row = $this->attachment(); file_put_contents($this->file($row), 'Corrupted');
        self::assertError(500, 'internal_error', $this->export([$row]));
        self::assertSame(0, $this->db->query('SELECT count(*) FROM attachment_exports')->fetchColumn()); self::assertSame([], glob($this->root . '/.export-*'));
        self::assertFileExists($this->file($row));
    }

    public function testOversizedExportIsRejectedWithoutCreatingAReceipt(): void
    {
        $row = $this->attachment(); $this->configure(['maxExportBytes' => 1]);
        self::assertError(413, 'file_too_large', $this->export([$row]));
        self::assertSame(0, $this->auditCount('attachment.export')); self::assertSame([], glob($this->root . '/.export-*')); self::assertFileExists($this->file($row));
    }

    public function testReadersAndForeignFundsCannotExportOrPurge(): void
    {
        $row = $this->attachment(); $export = $this->export([$row]);
        $reader = $this->createAccount(email: 'reader@example.test'); $this->grant($reader, 'costumes.view', $this->fund); $this->signInAs($reader);
        self::assertError(403, 'forbidden', $this->export([$row])); self::assertError(403, 'forbidden', $this->purge([$row], $export->header('X-Attachment-Export-Id')));
        $other = $this->createUnit('Other'); $this->grant($reader, 'costumes.manage', $other);
        self::assertError(404, 'not_found', $this->post("/v1/funds/$other/attachments/export", ['attachments' => $this->versions([$row])]));
        self::assertError(404, 'not_found', $this->post("/v1/funds/$other/attachments/purge", ['attachments' => $this->versions([$row]), 'exportId' => $export->header('X-Attachment-Export-Id'), 'confirmArchived' => true]));
        self::assertFileExists($this->file($row)); self::assertSame(0, $this->auditCount('attachment.purge'));
    }

    public function testInvalidOrDuplicateEntriesDoNotProduceAnyExport(): void
    {
        $row = $this->attachment(); $entry = $this->versions([$row])[0];
        foreach ([[], [$entry, $entry], [['id' => '../public/scan', 'version' => 1]], [['id' => $row['id'], 'version' => 0]], [$entry + ['path' => '/tmp/scan']]] as $entries) {
            self::assertError(422, 'validation_failed', $this->post($this->base() . '/export', ['attachments' => $entries]));
        }
        self::assertSame(0, $this->auditCount('attachment.export')); self::assertFileExists($this->file($row));
    }

    public function testFilesystemCleanupFailureIsReportedAndCanBeRetriedWithoutAnotherAudit(): void
    {
        $row = $this->attachment(); $export = $this->export([$row]); $receipt = $export->header('X-Attachment-Export-Id');
        $marker = dirname($this->file($row)) . '/cleanup-marker'; file_put_contents($marker, 'Unexpected local file');
        self::assertError(500, 'internal_error', $this->purge([$row], $receipt));
        self::assertNotNull($this->get('/v1/attachments/' . $row['id'])->decodedBody()['purgedAt']);
        self::assertSame(1, $this->auditCount('attachment.purge'));
        self::assertError(410, 'attachment_purged', $this->get('/v1/attachments/' . $row['id'] . '/content'));
        unlink($marker);
        self::assertStatus(200, $this->purge([$row], $receipt)); self::assertDirectoryDoesNotExist(dirname($this->file($row)));
        self::assertSame(1, $this->auditCount('attachment.purge'));
    }

    private function configure(array $settings = []): void
    {
        $this->app = new App(new Config(['cors' => ['allowedOrigins' => [self::ORIGIN]], 'attachments' => $settings + ['root' => $this->root]]), Connection::fromPdo($this->db), $this->mailer);
    }
    private function attachment(string $caption = 'Original'): array
    {
        $path = tempnam($this->root, 'upload-'); file_put_contents($path, "%PDF-1.7\n$caption\n%%EOF\n");
        $response = $this->send('POST', '/v1/attachments', form: ['unitId' => (string) $this->fund, 'ownerType' => 'person', 'ownerId' => (string) $this->person,
            'kind' => 'person_card', 'caption' => $caption], files: ['file' => new UploadedFile($path)]);
        self::assertStatus(201, $response); return $response->decodedBody();
    }
    private function export(array $rows): Response { return $this->post($this->base() . '/export', ['attachments' => $this->versions($rows)]); }
    private function purge(array $rows, string $receipt, mixed $confirmation = true): Response
    {
        return $this->post($this->base() . '/purge', ['attachments' => $this->versions($rows), 'exportId' => $receipt, 'confirmArchived' => $confirmation]);
    }
    private function versions(array $rows): array { return array_map(static fn (array $row): array => ['id' => $row['id'], 'version' => $row['version']], $rows); }
    private function file(array $row): string { return $this->root . '/' . $row['id'] . '/content'; }
    private function base(): string { return "/v1/funds/{$this->fund}/attachments"; }
}
