<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\BulkStockRepository;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

final class BulkStockController extends Controller
{
    public function register(Router $router): void
    {
        $router->add('GET', '/v1/funds/{unitId}/bulk-stocks', $this->list(...));
        $router->add('POST', '/v1/funds/{unitId}/bulk-stocks', $this->create(...));
        $router->add('PATCH', '/v1/bulk-stocks/{id}', $this->update(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->stocks()->list($unit, $limit, $offset));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        InventoryInput::only($request->json(), ['partTypeId', 'variant', 'quantityTotal', 'note']);
        $input = Input::fromRequest($request);
        $typeId = $input->id('partTypeId');
        $values = ['partTypeId' => $typeId, 'variant' => $input->optionalString('variant', 100),
            'quantityTotal' => InventoryInput::quantity($request->json(), 'quantityTotal'), 'note' => $input->optionalString('note', 5000)];
        return Response::json($this->audited($context, 'bulk_stock.create', $unit, function () use ($unit, $typeId, $values, $context): array {
            $catalog = new ItemRepository($this->db());
            $type = $catalog->lockPartType($unit, $typeId);
            if ($type === null || $type['numbered'] || $type['archived_at'] !== null
                || !$catalog->regionIsActive($unit, $type['region_id'] === null ? null : (int) $type['region_id'])) {
                throw Input::invalid('partTypeId', 'invalid');
            }
            $id = $this->stocks()->insert($unit, $values, self::actor($context));
            return $this->stocks()->find($id);
        }, 'duplicate_stock'), 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->stocks()->find(self::routeId($context)) ?? throw self::notFound();
        $unit = $this->fund($context, (string) $initial['unitId'], true);
        InventoryInput::only($request->json(), ['variant', 'quantityTotal', 'note']);
        $input = Input::fromRequest($request);
        return Response::json($this->audited($context, 'bulk_stock.update', $unit, function () use ($initial, $input, $request): array {
            $current = $this->stocks()->find($initial['id'], true) ?? throw self::notFound();
            $values = ['variant' => $input->has('variant') ? $input->optionalString('variant', 100) : $current['variant'],
                'quantityTotal' => $input->has('quantityTotal') ? InventoryInput::quantity($request->json(), 'quantityTotal') : $current['quantityTotal'],
                'note' => $input->has('note') ? $input->optionalString('note', 5000) : $current['note']];
            if ($values['quantityTotal'] < $current['quantityInKits']) {
                throw new HttpException(422, 'insufficient_stock', 'Total quantity is below the recorded kit allocations.');
            }
            $this->stocks()->update($current['id'], $values);
            return $this->stocks()->find($current['id']);
        }, 'duplicate_stock'));
    }

    private function stocks(): BulkStockRepository
    {
        return new BulkStockRepository($this->db());
    }

    private function fund(RequestContext $context, string $unit, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write);
    }
}
