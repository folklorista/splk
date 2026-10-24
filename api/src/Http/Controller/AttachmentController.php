<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\AttachmentImage;
use Splk\Api\Domain\Costumes\AttachmentRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Attachments\AttachmentStorage;

/** Private, fund-scoped files (docs/06; scan workflow in docs/current/krojarka chap. 5). */
final class AttachmentController extends Controller
{
    public function __construct(\Closure $db, private readonly array $settings = []) { parent::__construct($db); }

    public function register(Router $router): void
    {
        $router->add('POST', '/v1/attachments', $this->upload(...));
        $router->add('GET', '/v1/attachments', $this->list(...));
        $router->add('GET', '/v1/attachments/{uuid}', $this->detail(...));
        $router->add('PATCH', '/v1/attachments/{uuid}', $this->update(...));
        $router->add('GET', '/v1/attachments/{uuid}/content', fn (Request $r, RequestContext $c): Response => $this->content($r, $c, false));
        $router->add('GET', '/v1/attachments/{uuid}/thumbnail', fn (Request $r, RequestContext $c): Response => $this->content($r, $c, true));
        $router->add('POST', '/v1/attachments/{uuid}/archive', $this->archive(...));
    }

    private function upload(Request $request, RequestContext $context): Response
    {
        if ($request->mediaType() !== 'multipart/form-data') throw new HttpException(415, 'unsupported_media_type', 'Upload must use multipart/form-data.');
        $maxBytes = (int) ($this->settings['maxBytes'] ?? 10485760);
        $length = $request->header('content-length');
        if ($length !== null && ctype_digit($length) && (int) $length > $maxBytes + 65536) throw new HttpException(413, 'file_too_large', 'The upload exceeds the configured limit.');
        InventoryInput::only($request->form, ['unitId', 'ownerType', 'ownerId', 'kind', 'page', 'caption', 'originalDate']);
        $unit = $this->fund($context, (string) InventoryInput::queryInteger($request->form['unitId'] ?? null, 'unitId'), true);
        $values = $request->form; unset($values['unitId']);
        foreach (['ownerId', 'page'] as $field) if (array_key_exists($field, $values)) $values[$field] = InventoryInput::queryInteger($values[$field], $field, 1, 2147483647);
        $metadata = $this->metadata($values);
        $this->repository()->owner($unit, $metadata['ownerType'], $metadata['ownerId']);
        if (array_keys($request->files) !== ['file']) throw Input::invalid('file', 'required');
        $content = $request->files['file']->read($maxBytes);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($content);
        $thumbnail = null;
        if (in_array($mime, ['image/jpeg', 'image/png'], true)) {
            $image = AttachmentImage::prepare($content, $mime, (int) ($this->settings['maxPixels'] ?? 24000000));
            $content = $image['content']; $thumbnail = $image['thumbnail'];
        } elseif ($mime === 'application/pdf') {
            if (!preg_match('/^%PDF-1\.[0-9]/D', $content) && !str_starts_with($content, '%PDF-2.0')) throw $this->invalidFile();
            if (!preg_match('/%%EOF\s*$/D', $content)) throw $this->invalidFile();
        } else throw $this->invalidFile();
        $stored = null;
        try {
            $result = $this->audited($context, 'attachment.upload', $unit, function () use ($metadata, $unit, $mime, $content, $thumbnail, $context, &$stored): array {
                $this->repository()->owner($unit, $metadata['ownerType'], $metadata['ownerId'], true);
                if ($this->repository()->countActive($unit, $metadata['ownerType'], $metadata['ownerId']) >= (int) ($this->settings['maxPerOwner'] ?? 100)) {
                    throw new HttpException(422, 'attachment_limit', 'The attachment limit for this owner has been reached.');
                }
                $row = $this->repository()->insert($unit, $metadata, $mime, $content, $thumbnail, self::actor($context));
                $this->storage()->write($row['uuid'], $content, $thumbnail); $stored = $row['uuid'];
                return ['id' => (int) $row['id'], 'attachment' => AttachmentRepository::dto($row)];
            });
        } catch (\Throwable $error) {
            if ($stored !== null) $this->storage()->remove($stored);
            throw $error;
        }
        return Response::json($result['attachment'], 201);
    }

    private function list(Request $request, RequestContext $context): Response
    {
        InventoryInput::only($request->query, ['unitId', 'ownerType', 'ownerId', 'archived', 'purged', 'limit', 'offset']);
        $unit = $this->fund($context, (string) InventoryInput::queryInteger($request->query['unitId'] ?? null, 'unitId'), false);
        $type = null; $owner = null;
        if (array_key_exists('ownerType', $request->query) || array_key_exists('ownerId', $request->query)) {
            $type = (new Input($request->query))->enum('ownerType', AttachmentRepository::OWNERS);
            $owner = InventoryInput::queryInteger($request->query['ownerId'] ?? null, 'ownerId');
            $this->repository()->owner($unit, $type, $owner);
        }
        [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->repository()->list($unit, $type, $owner, $this->queryBool($request, 'archived'), $this->queryBool($request, 'purged'), $limit, $offset));
    }

