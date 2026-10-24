<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Response;
use Splk\Api\Http\UploadedFile;
use Splk\Api\Infrastructure\Db\Connection;

final class AttachmentsTest extends ApiTestCase
{
    private string $root;
    private int $fund;
    private int $actor;
    private int $person;
    private int $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->root = sys_get_temp_dir() . '/splk-attachments-' . bin2hex(random_bytes(8)); mkdir($this->root, 0700);
        $this->configure();
        $this->fund = $this->createUnit(); $this->actor = $this->createAccount();
        $this->grant($this->actor, 'costumes.manage', $this->fund); $this->signInAs($this->actor);
        $this->person = (int) $this->db->query("SELECT person_id FROM user_accounts WHERE id = {$this->actor}")->fetchColumn();
        $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
        $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
        $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id) VALUES ({$this->fund}, $series)");
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

    public function testImageUploadStoresSanitizedPrivateContentAndThumbnailWithAudit(): void
    {
        $response = $this->upload($this->png()); self::assertStatus(201, $response); $row = $response->decodedBody();
        self::assertMatchesRegularExpression('/^[a-f0-9-]{36}$/D', $row['id']);
        self::assertTrue($row['hasThumbnail']); self::assertSame('image/png', $row['mime']); self::assertSame(2, $row['page']);
        self::assertArrayNotHasKey('storageKey', $row); self::assertArrayNotHasKey('storage_key', $row);
        $content = $this->get($this->path($row) . '/content'); self::assertStatus(200, $content);
        self::assertStringNotContainsString('GPS-SECRET', $content->body);
        self::assertSame(hash('sha256', $content->body), $row['sha256']); self::assertSame(strlen($content->body), $row['size']);
        self::assertSame('image/png', $content->header('Content-Type')); self::assertSame('no-store', $content->header('Cache-Control'));
        self::assertSame('nosniff', $content->header('X-Content-Type-Options'));
        $preview = $this->get($this->path($row) . '/thumbnail'); self::assertStatus(200, $preview);
        self::assertSame('image/jpeg', getimagesizefromstring($preview->body)['mime']);
        self::assertSame(0600, fileperms($this->root . '/' . $row['id'] . '/content') & 0777);
        self::assertSame(1, $this->auditCount('attachment.upload'));
        $audit = json_decode($this->db->query("SELECT data FROM audit_log WHERE action = 'attachment.upload'")->fetchColumn(), true);
        self::assertSame($row['id'], $audit['attachment']['id']); self::assertStringNotContainsString($this->root, json_encode($audit));
        self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_loans')->fetchColumn());
    }

    public function testPdfIsDownloadOnlyAndDoesNotPretendToHaveAnImageThumbnail(): void
    {
        $pdf = "%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n";
        $uploaded = $this->upload($pdf); self::assertStatus(201, $uploaded); $row = $uploaded->decodedBody();
        self::assertFalse($row['hasThumbnail']); self::assertSame('application/pdf', $row['mime']);
        $download = $this->get($this->path($row) . '/content'); self::assertSame($pdf, $download->body);
        self::assertStringStartsWith('attachment;', $download->header('Content-Disposition'));
        self::assertSame("default-src 'none'; sandbox", $download->header('Content-Security-Policy'));
        self::assertError(404, 'not_found', $this->get($this->path($row) . '/thumbnail'));
    }

    public function testReaderCanReadPersonScansButCannotWriteAndForeignUsersSeeNothing(): void
    {
        $response = $this->upload($this->png(), ['ownerType' => 'person', 'ownerId' => (string) $this->person, 'kind' => 'person_card']);
        self::assertStatus(201, $response); $row = $response->decodedBody();
        $reader = $this->createAccount(email: 'reader@example.test'); $this->grant($reader, 'costumes.view', $this->fund); $this->signInAs($reader);
        self::assertStatus(200, $this->get($this->path($row))); self::assertStatus(200, $this->get($this->path($row) . '/content'));
        self::assertStatus(200, $this->get($this->listing('person', $this->person)));
        self::assertError(403, 'forbidden', $this->upload($this->png()));
        self::assertError(403, 'forbidden', $this->patch($this->path($row), ['version' => 1, 'caption' => 'No']));
        self::assertError(403, 'forbidden', $this->post($this->path($row) . '/archive', ['version' => 1]));
        $other = $this->createAccount(email: 'other@example.test'); $this->grant($other, 'costumes.manage', $this->createUnit('Other')); $this->signInAs($other);
        foreach (['', '/content', '/thumbnail'] as $suffix) self::assertError(404, 'not_found', $this->get($this->path($row) . $suffix));
        self::assertError(404, 'not_found', $this->get($this->listing('person', $this->person)));
        self::assertError(404, 'not_found', $this->post($this->path($row) . '/archive', ['version' => 1]));
        self::assertSame(1, $this->auditCount('attachment.upload')); self::assertSame(0, $this->auditCount('attachment.archive'));
    }

    public function testOrganizationAdministrationDoesNotGrantFileAccess(): void
    {
        $row = $this->upload($this->png())->decodedBody();
        $admin = $this->createAccount(email: 'admin@example.test'); $this->grant($admin, 'organization.admin'); $this->signInAs($admin);
        self::assertError(404, 'not_found', $this->get($this->path($row) . '/content'));
        self::assertError(404, 'not_found', $this->upload($this->png()));
        $this->signOut(); self::assertError(401, 'unauthenticated', $this->get($this->path($row)));
        self::assertError(401, 'unauthenticated', $this->upload($this->png()));
    }

    public function testMultipartUploadCannotBypassCsrfOrOriginChecks(): void
    {
        ['token' => $token] = $this->app->sessions()->create($this->actor, 'Missing CSRF');
        $request = new \Splk\Api\Http\Request('POST', '/v1/attachments',
            ['Origin' => self::ORIGIN, 'Content-Type' => 'multipart/form-data; boundary=test'],
            cookies: [self::COOKIE => $token], form: ['unitId' => (string) $this->fund], files: ['file' => new UploadedFile('', UPLOAD_ERR_NO_FILE)]);
        self::assertError(403, 'csrf_token_invalid', $this->app->handle($request));
        self::assertError(403, 'origin_required', $this->app->handle(new \Splk\Api\Http\Request('POST', '/v1/attachments',
            ['Content-Type' => 'multipart/form-data'], cookies: [self::COOKIE => $token], form: ['unitId' => (string) $this->fund])));
        self::assertSame(0, $this->auditCount('attachment.upload')); self::assertSame([], glob($this->root . '/*/content'));
    }

    public function testMetadataVersionsArchiveAndPaginationPreserveEveryOriginal(): void
    {
        $first = $this->upload($this->png())->decodedBody(); $second = $this->upload($this->png(), ['page' => '1'])->decodedBody();
        $list = $this->get($this->listing() . '&limit=1')->decodedBody(); self::assertSame(2, $list['total']); self::assertSame($second['id'], $list['items'][0]['id']);
        $original = $this->get($this->path($first) . '/content')->body;
        self::assertError(409, 'version_conflict', $this->patch($this->path($first), ['version' => 2, 'caption' => 'Stale']));
        $updated = $this->patch($this->path($first), ['version' => 1, 'caption' => 'Checked original', 'originalDate' => '2026-10-24', 'page' => 1]); self::assertStatus(200, $updated);
        self::assertSame(2, $updated->decodedBody()['version']); self::assertSame('2026-10-24', $updated->decodedBody()['originalDate']);
        self::assertSame($original, $this->get($this->path($first) . '/content')->body);
        self::assertError(409, 'version_conflict', $this->post($this->path($first) . '/archive', ['version' => 1]));
        $archived = $this->post($this->path($first) . '/archive', ['version' => 2]); self::assertStatus(200, $archived);
        self::assertNotNull($archived->decodedBody()['archivedAt']); self::assertSame(3, $archived->decodedBody()['version']);
        self::assertSame(1, $this->get($this->listing())->decodedBody()['total']);
        self::assertSame(2, $this->get($this->listing() . '&archived=true')->decodedBody()['total']);
        self::assertSame($original, $this->get($this->path($first) . '/content')->body);
        self::assertSame(1, $this->auditCount('attachment.update')); self::assertSame(1, $this->auditCount('attachment.archive'));
    }

    public function testInvalidMetadataAndOwnersNeverCreateFilesOrAudit(): void
    {
        foreach ([['ownerId' => '999999999'], ['ownerType' => 'person', 'ownerId' => (string) $this->person],
            ['ownerType' => 'archive', 'ownerId' => (string) $this->createUnit('Other'), 'kind' => 'loan_book'],
            ['page' => '-1'], ['page' => ['1']], ['page' => '01'], ['originalDate' => '2026-02-31'], ['storageKey' => '../public/scan']] as $metadata) {
            $response = $this->upload($this->png(), $metadata); self::assertContains($response->status, [404, 422], $response->body);
        }
        self::assertSame(0, $this->db->query('SELECT count(*) FROM attachments')->fetchColumn()); self::assertSame(0, $this->auditCount('attachment.upload'));
        self::assertSame([], glob($this->root . '/*/content'));
    }

    public function testUnsupportedTruncatedOversizedAndIncompleteUploadsAreRejected(): void
    {
        foreach (['<?php echo 1;', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', "%PDF-1.7\ntruncated", "\x89PNG\r\n\x1a\ninvalid"] as $content) {
            self::assertError(422, 'invalid_file', $this->upload($content));
        }
        self::assertError(413, 'file_too_large', $this->upload(str_repeat('x', 10001)));
        self::assertError(422, 'invalid_file', $this->upload($this->png(), [], UPLOAD_ERR_PARTIAL));
        self::assertError(413, 'file_too_large', $this->upload($this->png(), [], UPLOAD_ERR_INI_SIZE));
        self::assertSame(0, $this->auditCount('attachment.upload')); self::assertSame([], glob($this->root . '/*/content'));
    }

    public function testQuotaAndCrossFundRelinkingCannotBypassOwnerIntegrity(): void
    {
        $first = $this->upload($this->png())->decodedBody(); $this->upload($this->png()); $this->upload($this->png());
        self::assertError(422, 'attachment_limit', $this->upload($this->png()));
        self::assertError(422, 'validation_failed', $this->patch($this->path($first), ['version' => 1, 'ownerType' => 'person']));
        self::assertError(404, 'not_found', $this->patch($this->path($first), ['version' => 1, 'ownerType' => 'archive', 'ownerId' => $this->createUnit('Other'), 'kind' => 'loose_slip']));
        $changed = $this->patch($this->path($first), ['version' => 1, 'ownerType' => 'person', 'ownerId' => $this->person, 'kind' => 'person_card']); self::assertStatus(200, $changed);
        self::assertSame($this->person, $changed->decodedBody()['ownerId']); self::assertSame(0, $this->db->query('SELECT count(*) FROM costume_holder_profiles')->fetchColumn());
        self::assertSame(3, $this->auditCount('attachment.upload'));
    }

    public function testAuditFailureRollsBackMetadataAndRemovesTheNewFileOnly(): void
    {
        $first = $this->upload($this->png())->decodedBody();
        $this->db->exec("CREATE UNIQUE INDEX test_attachment_audit ON audit_log (unit_id) WHERE action = 'attachment.upload'");
        self::assertError(422, 'duplicate_name', $this->upload($this->png()));
        self::assertSame(1, $this->db->query('SELECT count(*) FROM attachments')->fetchColumn()); self::assertSame(1, count(glob($this->root . '/*/content')));
        self::assertStatus(200, $this->get($this->path($first) . '/content')); self::assertSame(1, $this->auditCount('attachment.upload'));
    }

    public function testMalformedIdentifiersAndQueryFlagsAreRejected(): void
    {
        foreach (['not-a-uuid', '00000000-0000-0000-0000-000000000000'] as $uuid) self::assertError(404, 'not_found', $this->get('/v1/attachments/' . $uuid));
        foreach (['&limit=201', '&archived=yes', '&ownerType=unknown', '&purged=1'] as $query) self::assertError(422, 'validation_failed', $this->get($this->listing() . $query));
        self::assertError(415, 'unsupported_media_type', $this->post('/v1/attachments', []));
    }

    private function configure(): void
    {
        $this->app = new App(new Config(['cors' => ['allowedOrigins' => [self::ORIGIN]],
            'attachments' => ['root' => $this->root, 'maxBytes' => 10000, 'maxPerOwner' => 3]]), Connection::fromPdo($this->db), $this->mailer);
    }
    private function upload(string $content, array $metadata = [], int $error = UPLOAD_ERR_OK): Response
    {
        $path = tempnam($this->root, 'upload-'); file_put_contents($path, $content);
        return $this->send('POST', '/v1/attachments', form: $metadata + ['unitId' => (string) $this->fund, 'ownerType' => 'item',
            'ownerId' => (string) $this->item, 'kind' => 'item_photo', 'page' => '2'], files: ['file' => new UploadedFile($path, $error)]);
    }
    private function path(array $row): string { return '/v1/attachments/' . $row['id']; }
    private function listing(string $type = 'item', ?int $owner = null): string { return '/v1/attachments?unitId=' . $this->fund . '&ownerType=' . $type . '&ownerId=' . ($owner ?? $this->item); }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
    private function png(): string
    {
        $image = imagecreatetruecolor(80, 120); ob_start(); imagepng($image); $png = ob_get_clean();
        $payload = "Location\0GPS-SECRET"; $chunk = 'tEXt' . $payload;
        return substr($png, 0, 33) . pack('N', strlen($payload)) . $chunk . hash('crc32b', $chunk, true) . substr($png, 33);
    }
}
