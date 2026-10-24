<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Identity;

use PDO;

/** Shared basic identity/contact, with costume profiles strictly scoped by fund (D-21, D-60). */
final class PeopleRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $contactVisible, bool $lock = false): ?array
    {
        $statement = $this->db->prepare('SELECT id, first_name, last_name, nickname, contact, default_costume FROM persons WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : $this->person($row, $contactVisible) + ['defaultCostume' => $row['default_costume']];
    }

    public function list(array $filters, bool $contactVisible, ?int $fund, int $limit, int $offset): array
    {
        $where = []; $params = [];
        if (isset($filters['q'])) {
            $where[] = "unaccent(lower(concat_ws(' ', p.first_name, p.last_name, p.nickname))) LIKE unaccent(lower(:q)) ESCAPE '!'";
            $params['q'] = '%' . strtr($filters['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
        }
        if (isset($filters['unit'])) {
            $where[] = 'EXISTS (SELECT 1 FROM unit_affiliations a WHERE a.person_id = p.id AND a.unit_id = :unit AND a.valid_from <= current_date AND (a.valid_to IS NULL OR a.valid_to >= current_date))';
            $params['unit'] = $filters['unit'];
        }
        if (isset($filters['paperState'])) {
            $where[] = 'EXISTS (SELECT 1 FROM costume_holder_profiles h WHERE h.person_id = p.id AND h.unit_id = :fund AND h.paper_state = :state)';
            $params['fund'] = $fund; $params['state'] = $filters['paperState'];
        }
        $from = ' FROM persons p' . ($where === [] ? '' : ' WHERE ' . implode(' AND ', $where));
        $count = $this->db->prepare('SELECT count(*)' . $from); $count->execute($params);
        $statement = $this->db->prepare('SELECT p.id, p.first_name, p.last_name, p.nickname, p.contact' . $from . " ORDER BY p.last_name, p.first_name, p.id LIMIT $limit OFFSET $offset");
        $statement->execute($params);
        return ['items' => array_map(fn (array $row): array => $this->person($row, $contactVisible) + ['profile' => $fund === null ? null : $this->profile($fund, (int) $row['id'])], $statement->fetchAll()),
            'total' => (int) $count->fetchColumn()];
    }

    public function duplicates(string $first, string $last): array
    {
        // Concurrent submissions of the same name must observe the first committed person before creating another.
        $lock = $this->db->prepare("SELECT pg_advisory_xact_lock(hashtextextended(unaccent(lower(:name)), 0))");
        $lock->execute(['name' => $first . ' ' . $last]);
        $statement = $this->db->prepare('SELECT id, first_name, last_name, nickname, contact FROM persons
            WHERE unaccent(lower(first_name)) = unaccent(lower(:first)) AND unaccent(lower(last_name)) = unaccent(lower(:last)) ORDER BY id');
        $statement->execute(['first' => $first, 'last' => $last]);
        return array_map(fn (array $row): array => $this->person($row, true), $statement->fetchAll());
    }

    public function insert(array $input, int $actor): int
    {
        $statement = $this->db->prepare('INSERT INTO persons (first_name, last_name, nickname, contact, default_costume, created_by)
            VALUES (:firstName, :lastName, :nickname, :contact, :defaultCostume, :actor) RETURNING id');
        $statement->execute($input + ['actor' => $actor]);
        return (int) $statement->fetchColumn();
    }

    public function update(int $id, array $input): void
    {
        $this->db->prepare('UPDATE persons SET first_name = :firstName, last_name = :lastName, nickname = :nickname, contact = :contact,
            default_costume = :defaultCostume WHERE id = :id')->execute($input + ['id' => $id]);
    }

    public function profile(int $unit, int $person): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM costume_holder_profiles WHERE unit_id = :unit AND person_id = :person');
        $statement->execute(['unit' => $unit, 'person' => $person]);
        $row = $statement->fetch();
        return $row === false ? null : ['id' => (int) $row['id'], 'unitId' => (int) $row['unit_id'], 'personId' => (int) $row['person_id'],
            'paperState' => $row['paper_state'], 'paperCheckedAt' => $row['paper_checked_at'], 'migratedAt' => $row['migrated_at'],
            'migratedBy' => $row['migrated_by'] === null ? null : (int) $row['migrated_by'], 'note' => $row['note']];
    }

    public function saveProfile(int $unit, int $person, string $state, ?string $note, int $actor): array
    {
        $this->db->prepare("INSERT INTO costume_holder_profiles (unit_id, person_id, paper_state, note, created_by, migrated_at, migrated_by)
            VALUES (:unit, :person, :state, :note, :actor, CASE WHEN :digital THEN now() ELSE NULL END, :migratedBy)
            ON CONFLICT (unit_id, person_id) DO UPDATE SET paper_state = EXCLUDED.paper_state, note = EXCLUDED.note,
                migrated_at = CASE WHEN EXCLUDED.paper_state = 'digital' THEN coalesce(costume_holder_profiles.migrated_at, EXCLUDED.migrated_at) ELSE costume_holder_profiles.migrated_at END,
                migrated_by = CASE WHEN EXCLUDED.paper_state = 'digital' THEN coalesce(costume_holder_profiles.migrated_by, EXCLUDED.migrated_by) ELSE costume_holder_profiles.migrated_by END")
            ->execute(['unit' => $unit, 'person' => $person, 'state' => $state, 'note' => $note, 'actor' => $actor,
                'digital' => $state === 'digital' ? 'true' : 'false', 'migratedBy' => $state === 'digital' ? $actor : null]);
        return $this->profile($unit, $person);
    }

    private function person(array $row, bool $contactVisible): array
    {
        $statement = $this->db->prepare('SELECT a.unit_id, u.name, a.status, a.valid_from, a.valid_to FROM unit_affiliations a JOIN units u ON u.id = a.unit_id
            WHERE a.person_id = :person ORDER BY a.valid_from DESC, a.id DESC');
        $statement->execute(['person' => $row['id']]);
        return ['id' => (int) $row['id'], 'firstName' => $row['first_name'], 'lastName' => $row['last_name'], 'nickname' => $row['nickname'],
            'contact' => $contactVisible ? $row['contact'] : null, 'contactVisible' => $contactVisible,
            'affiliations' => array_map(static fn (array $a): array => ['unitId' => (int) $a['unit_id'], 'unitName' => $a['name'],
                'status' => $a['status'], 'validFrom' => $a['valid_from'], 'validTo' => $a['valid_to']], $statement->fetchAll())];
    }
}
