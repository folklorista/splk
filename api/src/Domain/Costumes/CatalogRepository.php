<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Regions, part types and series of one costume fund (api-v1-a-schema chap. 3.2). All queries are scoped by unit. */
final class CatalogRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function regions(int $unitId): array
    {
        return array_map(self::region(...), $this->all(
            'SELECT id, name, parent_id, archived_at FROM costume_regions WHERE unit_id = :unit ORDER BY parent_id NULLS FIRST, name',
            $unitId,
        ));
    }

    public function findRegion(int $unitId, int $id): ?array
    {
        $row = $this->one('SELECT id, name, parent_id, archived_at FROM costume_regions WHERE unit_id = :unit AND id = :id', $unitId, $id);

        return $row === null ? null : self::region($row);
    }

    public function hasChildRegions(int $id): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM costume_regions WHERE parent_id = :id AND archived_at IS NULL');
        $statement->execute(['id' => $id]);

        return $statement->fetchColumn() !== false;
    }

    public function insertRegion(int $unitId, string $name, ?int $parentId, int $actor): int
    {
        return $this->insert(
            'INSERT INTO costume_regions (unit_id, name, parent_id, created_by) VALUES (:unit, :name, :parent, :actor) RETURNING id',
            ['unit' => $unitId, 'name' => $name, 'parent' => $parentId, 'actor' => $actor],
        );
    }

    /** @param array<string, mixed> $region current state with changes applied */
    public function updateRegion(int $id, array $region): void
    {
        $this->db->prepare(
            'UPDATE costume_regions SET name = :name, parent_id = :parent,
                    archived_at = CASE WHEN :archived THEN coalesce(archived_at, now()) ELSE NULL END
              WHERE id = :id'
        )->execute(['id' => $id, 'name' => $region['name'], 'parent' => $region['parentId'], 'archived' => $region['archived'] ? 'true' : 'false']);
    }

    /** @return list<array<string, mixed>> */
    public function partTypes(int $unitId): array
    {
        return array_map(self::partType(...), $this->all(
            'SELECT id, name, gender, region_id, numbered, archived_at FROM costume_part_types WHERE unit_id = :unit ORDER BY name, id',
            $unitId,
        ));
    }

    public function findPartType(int $unitId, int $id): ?array
    {
        $row = $this->one('SELECT id, name, gender, region_id, numbered, archived_at FROM costume_part_types WHERE unit_id = :unit AND id = :id', $unitId, $id);

        return $row === null ? null : self::partType($row);
    }

    /** @param array<string, mixed> $type */
    public function insertPartType(int $unitId, array $type, int $actor): int
    {
        return $this->insert(
            'INSERT INTO costume_part_types (unit_id, name, gender, region_id, numbered, created_by)
             VALUES (:unit, :name, :gender, :region, :numbered, :actor) RETURNING id',
            ['unit' => $unitId, 'name' => $type['name'], 'gender' => $type['gender'], 'region' => $type['regionId'],
                'numbered' => $type['numbered'] ? 'true' : 'false', 'actor' => $actor],
        );
    }

    /** @param array<string, mixed> $type */
    public function updatePartType(int $id, array $type): void
    {
        $this->db->prepare(
            'UPDATE costume_part_types SET name = :name, gender = :gender, region_id = :region, numbered = :numbered,
                    archived_at = CASE WHEN :archived THEN coalesce(archived_at, now()) ELSE NULL END
              WHERE id = :id'
        )->execute(['id' => $id, 'name' => $type['name'], 'gender' => $type['gender'], 'region' => $type['regionId'],
            'numbered' => $type['numbered'] ? 'true' : 'false', 'archived' => $type['archived'] ? 'true' : 'false']);
    }

    /** @return list<array<string, mixed>> */
    public function series(int $unitId): array
    {
        return array_map(self::oneSeries(...), $this->all(
            'SELECT id, kind, name, part_type_id, region_id, gender, variant, allow_number_reuse, archived_at
               FROM costume_series WHERE unit_id = :unit ORDER BY kind DESC, name, variant NULLS FIRST, id',
            $unitId,
        ));
    }

    public function findSeries(int $unitId, int $id): ?array
    {
        $row = $this->one(
            'SELECT id, kind, name, part_type_id, region_id, gender, variant, allow_number_reuse, archived_at
               FROM costume_series WHERE unit_id = :unit AND id = :id',
            $unitId,
            $id,
        );

        return $row === null ? null : self::oneSeries($row);
    }

    /** @param array<string, mixed> $series */
    public function insertSeries(int $unitId, array $series, int $actor): int
    {
        return $this->insert(
            'INSERT INTO costume_series (unit_id, kind, name, part_type_id, region_id, gender, variant, allow_number_reuse, created_by)
             VALUES (:unit, :kind, :name, :type, :region, :gender, :variant, :reuse, :actor) RETURNING id',
            ['unit' => $unitId, 'kind' => $series['kind'], 'name' => $series['name'], 'type' => $series['partTypeId'],
                'region' => $series['regionId'], 'gender' => $series['gender'], 'variant' => $series['variant'],
                'reuse' => $series['allowNumberReuse'] ? 'true' : 'false', 'actor' => $actor],
        );
    }

    /** @param array<string, mixed> $series */
    public function updateSeries(int $id, array $series): void
    {
        $this->db->prepare(
            'UPDATE costume_series SET name = :name, region_id = :region, gender = :gender, variant = :variant,
                    allow_number_reuse = :reuse,
                    archived_at = CASE WHEN :archived THEN coalesce(archived_at, now()) ELSE NULL END
              WHERE id = :id'
        )->execute(['id' => $id, 'name' => $series['name'], 'region' => $series['regionId'], 'gender' => $series['gender'],
            'variant' => $series['variant'], 'reuse' => $series['allowNumberReuse'] ? 'true' : 'false',
            'archived' => $series['archived'] ? 'true' : 'false']);
    }

    /** @return list<array<string, mixed>> */
    private function all(string $sql, int $unitId): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute(['unit' => $unitId]);

        return $statement->fetchAll();
    }

    private function one(string $sql, int $unitId, int $id): ?array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute(['unit' => $unitId, 'id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $row;
    }

    /** @param array<string, mixed> $params */
    private function insert(string $sql, array $params): int
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);

        return (int) $statement->fetchColumn();
    }

    private static function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }

    private static function region(array $row): array
    {
        return ['id' => (int) $row['id'], 'name' => $row['name'], 'parentId' => self::nullableInt($row['parent_id']), 'archived' => $row['archived_at'] !== null];
    }

    private static function partType(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'gender' => $row['gender'],
            'regionId' => self::nullableInt($row['region_id']),
            'numbered' => (bool) $row['numbered'],
            'archived' => $row['archived_at'] !== null,
        ];
    }

    private static function oneSeries(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'kind' => $row['kind'],
            'name' => $row['name'],
            'partTypeId' => self::nullableInt($row['part_type_id']),
            'regionId' => self::nullableInt($row['region_id']),
            'gender' => $row['gender'],
            'variant' => $row['variant'],
            'allowNumberReuse' => (bool) $row['allow_number_reuse'],
            'archived' => $row['archived_at'] !== null,
        ];
    }
}