    private function detail(Request $request, RequestContext $context): Response
    {
        return Response::json(AttachmentRepository::dto($this->accessible($context, false)));
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $body = $request->json(); InventoryInput::only($body, ['version', 'ownerType', 'ownerId', 'kind', 'page', 'caption', 'originalDate']);
        $version = (new Input($body))->id('version'); unset($body['version']);
        if (array_key_exists('ownerType', $body) !== array_key_exists('ownerId', $body)) throw Input::invalid('ownerId', 'required');
        $result = $this->audited($context, 'attachment.update', (int) $initial['unit_id'], function () use ($initial, $version, $body): array {
            $row = $this->repository()->find($initial['uuid'], true); $this->editable($row, $version);
            $metadata = $this->metadata($body + array_intersect_key(AttachmentRepository::dto($row), array_flip(['ownerType', 'ownerId', 'kind', 'page', 'caption', 'originalDate'])));
            $this->repository()->owner((int) $row['unit_id'], $metadata['ownerType'], $metadata['ownerId'], true);
            if (($row['owner_type'] !== $metadata['ownerType'] || (int) $row['owner_id'] !== $metadata['ownerId'])
                && $this->repository()->countActive((int) $row['unit_id'], $metadata['ownerType'], $metadata['ownerId']) >= (int) ($this->settings['maxPerOwner'] ?? 100)) {
                throw new HttpException(422, 'attachment_limit', 'The attachment limit for this owner has been reached.');
            }
            $updated = $this->repository()->update($row['uuid'], $metadata);
            return ['id' => (int) $updated['id'], 'attachment' => AttachmentRepository::dto($updated)];
        });
        return Response::json($result['attachment']);
    }

    private function archive(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true); $body = $request->json(); InventoryInput::only($body, ['version']);
        $version = (new Input($body))->id('version');
        $result = $this->audited($context, 'attachment.archive', (int) $initial['unit_id'], function () use ($initial, $version): array {
            $row = $this->repository()->find($initial['uuid'], true); $this->editable($row, $version);
            $archived = $this->repository()->archive($row['uuid']);
            return ['id' => (int) $row['id'], 'attachment' => AttachmentRepository::dto($archived)];
        });
        return Response::json($result['attachment']);
    }

    private function content(Request $request, RequestContext $context, bool $thumbnail): Response
    {
        return \Splk\Api\Infrastructure\Db\Transaction::run($this->db(), function () use ($context, $thumbnail): Response {
            $row = $this->accessible($context, false, true);
            if ($row['purged_at'] !== null) throw new HttpException(410, 'attachment_purged', 'Attachment content has been purged.');
            if ($thumbnail && $row['thumbnail_mime'] === null) throw self::notFound();
            $mime = $thumbnail ? $row['thumbnail_mime'] : $row['mime'];
            $extension = $thumbnail || $mime === 'image/jpeg' ? 'jpg' : ($mime === 'image/png' ? 'png' : 'pdf');
            return new Response(200, ['Content-Type' => $mime, 'Content-Disposition' => ($mime === 'application/pdf' ? 'attachment' : 'inline') . '; filename="' . $row['uuid'] . '.' . $extension . '"',
                'Content-Security-Policy' => "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy' => 'same-site'], $this->storage()->read($row['uuid'], $thumbnail));
        });
    }

    private function accessible(RequestContext $context, bool $write, bool $lock = false): array
    {
        $row = $this->repository()->find($context->params['uuid']) ?? throw self::notFound();
        $this->fund($context, (string) $row['unit_id'], $write);
        return $lock ? ($this->repository()->find($row['uuid'], true) ?? throw self::notFound()) : $row;
    }

    private function editable(array $row, int $version): void
    {
        InventoryInput::version(['version' => (int) $row['version']], $version);
        if ($row['purged_at'] !== null) throw new HttpException(410, 'attachment_purged', 'Attachment content has been purged.');
    }

    private function metadata(array $values): array
    {
        $input = new Input($values); $type = $input->enum('ownerType', AttachmentRepository::OWNERS);
        $kind = $input->enum('kind', AttachmentRepository::KINDS[$type]);
        $date = $input->optionalString('originalDate', 10);
        if ($date !== null) {
            $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            if ($parsed === false || $parsed->format('Y-m-d') !== $date) throw Input::invalid('originalDate', 'invalid');
        }
        return ['ownerType' => $type, 'ownerId' => $input->id('ownerId'), 'kind' => $kind,
            'page' => array_key_exists('page', $values) ? InventoryInput::quantity($values, 'page', 1) : 1,
            'caption' => $input->optionalString('caption', 2000), 'originalDate' => $date];
    }

    private function queryBool(Request $request, string $field): bool
    {
        $value = $request->query[$field] ?? 'false';
        if (!in_array($value, ['true', 'false'], true)) throw Input::invalid($field, 'invalid');
        return $value === 'true';
    }
    private function fund(RequestContext $context, string $id, bool $write): int { return (new FundAccess($this->db()))->require($this->mandates($context), $id, $write); }
    private function repository(): AttachmentRepository { return new AttachmentRepository($this->db()); }
    private function storage(): AttachmentStorage { return new AttachmentStorage((string) ($this->settings['root'] ?? dirname(__DIR__, 3) . '/storage/attachments')); }
    private function invalidFile(): HttpException { return new HttpException(422, 'invalid_file', 'Only complete JPEG, PNG or PDF files are supported.'); }
}
