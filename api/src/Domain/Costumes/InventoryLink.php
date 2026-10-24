<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;

/** Optional context for ordinary handover/work operations, never a second implementation of movements. */
final class InventoryLink
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function lock(int $unit, array $body): ?int
    {
        if (!array_key_exists('inventoryId', $body) && !array_key_exists('inventoryVersion', $body)) return null;
        $input = new Input($body); $id = $input->id('inventoryId'); $version = $input->id('inventoryVersion');
        $inventory = (new InventoryRepository($this->db))->find($id, true);
        if ($inventory === null || $inventory['unitId'] !== $unit) throw new HttpException(404, 'not_found', 'Not found.');
        if ($inventory['status'] !== 'open') throw new HttpException(409, 'inventory_closed', 'The inventory is closed.');
        InventoryInput::version($inventory, $version);
        return $id;
    }

    public function touch(?int $id): void
    {
        if ($id !== null) (new InventoryRepository($this->db))->touch($id);
    }
}
