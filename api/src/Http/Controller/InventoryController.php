<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\InventoryCoverage;
use Splk\Api\Domain\Costumes\InventoryChecks;
use Splk\Api\Domain\Costumes\InventoryAppointments;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Domain\Costumes\InventoryRepository;
use Splk\Api\Domain\Costumes\InventoryScope;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Db\Transaction;

/** Inventory evidence never implicitly returns, retires or relocates property (docs/06 chap. 7). */
final class InventoryController extends Controller
{
    public function register(Router $router): void
    {
        $router->add('POST', '/v1/funds/{unitId}/inventories/preview', $this->preview(...));
        $router->add('GET', '/v1/funds/{unitId}/inventories', $this->list(...));
        $router->add('POST', '/v1/funds/{unitId}/inventories', $this->create(...));
        $router->add('GET', '/v1/inventories/{id}', $this->detail(...));
        foreach (['targets', 'checks', 'issues', 'slots', 'visits', 'movements'] as $collection) {
            $router->add('GET', '/v1/inventories/{id}/' . $collection,
                fn (Request $r, RequestContext $c): Response => $this->collection($r, $c, $collection));
        }
        $router->add('GET', '/v1/inventories/{id}/work-orders', fn (Request $r, RequestContext $c): Response => $this->collection($r, $c, 'workOrders'));
        foreach (['slots' => 'slot', 'visits' => 'visit'] as $collection => $method) {
            $handler = fn (Request $r, RequestContext $c): Response => $this->appointment($r, $c, $method);
            $router->add('POST', '/v1/inventories/{id}/' . $collection, $handler);
            $router->add('PATCH', '/v1/inventories/{id}/' . $collection . '/{entryId}', $handler);
        }
        $router->add('POST', '/v1/inventories/{id}/targets', $this->addTarget(...));
        $router->add('POST', '/v1/inventories/{id}/checks', $this->checks(...));
        $router->add('POST', '/v1/inventories/{id}/close', $this->close(...));
        $router->add('DELETE', '/v1/inventory-checks/{id}', $this->cancel(...));
    }

