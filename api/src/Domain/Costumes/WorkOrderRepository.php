<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

final class WorkOrderRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function find(int $id, bool $lock = false): ?array
    {
        $statement = $this->db->prepare('SELECT w.*, i.unit_id FROM costume_work_orders w JOIN costume_items i ON i.id = w.item_id WHERE w.id = :id'
            . ($lock ? ' FOR UPDATE OF w' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : self::order($row);
    }

    public function list(int $unitId, ?int $itemId, ?string $status, int $limit, int $offset): array
    {
        $where = 'i.unit_id = :unit';
        $params = ['unit' => $unitId];
        if ($itemId !== null) {
            $where .= ' AND w.item_id = :item';
            $params['item'] = $itemId;
        }
        if ($status !== null) {
            $where .= ' AND w.status = :status';
            $params['status'] = $status;
        }
        $from = " FROM costume_work_orders w JOIN costume_items i ON i.id = w.item_id WHERE $where";
        $count = $this->db->prepare('SELECT count(*)' . $from);
        $count->execute($params);
        $list = $this->db->prepare('SELECT w.*, i.unit_id' . $from . " ORDER BY w.created_at DESC, w.id DESC LIMIT $limit OFFSET $offset");
        $list->execute($params);
        return ['items' => array_map(self::order(...), $list->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    public function insert(int $itemId, array $values, int $actor): int
    {
        $statement = $this->db->prepare('INSERT INTO costume_work_orders (item_id, type, description, assignee, due_on, created_by)
            VALUES (:item, :type, :description, :assignee, :dueOn, :actor) RETURNING id');
        $statement->execute(['item' => $itemId, 'actor' => $actor] + $values);
        return (int) $statement->fetchColumn();
    }

    public function update(int $id, array $values): void
    {
        $this->db->prepare('UPDATE costume_work_orders SET type = :type, description = :description, assignee = :assignee, due_on = :dueOn, status = :status WHERE id = :id')
            ->execute(['id' => $id] + $values);
    }

    private static function order(array $row): array
    {
        return ['id' => (int) $row['id'], 'itemId' => (int) $row['item_id'], 'unitId' => (int) $row['unit_id'], 'type' => $row['type'],
            'description' => $row['description'], 'assignee' => $row['assignee'], 'dueOn' => $row['due_on'], 'status' => $row['status']];
    }
}
