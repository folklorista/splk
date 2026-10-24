<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;

/** Appointment writes run with the inventory header locked; a visit never creates physical evidence. */
final class InventoryAppointments
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function slot(array $inventory, ?int $id, array $body): array
    {
        InventoryInput::only($body, ['version', 'startsAt', 'endsAt', 'capacity']);
        $repository = new InventoryRepository($this->db);
        $current = $id === null ? null : self::entry($repository->slots($inventory['id']), $id);
        $start = array_key_exists('startsAt', $body) || $current === null ? self::timestamp($body, 'startsAt') : $current['startsAt'];
        $end = array_key_exists('endsAt', $body) || $current === null ? self::timestamp($body, 'endsAt') : $current['endsAt'];
        $capacity = array_key_exists('capacity', $body) || $current === null ? InventoryInput::quantity($body, 'capacity', 1) : $current['capacity'];
        if (new \DateTimeImmutable($end) <= new \DateTimeImmutable($start)) throw Input::invalid('endsAt', 'invalid');
        if ($id !== null && $this->occupancy($inventory['id'], $id) > $capacity) throw new HttpException(422, 'inventory_slot_full', 'The slot already has more reservations.');
        if ($id === null) {
            $query = $this->db->prepare('INSERT INTO inventory_slots (unit_id, inventory_id, starts_at, ends_at, capacity) VALUES (:unit, :inventory, :start, :end, :capacity) RETURNING id');
            $query->execute(['unit' => $inventory['unitId'], 'inventory' => $inventory['id'], 'start' => $start, 'end' => $end, 'capacity' => $capacity]);
            $id = (int) $query->fetchColumn();
        } else {
            $this->db->prepare('UPDATE inventory_slots SET starts_at = :start, ends_at = :end, capacity = :capacity WHERE id = :id')
                ->execute(['id' => $id, 'start' => $start, 'end' => $end, 'capacity' => $capacity]);
        }
        return self::entry($repository->slots($inventory['id']), $id);
    }

    public function visit(array $inventory, ?int $id, array $body): array
    {
        InventoryInput::only($body, $id === null ? ['version', 'personId', 'slotId', 'status'] : ['version', 'slotId', 'status']);
        $repository = new InventoryRepository($this->db); $input = new Input($body);
        $current = $id === null ? null : self::entry($repository->visits($inventory['id']), $id);
        if ($current !== null && in_array($current['status'], ['completed', 'cancelled'], true)) throw new HttpException(409, 'inventory_visit_closed', 'Start another visit to preserve the completed history.');
        $person = $current === null ? $input->id('personId') : $current['personId'];
        if (!array_any($repository->targets($inventory['id']), static fn (array $t): bool => $t['holderPersonId'] === $person)) throw Input::invalid('personId', 'invalid');
        $slot = $input->has('slotId') ? $input->nullableId('slotId') : ($current['slotId'] ?? null);
        $status = $input->has('status') ? $input->enum('status', ['booked', 'in_progress', 'completed', 'cancelled']) : ($current['status'] ?? 'booked');
        if ($slot !== null) {
            $appointment = self::entry($repository->slots($inventory['id']), $slot);
            if ($status !== 'cancelled' && $this->occupancy($inventory['id'], $slot, $id) >= $appointment['capacity']) throw new HttpException(422, 'inventory_slot_full', 'The slot is full.');
        }
        if ($id === null) {
            $query = $this->db->prepare("INSERT INTO inventory_visits (unit_id, inventory_id, person_id, slot_id, status, completed_at)
                VALUES (:unit, :inventory, :person, :slot, :status, CASE WHEN CAST(:state AS text) = 'completed' THEN clock_timestamp() END) RETURNING id");
            $query->execute(['unit' => $inventory['unitId'], 'inventory' => $inventory['id'], 'person' => $person, 'slot' => $slot, 'status' => $status, 'state' => $status]);
            $id = (int) $query->fetchColumn();
        } else {
            $this->db->prepare("UPDATE inventory_visits SET slot_id = :slot, status = :status, completed_at = CASE WHEN CAST(:state AS text) = 'completed' THEN clock_timestamp() END WHERE id = :id")
                ->execute(['id' => $id, 'slot' => $slot, 'status' => $status, 'state' => $status]);
        }
        return self::entry($repository->visits($inventory['id']), $id);
    }

    private function occupancy(int $inventory, int $slot, ?int $except = null): int
    {
        $query = $this->db->prepare("SELECT count(*) FROM inventory_visits WHERE inventory_id = :inventory AND slot_id = :slot AND status <> 'cancelled'" . ($except === null ? '' : ' AND id <> :except'));
        $query->execute(['inventory' => $inventory, 'slot' => $slot] + ($except === null ? [] : ['except' => $except]));
        return (int) $query->fetchColumn();
    }

    private static function entry(array $rows, int $id): array
    {
        foreach ($rows as $row) if ($row['id'] === $id) return $row;
        throw new HttpException(404, 'not_found', 'Not found.');
    }

    private static function timestamp(array $values, string $field): string
    {
        $value = $values[$field] ?? null;
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) throw Input::invalid($field, 'invalid');
        try {
            $date = new \DateTimeImmutable($value); $errors = \DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) throw Input::invalid($field, 'invalid');
            return $date->format('Y-m-d\TH:i:s.uP');
        } catch (\DateMalformedStringException) { throw Input::invalid($field, 'invalid'); }
    }
}
