<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Identity;

use PDO;

/** Organization-owned groups are selection metadata, never a costume authorization scope. */
final class GroupRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $query = $this->db->prepare('SELECT * FROM groups WHERE id = :id' . ($lock ? ' FOR UPDATE' : '')); $query->execute(['id' => $id]); $row = $query->fetch();
        if ($row === false) return null;
        $members = $this->db->prepare('SELECT *, revoked_at IS NULL AND valid_from <= current_date AND (valid_to IS NULL OR valid_to >= current_date) AS active FROM group_memberships WHERE group_id = :id ORDER BY id');
        $members->execute(['id' => $id]);
        return ['id' => (int) $row['id'], 'unitId' => $row['unit_id'] === null ? null : (int) $row['unit_id'], 'name' => $row['name'], 'archived' => $row['archived_at'] !== null,
            'memberships' => array_map(static fn (array $m): array => ['id' => (int) $m['id'], 'personId' => (int) $m['person_id'], 'validFrom' => $m['valid_from'],
                'validTo' => $m['valid_to'], 'revokedAt' => $m['revoked_at'], 'revokedBy' => $m['revoked_by'] === null ? null : (int) $m['revoked_by'], 'active' => (bool) $m['active']], $members->fetchAll())];
    }

    public function list(): array
    {
        return array_map(fn ($id): array => $this->find((int) $id), $this->db->query('SELECT id FROM groups ORDER BY archived_at NULLS FIRST, name, id')->fetchAll(PDO::FETCH_COLUMN));
    }

    public function options(): array
    {
        return array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'unitId' => $r['unit_id'] === null ? null : (int) $r['unit_id'], 'name' => $r['name']],
            $this->db->query('SELECT id, unit_id, name FROM groups WHERE archived_at IS NULL ORDER BY name, id')->fetchAll());
    }

    public function insert(array $values, int $actor): int
    {
        $query = $this->db->prepare('INSERT INTO groups (unit_id, name, created_by) VALUES (:unit, :name, :actor) RETURNING id');
        $query->execute(['unit' => $values['unitId'], 'name' => $values['name'], 'actor' => $actor]); return (int) $query->fetchColumn();
    }

    public function update(int $id, array $values): void
    {
        $this->db->prepare('UPDATE groups SET unit_id = :unit, name = :name, archived_at = CASE WHEN CAST(:archived AS boolean) THEN coalesce(archived_at, clock_timestamp()) END WHERE id = :id')
            ->execute(['id' => $id, 'unit' => $values['unitId'], 'name' => $values['name'], 'archived' => $values['archived'] ? 'true' : 'false']);
    }

    public function addMember(int $group, int $person, string $from, ?string $to, int $actor): void
    {
        $query = $this->db->prepare("SELECT 1 FROM group_memberships WHERE group_id = :group AND person_id = :person AND revoked_at IS NULL
            AND daterange(valid_from, valid_to, '[]') && daterange(CAST(:from AS date), CAST(:to AS date), '[]')");
        $query->execute(['group' => $group, 'person' => $person, 'from' => $from, 'to' => $to]);
        if ($query->fetchColumn() !== false) throw new \Splk\Api\Http\HttpException(422, 'group_membership_exists', 'Overlapping membership already exists.');
        $this->db->prepare('INSERT INTO group_memberships (group_id, person_id, valid_from, valid_to, created_by) VALUES (:group, :person, :from, :to, :actor)')
            ->execute(['group' => $group, 'person' => $person, 'from' => $from, 'to' => $to, 'actor' => $actor]);
    }

    public function revoke(int $group, int $membership, int $actor): bool
    {
        $query = $this->db->prepare('UPDATE group_memberships SET revoked_at = coalesce(revoked_at, clock_timestamp()), revoked_by = coalesce(revoked_by, :actor) WHERE group_id = :group AND id = :id');
        $query->execute(['group' => $group, 'id' => $membership, 'actor' => $actor]); return $query->rowCount() === 1;
    }
}
