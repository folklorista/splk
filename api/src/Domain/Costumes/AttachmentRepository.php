<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\HttpException;

final class AttachmentRepository
{
    public const OWNERS = ['person', 'kit', 'series', 'item', 'inventory_check', 'archive'];
    public const KINDS = ['person' => ['person_card', 'loose_slip'], 'kit' => ['kit_card', 'kit_label', 'loose_slip'],
        'series' => ['series_card', 'loose_slip'], 'item' => ['item_photo', 'loose_slip'], 'inventory_check' => ['check_photo'], 'archive' => ['loan_book', 'loose_slip']];

    public function __construct(private readonly PDO $db) {}

    public function find(string $uuid, bool $lock = false): ?array
    {
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $uuid)) return null;
        $statement = $this->db->prepare('SELECT * FROM attachments WHERE uuid = :uuid' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['uuid' => $uuid]);
        return $statement->fetch() ?: null;
    }

    /** Serialize the owner's upload quota with other uploads, without creating a profile or membership. */
    public function owner(int $unit, string $type, int $id, bool $lock = false): void
    {
        $table = match ($type) { 'person' => 'persons', 'kit' => 'costume_kits', 'series' => 'costume_series',
            'item' => 'costume_items', 'inventory_check' => 'inventory_checks', 'archive' => 'units', default => throw new \LogicException('Invalid owner type') };
        $sql = "SELECT id FROM $table WHERE id = :id";
        $parameters = ['id' => $id];
        if ($type === 'archive') { $sql .= ' AND id = :unit'; $parameters['unit'] = $unit; }
        elseif ($type !== 'person') { $sql .= ' AND unit_id = :unit'; $parameters['unit'] = $unit; }
        $statement = $this->db->prepare($sql . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute($parameters);
        if ($statement->fetchColumn() === false) throw new HttpException(404, 'not_found', 'Not found.');
    }

    public function list(int $unit, ?string $type, ?int $owner, bool $archived, bool $purged, int $limit, int $offset): array
    {
        $where = 'unit_id = :unit';
        $parameters = ['unit' => $unit];
        if ($type !== null) { $where .= ' AND owner_type = :type AND owner_id = :owner'; $parameters += ['type' => $type, 'owner' => $owner]; }
        if (!$archived) $where .= ' AND archived_at IS NULL';
        if (!$purged) $where .= ' AND purged_at IS NULL';
        $count = $this->db->prepare("SELECT count(*) FROM attachments WHERE $where"); $count->execute($parameters);
        $statement = $this->db->prepare("SELECT * FROM attachments WHERE $where ORDER BY page, uploaded_at, id LIMIT $limit OFFSET $offset"); $statement->execute($parameters);
        return ['items' => array_map(self::dto(...), $statement->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    public function countActive(int $unit, string $type, int $owner): int
    {
        $statement = $this->db->prepare('SELECT count(*) FROM attachments WHERE unit_id = :unit AND owner_type = :type AND owner_id = :owner AND purged_at IS NULL');
        $statement->execute(['unit' => $unit, 'type' => $type, 'owner' => $owner]); return (int) $statement->fetchColumn();
    }

    public function insert(int $unit, array $metadata, string $mime, string $content, ?string $thumbnail, int $actor): array
    {
        $statement = $this->db->prepare('INSERT INTO attachments (uuid, storage_key, unit_id, owner_type, owner_id, kind, mime, size, sha256, thumbnail_mime, thumbnail_size, page, caption, original_date, uploaded_by)
            SELECT uuid, uuid::text, :unit, :ownerType, :ownerId, :kind, :mime, :size, :sha256, :thumbnailMime, :thumbnailSize, :page, :caption, :originalDate, :actor
            FROM (SELECT gen_random_uuid() AS uuid) AS identity RETURNING *');
        $statement->execute($metadata + ['unit' => $unit, 'mime' => $mime, 'size' => strlen($content), 'sha256' => hash('sha256', $content),
            'thumbnailMime' => $thumbnail === null ? null : 'image/jpeg', 'thumbnailSize' => $thumbnail === null ? null : strlen($thumbnail), 'actor' => $actor]);
        return $statement->fetch();
    }

    public function update(string $uuid, array $metadata): array
    {
        $statement = $this->db->prepare('UPDATE attachments SET owner_type = :ownerType, owner_id = :ownerId, kind = :kind, page = :page,
            caption = :caption, original_date = :originalDate, version = version + 1 WHERE uuid = :uuid RETURNING *');
        $statement->execute($metadata + ['uuid' => $uuid]); return $statement->fetch();
    }

    public function archive(string $uuid): array
    {
        $statement = $this->db->prepare('UPDATE attachments SET archived_at = COALESCE(archived_at, now()), version = version + 1 WHERE uuid = :uuid RETURNING *');
        $statement->execute(['uuid' => $uuid]); return $statement->fetch();
    }

    public function purge(string $uuid): array
    {
        $statement = $this->db->prepare('UPDATE attachments SET archived_at = COALESCE(archived_at, now()), purged_at = COALESCE(purged_at, now()),
            version = version + 1 WHERE uuid = :uuid RETURNING *');
        $statement->execute(['uuid' => $uuid]); return $statement->fetch();
    }

    public static function dto(array $row): array
    {
        return ['id' => $row['uuid'], 'unitId' => (int) $row['unit_id'], 'ownerType' => $row['owner_type'], 'ownerId' => (int) $row['owner_id'],
            'kind' => $row['kind'], 'mime' => $row['mime'], 'size' => (int) $row['size'], 'sha256' => $row['sha256'],
            'hasThumbnail' => $row['purged_at'] === null && $row['thumbnail_mime'] !== null, 'page' => (int) $row['page'], 'caption' => $row['caption'], 'originalDate' => $row['original_date'],
            'uploadedBy' => (int) $row['uploaded_by'], 'uploadedAt' => $row['uploaded_at'], 'archivedAt' => $row['archived_at'], 'purgedAt' => $row['purged_at'], 'version' => (int) $row['version']];
    }
}
