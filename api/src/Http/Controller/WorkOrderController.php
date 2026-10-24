<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Domain\Costumes\InventoryLink;
use Splk\Api\Domain\Costumes\WorkOrderRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

/** Work orders are independent of condition, issuability and physical location (docs/06 chap. 5.5). */
final class WorkOrderController extends Controller
{
    private const TYPES = ['adjustment', 'repair', 'resewing'];
    private const STATES = ['open', 'in_progress', 'done', 'cancelled'];
    private const FIELDS = ['type', 'description', 'assignee', 'dueOn'];

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/items/{id}/work-orders', $this->list(...));
        $router->add('POST', '/v1/items/{id}/work-orders', $this->create(...));
        $router->add('PATCH', '/v1/work-orders/{id}', $this->update(...));
        $router->add('GET', '/v1/funds/{unitId}/work-orders', $this->list(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $item = isset($context->params['unitId']) ? null : $this->item($context, false);
        $unit = $item === null ? $this->fund($context, $context->params['unitId'], false) : $item['unitId'];
        InventoryInput::only($request->query, ['limit', 'offset', 'status']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        $status = array_key_exists('status', $request->query) ? (new Input($request->query))->enum('status', self::STATES) : null;
        return Response::json($this->orders()->list($unit, $item['id'] ?? null, $status, $limit, $offset));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $initial = $this->item($context, true);
        InventoryInput::only($request->json(), [...self::FIELDS, 'inventoryId', 'inventoryVersion']);
        $values = $this->values(Input::fromRequest($request));
        $body = $request->json();
        return Response::json($this->audited($context, 'work_order.create', $initial['unitId'], function () use ($initial, $values, $context, $body): array {
            $link = new InventoryLink($this->db()); $inventory = $link->lock($initial['unitId'], $body);
            $items = new ItemRepository($this->db());
            $item = $items->find($initial['id'], true) ?? throw self::notFound();
            if ($item['retiredAt'] !== null) {
                throw new HttpException(422, 'item_retired', 'A retired item cannot receive new work orders.');
            }
            $id = $this->orders()->insert($item['id'], $values, self::actor($context), $inventory);
            $order = $this->orders()->find($id);
            $items->record($item['id'], self::actor($context), 'work_order_created', $order);
            $link->touch($inventory); return $order;
        }), 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->orders()->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $initial['unitId'], true);
        InventoryInput::only($request->json(), [...self::FIELDS, 'status']);
        $input = Input::fromRequest($request);
        return Response::json($this->audited($context, 'work_order.update', $initial['unitId'], function () use ($initial, $input, $context): array {
            $current = $this->orders()->find($initial['id'], true) ?? throw self::notFound();
            $values = $this->values($input, $current);
            $values['status'] = $input->has('status') ? $input->enum('status', self::STATES) : $current['status'];
            $this->orders()->update($current['id'], $values);
            $updated = $this->orders()->find($current['id']);
            if ($current !== $updated) {
                (new ItemRepository($this->db()))->record($current['itemId'], self::actor($context), 'work_order_changed', ['from' => $current, 'to' => $updated]);
            }
            return $updated;
        }));
    }

    private function values(Input $input, ?array $current = null): array
    {
        $values = ['type' => $input->has('type') || $current === null ? $input->enum('type', self::TYPES) : $current['type'],
            'description' => $input->has('description') || $current === null ? $input->text('description', 2000) : $current['description'],
            'assignee' => $input->has('assignee') ? $input->optionalString('assignee', 200) : ($current['assignee'] ?? null),
            'dueOn' => $input->has('dueOn') ? $input->optionalString('dueOn', 10) : ($current['dueOn'] ?? null)];
        if ($values['dueOn'] !== null && (!preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $values['dueOn'], $parts)
            || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) {
            throw Input::invalid('dueOn', 'invalid');
        }
        return $values;
    }

    private function item(RequestContext $context, bool $write): array
    {
        $item = (new ItemRepository($this->db()))->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $item['unitId'], $write);
        return $item;
    }

    private function orders(): WorkOrderRepository
    {
        return new WorkOrderRepository($this->db());
    }

    private function fund(RequestContext $context, string $unit, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write);
    }
}