    private function preview(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        InventoryInput::only($request->json(), ['scope']);
        $scope = $this->scope()->validate($request->json()['scope'] ?? null, $unit);
        return Response::json(Transaction::run($this->db(), function () use ($unit, $scope): array {
            $targets = $this->scope()->freeze($unit, $scope);
            $progress = InventoryCoverage::evaluate(array_map(static fn (array $t, int $i): array => $t + ['id' => $i], $targets, array_keys($targets)), []);
            return ['scope' => (object) $scope, 'progress' => $progress,
                'unloanedItemCount' => count(array_filter($targets, static fn (array $t): bool => $t['itemId'] !== null && $t['loanLineId'] === null))];
        }));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->repository()->list($unit, $limit, $offset));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        InventoryInput::only($request->json(), ['name', 'scope']);
        $name = Input::fromRequest($request)->text('name', 200);
        $scope = $this->scope()->validate($request->json()['scope'] ?? null, $unit);
        return Response::json($this->audited($context, 'inventory.create', $unit, function () use ($unit, $name, $scope, $context): array {
            $targets = $this->scope()->freeze($unit, $scope);
            $id = $this->repository()->insert($unit, $name, $scope, self::actor($context));
            foreach ($targets as $target) $this->repository()->addTarget($unit, $id, $target);
            return $this->withProgress($this->repository()->find($id));
        }), 201);
    }

    private function detail(Request $request, RequestContext $context): Response
    {
        return Response::json($this->withProgress($this->accessible($context, false)));
    }

    private function collection(Request $request, RequestContext $context, string $name): Response
    {
        $inventory = $this->accessible($context, false);
        InventoryInput::only($request->query, ['limit', 'offset']);
        [$limit, $offset] = InventoryInput::pagination($request->query);
        if ($name === 'issues') $rows = $this->repository()->progress($inventory)['issues'];
        elseif ($inventory['status'] === 'closed') $rows = $inventory['resultSnapshot'][$name];
        else $rows = $this->repository()->{$name}($inventory['id']);
        return Response::json(['items' => array_slice($rows, $offset, $limit), 'total' => count($rows)]);
    }

    private function addTarget(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $body = $request->json(); InventoryInput::only($body, ['version', 'note', 'itemId', 'kitId', 'bulkStockId']);
        $input = new Input($body); $version = $input->id('version'); $note = $input->text('note', 2000);
        $kinds = array_intersect(['itemId', 'kitId', 'bulkStockId'], array_keys($body));
        if (count($kinds) !== 1) throw Input::invalid('target', 'invalid');
        $kind = array_values($kinds)[0]; $id = $input->id($kind);
        return Response::json($this->audited($context, 'inventory.add_target', $initial['unitId'], function () use ($initial, $version, $note, $kind, $id): array {
            $inventory = $this->open($initial['id'], $version);
            $targets = array_filter($this->scope()->freeze($inventory['unitId'], []), static fn (array $t): bool => $t[$kind] === $id);
            if ($targets === []) throw self::notFound();
            foreach ($targets as $target) $this->repository()->addTarget($inventory['unitId'], $inventory['id'], $target, true, $note);
            $this->repository()->touch($inventory['id']);
            return $this->withProgress($this->repository()->find($inventory['id']));
        }, 'inventory_target_exists'), 201);
    }

    private function close(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        InventoryInput::only($request->json(), ['version', 'closedWithIssues', 'reason']);
        $input = Input::fromRequest($request); $version = $input->id('version');
        $issues = $input->bool('closedWithIssues'); $reason = $input->optionalString('reason', 2000);
        if (!$issues && $reason !== null) throw Input::invalid('reason', 'not_allowed');
        return Response::json($this->audited($context, 'inventory.close', $initial['unitId'], function () use ($initial, $version, $issues, $reason, $context): array {
            $inventory = $this->open($initial['id'], $version);
            try { $this->db()->exec('LOCK TABLE costume_items, costume_work_orders IN SHARE MODE NOWAIT'); }
            catch (\PDOException $e) {
                if ($e->getCode() === '55P03') throw new HttpException(409, 'inventory_busy', 'Property is changing. Retry closure.');
                throw $e;
            }
            $this->repository()->close($inventory, $issues, $reason, self::actor($context));
            return $this->withProgress($this->repository()->find($inventory['id']));
        }));
    }

    private function checks(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $writer = new InventoryChecks($this->db()); $batch = $writer->validate($request->json());
        $version = Input::fromRequest($request)->id('version');
        return Response::json($this->audited($context, 'inventory.check', $initial['unitId'], function () use ($initial, $version, $writer, $batch, $context): array {
            return $writer->record($this->open($initial['id'], $version), $batch, self::actor($context));
        }));
    }

    private function appointment(Request $request, RequestContext $context, string $kind): Response
    {
        $initial = $this->accessible($context, true); $body = $request->json(); $version = (new Input($body))->id('version');
        $id = isset($context->params['entryId']) ? self::routeId($context, 'entryId') : null;
        return Response::json($this->audited($context, 'inventory.' . $kind . ($id === null ? '_create' : '_update'), $initial['unitId'], function () use ($initial, $version, $kind, $id, $body): array {
            $inventory = $this->open($initial['id'], $version);
            $entry = (new InventoryAppointments($this->db()))->{$kind}($inventory, $id, $body);
            $this->repository()->touch($inventory['id']);
            return ['id' => $inventory['id'], 'inventory' => $this->withProgress($this->repository()->find($inventory['id'])), $kind => $entry];
        }, 'inventory_visit_exists'), $id === null ? 201 : 200);
    }

    private function cancel(Request $request, RequestContext $context): Response
    {
        $check = $this->repository()->check(self::routeId($context)) ?? throw self::notFound();
        $initial = $this->repository()->find($check['inventoryId']) ?? throw self::notFound();
        $this->fund($context, (string) $initial['unitId'], true);
        InventoryInput::only($request->query, ['version']);
        $version = InventoryInput::queryInteger($request->query['version'] ?? null, 'version');
        return Response::json($this->audited($context, 'inventory.cancel_check', $initial['unitId'], function () use ($initial, $version, $check, $context): array {
            $this->open($initial['id'], $version);
            $this->repository()->cancel($check['id'], self::actor($context));
            foreach ($this->repository()->targets($initial['id']) as $target) if ($target['id'] === $check['targetId'] && $target['itemId'] !== null) {
                (new ItemRepository($this->db()))->record($target['itemId'], self::actor($context), 'inventory_check_cancelled', ['checkId' => $check['id'], 'inventoryId' => $initial['id']]);
            }
            $this->repository()->touch($initial['id']);
            return $this->withProgress($this->repository()->find($initial['id']));
        }, auditData: ['checkId' => $check['id'], 'inventoryId' => $initial['id']]));
    }

    private function accessible(RequestContext $context, bool $write): array
    {
        $inventory = $this->repository()->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $inventory['unitId'], $write);
        return $inventory;
    }

    private function open(int $id, int $version): array
    {
        $inventory = $this->repository()->find($id, true) ?? throw self::notFound();
        if ($inventory['status'] !== 'open') throw new HttpException(409, 'inventory_closed', 'The inventory is closed.');
        InventoryInput::version($inventory, $version);
        return $inventory;
    }

    private function withProgress(array $inventory): array { return $inventory + ['progress' => $this->repository()->progress($inventory)]; }
    private function repository(): InventoryRepository { return new InventoryRepository($this->db()); }
    private function scope(): InventoryScope { return new InventoryScope($this->db()); }
    private function fund(RequestContext $context, string $unit, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write);
    }
}
