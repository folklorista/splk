<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\AttachmentRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Attachments\AttachmentStorage;
use Splk\Api\Infrastructure\Audit\AuditLog;
use Splk\Api\Infrastructure\Db\Transaction;

/** D-40: an explicit export receipt and external-archive confirmation precede deletion. */
final class AttachmentExportController extends Controller
{
    public function __construct(\Closure $db, private readonly array $settings = []) { parent::__construct($db); }

    public function register(Router $router): void
    {
        $router->add('POST', '/v1/funds/{unitId}/attachments/export', $this->export(...));
        $router->add('POST', '/v1/funds/{unitId}/attachments/purge', $this->purge(...));
    }

    private function export(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context); $body = $request->json(); InventoryInput::only($body, ['attachments']);
        $entries = $this->entries($body); $temporary = null;
        try {
            $export = $this->audited($context, 'attachment.export', $unit, function () use ($unit, $entries, $context, &$temporary): array {
                $rows = []; $total = 0;
                foreach ($entries as $entry) {
                    $row = $this->row($unit, $entry['id']); $this->version($row, $entry['version']);
                    if ($row['purged_at'] !== null) throw new HttpException(410, 'attachment_purged', 'Attachment content has been purged.');
                    $rows[] = $row; $total += (int) $row['size'];
                }
                $limit = (int) ($this->settings['maxExportBytes'] ?? 52428800);
                $memory = trim((string) ini_get('memory_limit'));
                if (preg_match('/^(\d+)([KMG]?)$/iD', $memory, $parts)) {
                    $bytes = (int) $parts[1] * match (strtoupper($parts[2])) { 'G' => 1073741824, 'M' => 1048576, 'K' => 1024, default => 1 };
                    $limit = min($limit, max(0, intdiv($bytes - memory_get_usage(true) - 8388608, 2)));
                }
                if ($total > $limit) throw new HttpException(413, 'file_too_large', 'Split this export into smaller batches.');
                $manifest = array_map(AttachmentRepository::dto(...), $rows);
                $temporary = $this->storage()->temporaryFile(); $zip = new \ZipArchive();
                if ($zip->open($temporary, \ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Cannot create attachment export.');
                try {
                    foreach ($rows as $row) {
                        $path = $this->storage()->path($row['uuid']);
                        if (hash_file('sha256', $path) !== $row['sha256']) throw new \RuntimeException('Attachment content does not match its digest.');
                        $name = $row['uuid'] . '.' . match ($row['mime']) { 'image/jpeg' => 'jpg', 'image/png' => 'png', default => 'pdf' };
                        if (!$zip->addFile($path, $name) || !$zip->setCompressionName($name, \ZipArchive::CM_STORE)) throw new \RuntimeException('Cannot add attachment to export.');
                    }
                    if (!$zip->addFromString('manifest.json', json_encode($manifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) throw new \RuntimeException('Cannot add export manifest.');
                } catch (\Throwable $error) { $zip->close(); throw $error; }
                if (!$zip->close()) throw new \RuntimeException('Incomplete attachment export.');
                $bytes = file_get_contents($temporary);
                if ($bytes === false) throw new \RuntimeException('Cannot read attachment export.');
                $statement = $this->db()->prepare('INSERT INTO attachment_exports (unit_id, created_by, manifest) VALUES (:unit, :actor, CAST(:manifest AS jsonb)) RETURNING id, uuid');
                $statement->execute(['unit' => $unit, 'actor' => self::actor($context), 'manifest' => json_encode($manifest, JSON_THROW_ON_ERROR)]);
                $receipt = $statement->fetch();
                return ['id' => (int) $receipt['id'], 'receipt' => $receipt['uuid'], 'bytes' => $bytes];
            }, auditData: ['attachments' => $entries]);
        } finally {
            if ($temporary !== null && is_file($temporary)) unlink($temporary);
        }
        return new Response(200, ['Content-Type' => 'application/zip', 'Content-Disposition' => 'attachment; filename="krojove-podklady-' . $export['receipt'] . '.zip"',
            'X-Attachment-Export-Id' => $export['receipt']], $export['bytes']);
    }

    private function purge(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context); $body = $request->json(); InventoryInput::only($body, ['attachments', 'exportId', 'confirmArchived']);
        if (($body['confirmArchived'] ?? null) !== true) throw $this->exportRequired();
        $uuid = $body['exportId'] ?? null;
        if (!is_string($uuid) || !$this->uuid($uuid)) throw $this->exportRequired();
        $entries = $this->entries($body);
        $statement = $this->db()->prepare('SELECT * FROM attachment_exports WHERE uuid = :uuid AND unit_id = :unit');
        $statement->execute(['uuid' => $uuid, 'unit' => $unit]); $receipt = $statement->fetch();
        if ($receipt === false) throw self::notFound();
        $manifest = array_column(json_decode($receipt['manifest'], true, 64, JSON_THROW_ON_ERROR), null, 'id');
        $result = Transaction::run($this->db(), function () use ($unit, $entries, $manifest, $context, $uuid): array {
            $result = [];
            foreach ($entries as $entry) {
                $row = $this->row($unit, $entry['id']); $exported = $manifest[$entry['id']] ?? null;
                if ($exported === null || $exported['version'] !== $entry['version'] || $exported['sha256'] !== $row['sha256']) throw $this->exportRequired();
                if ($row['purged_at'] !== null) {
                    // Retry filesystem cleanup after a previous partial I/O failure, without another mutation/audit.
                    $this->version($row, $entry['version'] + 1); $result[] = AttachmentRepository::dto($row); continue;
                }
                $this->version($row, $entry['version']);
                $purged = (new AttachmentRepository($this->db()))->purge($row['uuid']);
                (new AuditLog($this->db()))->record(self::actor($context), 'attachment.purge', 'attachment', (int) $row['id'], $unit,
                    ['uuid' => $row['uuid'], 'exportId' => $uuid, 'sha256' => $row['sha256'], 'confirmArchived' => true]);
                $result[] = AttachmentRepository::dto($purged);
            }
            return $result;
        });
        // Never delete files before the metadata/audit transaction succeeds. Failures remain private
        // and are retryable with the same receipt; no successful response precedes physical cleanup.
        foreach ($result as $row) $this->storage()->remove($row['id']);
        return Response::json(['items' => $result]);
    }

    private function entries(array $body): array
    {
        $entries = $body['attachments'] ?? null;
        if (!is_array($entries) || !array_is_list($entries) || count($entries) < 1 || count($entries) > 100) throw Input::invalid('attachments', 'invalid');
        $ids = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) throw Input::invalid('attachments', 'invalid');
            InventoryInput::only($entry, ['id', 'version']);
            if (!is_string($entry['id'] ?? null) || !$this->uuid($entry['id']) || isset($ids[$entry['id']])) throw Input::invalid('id', 'invalid');
            $ids[$entry['id']] = true; (new Input($entry))->id('version');
        }
        usort($entries, static fn (array $a, array $b): int => strcmp($a['id'], $b['id']));
        return $entries;
    }
    private function row(int $unit, string $uuid): array
    {
        $row = (new AttachmentRepository($this->db()))->find($uuid, true) ?? throw self::notFound();
        if ((int) $row['unit_id'] !== $unit) throw self::notFound(); return $row;
    }
    private function version(array $row, int $version): void { InventoryInput::version(['version' => (int) $row['version']], $version); }
    private function uuid(string $id): bool { return (bool) preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $id); }
    private function fund(RequestContext $context): int { return (new FundAccess($this->db()))->require($this->mandates($context), $context->params['unitId'], true); }
    private function storage(): AttachmentStorage { return new AttachmentStorage((string) ($this->settings['root'] ?? dirname(__DIR__, 3) . '/storage/attachments')); }
    private function exportRequired(): HttpException { return new HttpException(422, 'attachment_export_required', 'Export current content and confirm its external archival before deletion.'); }
}
