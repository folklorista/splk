<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\BulkStockRepository;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Domain\Costumes\KitRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Audit\AuditLog;

final class KitController extends Controller
{
    private const STATES = ['unverified', 'complete', 'incomplete', 'pending_check'];
    private const FIELDS = ['seriesId', 'number', 'description', 'note', 'compositionState'];

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/funds/{unitId}/kits', $this->list(...));
        $router->add('POST', '/v1/funds/{unitId}/kits', $this->create(...));
        $router->add('GET', '/v1/kits/{id}', $this->detail(...));
        $router->add('PATCH', '/v1/kits/{id}', $this->update(...));
        $router->add('POST', '/v1/kits/{id}/composition', $this->composition(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset', 'series', 'q']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        $series = isset($request->query['series']) ? InventoryInput::queryInteger($request->query['series'], 'series') : null;
        $query = (new Input($request->query))->optionalString('q', 200);
        return Response::json($this->kits()->list($unit, $limit, $offset, $series, $query));
    }

    private function detail(Request $request, RequestContext $context): Response
    {
        $kit = $this->accessible($context, false);
        return Response::json($this->kits()->detail($kit['id']));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        InventoryInput::only($request->json(), self::FIELDS);
        $values = $this->values(Input::fromRequest($request));
        return Response::json($this->audited($context, 'kit.create', $unit, function () use ($unit, $values, $context): array {
            $this->validateSeries($unit, $values, null);
            return $this->kits()->detail($this->kits()->insert($unit, $values, self::actor($context)));
        }, 'number_already_used'), 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        InventoryInput::only($request->json(), [...self::FIELDS, 'version']);
        $input = Input::fromRequest($request);
        $version = $input->id('version');
        return Response::json($this->audited($context, 'kit.update', $initial['unitId'], function () use ($initial, $input, $version): array {
            $current = $this->kits()->find($initial['id'], true) ?? throw self::notFound();
            $this->editable($current, $version);
            $values = $this->values($input, $current);
            if ($values['seriesId'] !== $current['seriesId'] || $values['number'] !== $current['number']) {
                $this->validateSeries($current['unitId'], $values, $current['id']);
            }
            $this->kits()->update($current['id'], $values);
            return $this->kits()->detail($current['id']);
        }, 'number_already_used'));
    }

    private function composition(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $input = Input::fromRequest($request);
        $action = $input->enum('action', ['add', 'remove', 'move']);
        $version = $input->id('version');
        $itemId = $input->nullableId('itemId');
        $stockId = $input->nullableId('bulkStockId');
        if (($itemId === null) === ($stockId === null)) {
            throw Input::invalid('itemId', 'invalid');
        }
        $allowed = ['action', 'version', 'note', $itemId === null ? 'bulkStockId' : 'itemId'];
        if ($itemId !== null) {
            $allowed[] = 'itemVersion';
            $input->id('itemVersion');
        } elseif ($action !== 'remove' || $input->has('requiredQty') || $input->has('presentQty')) {
            $allowed = [...$allowed, 'requiredQty', 'presentQty'];
            $required = InventoryInput::quantity($request->json(), 'requiredQty', 1);
            $present = InventoryInput::quantity($request->json(), 'presentQty');
            if ($present > $required) {
                throw Input::invalid('presentQty', 'invalid');
            }
        }
        $targetId = null;
        if ($action === 'move') {
            $allowed = [...$allowed, 'targetKitId', 'targetVersion'];
            $targetId = $input->id('targetKitId');
            $input->id('targetVersion');
            if ($targetId === $initial['id']) {
                throw Input::invalid('targetKitId', 'invalid');
            }
            $target = $this->kits()->find($targetId) ?? throw self::notFound();
            if ($target['unitId'] !== $initial['unitId']) {
                throw self::notFound();
            }
        }
        InventoryInput::only($request->json(), $allowed);
        return Response::json($this->audited($context, 'kit.composition', $initial['unitId'], function () use ($initial, $input, $version, $targetId, $action, $itemId, $stockId, $request, $context): array {
            // Lock kits in ID order so opposite moves cannot deadlock each other.
            $ids = array_filter([$initial['id'], $targetId]);
            sort($ids);
            $locked = [];
            foreach ($ids as $id) {
                $locked[$id] = $this->kits()->find($id, true) ?? throw self::notFound();
            }
            $this->editable($locked[$initial['id']], $version);
            if ($targetId !== null) {
                $this->editable($locked[$targetId], $input->id('targetVersion'));
            }
            if ($itemId !== null) {
                $qty = $this->changeItem($initial, $itemId, $targetId, $action, $input, $context);
            } else {
                $qty = $this->changeBulk($initial, $stockId, $targetId, $action, $request->json());
            }
            $note = $input->optionalString('note', 2000);
            $change = match ($action) { 'add' => 'added', 'remove' => 'removed', 'move' => 'moved' };
            $this->kits()->record($initial['unitId'], $initial['id'], $itemId, $stockId, $change, $qty, self::actor($context), $note);
            $this->kits()->touchComposition($initial['id']);
            if ($targetId !== null) {
                $this->kits()->record($initial['unitId'], $targetId, $itemId, $stockId, 'moved', $qty, self::actor($context), $note);
                $this->kits()->touchComposition($targetId);
                (new AuditLog($this->db()))->record(self::actor($context), 'kit.composition', 'kit', $targetId, $initial['unitId'], ['fromKitId' => $initial['id'], 'itemId' => $itemId, 'bulkStockId' => $stockId, 'qty' => $qty]);
            }
            return $this->kits()->detail($initial['id']);
        }));
    }

    private function changeItem(array $kit, int $itemId, ?int $targetId, string $action, Input $input, RequestContext $context): int
    {
        $items = new ItemRepository($this->db());
        $item = $items->find($itemId, true) ?? throw self::notFound();
        if ($item['unitId'] !== $kit['unitId']) {
            throw self::notFound();
        }
        InventoryInput::version($item, $input->id('itemVersion'));
        if ($item['retiredAt'] !== null && $action !== 'remove') {
            throw new HttpException(422, 'item_retired', 'A retired item cannot be added to a kit.');
        }
        if (($action === 'add' && $item['kitId'] !== null) || ($action !== 'add' && $item['kitId'] !== $kit['id'])) {
            throw new HttpException(422, 'composition_conflict', 'The item belongs to a different composition.');
        }
        $nextKit = $action === 'add' ? $kit['id'] : $targetId;
        $this->kits()->itemMembership($itemId, $nextKit);
        $items->record($itemId, self::actor($context), 'kit_changed', ['from' => $item['kitId'], 'to' => $nextKit]);
        return 1;
    }

    private function changeBulk(array $kit, int $stockId, ?int $targetId, string $action, array $data): int
    {
        $stock = (new BulkStockRepository($this->db()))->find($stockId, true) ?? throw self::notFound();
        if ($stock['unitId'] !== $kit['unitId']) {
            throw self::notFound();
        }
        $line = $this->kits()->bulkLine($kit['id'], $stockId);
        if ($action !== 'add' && $line === null) {
            throw new HttpException(422, 'composition_conflict', 'The stock is not in this kit.');
        }
        $required = $data['requiredQty'] ?? $line['requiredQty'] ?? 0;
        $present = $data['presentQty'] ?? $line['presentQty'] ?? 0;
        if ($action === 'remove') {
            if ($required > $line['requiredQty'] || $present > $line['presentQty'] || $line['presentQty'] - $present > $line['requiredQty'] - $required) {
                throw Input::invalid('requiredQty', 'invalid');
            }
            $this->setBulkLine($kit['unitId'], $kit['id'], $stockId, $line['requiredQty'] - $required, $line['presentQty'] - $present);
            return $required;
        }
        if ($action === 'add') {
            if ($stock['quantityInKits'] + $present > $stock['quantityTotal']) {
                throw new HttpException(422, 'insufficient_stock', 'Not enough unallocated stock.');
            }
            $this->setBulkLine($kit['unitId'], $kit['id'], $stockId, ($line['requiredQty'] ?? 0) + $required, ($line['presentQty'] ?? 0) + $present);
        } else {
            if ($required > $line['requiredQty'] || $present > $line['presentQty'] || $line['presentQty'] - $present > $line['requiredQty'] - $required) {
                throw Input::invalid('requiredQty', 'invalid');
            }
            $target = $this->kits()->bulkLine($targetId, $stockId);
            // Release source allocations before assigning target allocations in the same transaction.
            $this->setBulkLine($kit['unitId'], $kit['id'], $stockId, $line['requiredQty'] - $required, $line['presentQty'] - $present);
            $this->setBulkLine($kit['unitId'], $targetId, $stockId, ($target['requiredQty'] ?? 0) + $required, ($target['presentQty'] ?? 0) + $present);
        }
        return $required;
    }

    private function setBulkLine(int $unit, int $kit, int $stock, int $required, int $present): void
    {
        InventoryInput::quantity(['requiredQty' => $required], 'requiredQty');
        InventoryInput::quantity(['presentQty' => $present], 'presentQty');
        if ($present > $required) {
            throw Input::invalid('presentQty', 'invalid');
        }
        $this->kits()->setBulkLine($unit, $kit, $stock, $required, $present);
    }

    private function validateSeries(int $unit, array $values, ?int $except): void
    {
        $items = new ItemRepository($this->db());
        $series = $items->lockSeries($unit, $values['seriesId']);
        if ($series === null || $series['kind'] !== 'kit' || $series['archived_at'] !== null
            || !$items->regionIsActive($unit, $series['region_id'] === null ? null : (int) $series['region_id'])) {
            throw Input::invalid('seriesId', 'invalid');
        }
        if ($values['number'] !== null && $this->kits()->numberExists($values['seriesId'], $values['number'], !$series['allow_number_reuse'], $except)) {
            throw new HttpException(422, 'number_already_used', 'The kit number is already used.');
        }
    }

    private function values(Input $input, ?array $current = null): array
    {
        $values = ['seriesId' => $input->has('seriesId') || $current === null ? $input->id('seriesId') : $current['seriesId']];
        foreach (['number' => 100, 'description' => 2000, 'note' => 5000] as $key => $max) {
            $values[$key] = $input->has($key) ? $input->optionalString($key, $max) : ($current[$key] ?? null);
        }
        $values['compositionState'] = $input->has('compositionState') ? $input->enum('compositionState', self::STATES) : ($current['compositionState'] ?? 'unverified');
        return $values;
    }

    private function editable(array $kit, int $version): void
    {
        InventoryInput::version($kit, $version);
        if ($kit['retiredAt'] !== null) {
            throw new HttpException(422, 'composition_conflict', 'A retired kit cannot be changed.');
        }
    }

    private function accessible(RequestContext $context, bool $write): array
    {
        $kit = $this->kits()->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $kit['unitId'], $write);
        return $kit;
    }

    private function fund(RequestContext $context, string $unit, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write);
    }

    private function kits(): KitRepository
    {
        return new KitRepository($this->db());
    }
}
