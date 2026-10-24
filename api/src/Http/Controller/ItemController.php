<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

/** Items of one fund (api-v1 chap. 4.4). All writes, own events and audit rows commit together. */
final class ItemController extends Controller
{
    private const CONDITIONS = ['ok', 'needs_adjustment', 'damaged'];
    private const LOCATIONS = ['store', 'holder', 'seamstress', 'repair', 'unknown'];
    private const FIELDS = ['seriesId', 'number', 'variant', 'size', 'description', 'note', 'condition', 'issuable', 'location', 'locationNote', 'acquiredOn'];
    private const SORTS = [
        'series' => 's.name ASC, i.number ASC NULLS LAST', '-series' => 's.name DESC, i.number DESC NULLS LAST',
        'number' => 'i.number ASC NULLS LAST', '-number' => 'i.number DESC NULLS LAST',
        'acquiredOn' => 'i.acquired_on ASC NULLS LAST', '-acquiredOn' => 'i.acquired_on DESC NULLS LAST',
        'id' => 'i.id ASC', '-id' => 'i.id DESC',
    ];

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/funds/{unitId}/items', $this->list(...));
        $router->add('POST', '/v1/funds/{unitId}/items', $this->create(...));
        $router->add('GET', '/v1/items/{id}', $this->detail(...));
        $router->add('PATCH', '/v1/items/{id}', $this->update(...));
        $router->add('POST', '/v1/items/{id}/retire', $this->retire(...));
        $router->add('GET', '/v1/items/{id}/history', $this->history(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, $context->params['unitId'], false);
        $this->only($request->query, ['limit', 'offset', 'sort', 'series', 'q', 'condition', 'location', 'acquiredFrom', 'acquiredTo', 'retired', 'available', 'holder']);
        [$limit, $offset] = $this->pagination($request->query);
        $filters = ['retired' => false];
        if (isset($request->query['retired'])) {
            if (!in_array($request->query['retired'], ['true', 'false'], true)) {
                throw Input::invalid('retired', 'invalid');
            }
            $filters['retired'] = $request->query['retired'] === 'true';
        }
        if (isset($request->query['series'])) {
            $filters['series'] = $this->queryInteger($request->query['series'], 'series', 1, PHP_INT_MAX);
        }
        if (isset($request->query['available'])) {
            $filters['available'] = match ($request->query['available']) { 'true' => true, 'false' => false, default => throw Input::invalid('available', 'invalid') };
        }
        if (isset($request->query['holder'])) {
            $filters['holder'] = $this->queryInteger($request->query['holder'], 'holder', 1, PHP_INT_MAX);
        }
        foreach (['condition' => self::CONDITIONS, 'location' => self::LOCATIONS] as $key => $allowed) {
            if (array_key_exists($key, $request->query)) {
                $filters[$key] = (new Input($request->query))->enum($key, $allowed);
            }
        }
        foreach (['acquiredFrom', 'acquiredTo'] as $key) {
            if (array_key_exists($key, $request->query)) {
                $filters[$key] = $this->date($request->query[$key], $key);
            }
        }
        if (isset($filters['acquiredFrom'], $filters['acquiredTo']) && $filters['acquiredFrom'] > $filters['acquiredTo']) {
            throw Input::invalid('acquiredTo', 'invalid');
        }
        if (array_key_exists('q', $request->query)) {
            $filters['q'] = (new Input($request->query))->optionalString('q', 200);
        }
        $sort = $request->query['sort'] ?? 'series';
        if (!is_string($sort) || !isset(self::SORTS[$sort])) {
            throw Input::invalid('sort', 'invalid');
        }
        return Response::json($this->items()->list($unitId, $filters, $limit, $offset, self::SORTS[$sort]));
    }

    private function detail(Request $request, RequestContext $context): Response
    {
        return Response::json($this->accessibleItem($context, false));
    }

    private function history(Request $request, RequestContext $context): Response
    {
        $item = $this->accessibleItem($context, false);
        $this->only($request->query, ['limit', 'offset']);
        [$limit, $offset] = $this->pagination($request->query);
        return Response::json($this->items()->history($item['id'], $limit, $offset));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, $context->params['unitId'], true);
        $this->only($request->json(), self::FIELDS);
        $input = $this->values(Input::fromRequest($request));
        $result = $this->audited($context, 'item.create', $unitId, function () use ($input, $unitId, $context): array {
            $this->validateSeriesAndNumber($unitId, $input, null);
            $id = $this->items()->insert($unitId, $input, self::actor($context));
            $result = $this->items()->find($id);
            $this->items()->record($id, self::actor($context), 'created', $result);
            return $result;
        }, 'number_already_used');
        return Response::json($result, 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessibleItem($context, true);
        $this->only($request->json(), [...self::FIELDS, 'version']);
        $input = Input::fromRequest($request);
        $version = $input->id('version');
        $result = $this->audited($context, 'item.update', $initial['unitId'], function () use ($initial, $input, $version, $context): array {
            $current = $this->items()->find($initial['id'], true) ?? throw self::notFound();
            $this->assertEditable($current, $version);
            $next = $this->values($input, $current);
            // Archived catalog entries remain readable; metadata can still be corrected on existing items.
            if ($next['seriesId'] !== $current['seriesId'] || $next['number'] !== $current['number']) {
                $this->validateSeriesAndNumber($current['unitId'], $next, $current['id']);
            }
            $changes = [];
            foreach (self::FIELDS as $key) {
                if ($current[$key] !== $next[$key]) {
                    $changes[$key] = ['from' => $current[$key], 'to' => $next[$key]];
                }
            }
            $this->items()->update($current['id'], $next);
            foreach ($changes as $key => $change) {
                $event = match ($key) {
                    'condition' => 'condition_changed', 'location', 'locationNote' => 'location_changed',
                    'issuable' => 'issuable_changed', 'number' => 'number_assigned',
                    default => 'details_changed',
                };
                $this->items()->record($current['id'], self::actor($context), $event, ['field' => $key] + $change);
            }
            return $this->items()->find($current['id']);
        }, 'number_already_used');
        return Response::json($result);
    }

    private function retire(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessibleItem($context, true);
        $this->only($request->json(), ['version', 'reason']);
        $input = Input::fromRequest($request);
        $version = $input->id('version');
        $reason = $input->text('reason', 2000);
        return Response::json($this->audited($context, 'item.retire', $initial['unitId'], function () use ($initial, $version, $reason, $context): array {
            $current = $this->items()->find($initial['id'], true) ?? throw self::notFound();
            $this->assertEditable($current, $version);
            $this->items()->retire($current['id'], self::actor($context), $reason);
            $this->items()->record($current['id'], self::actor($context), 'retired', ['reason' => $reason]);
            return $this->items()->find($current['id']);
        }));
    }

    private function accessibleItem(RequestContext $context, bool $write): array
    {
        $item = $this->items()->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $item['unitId'], $write);
        return $item;
    }

    private function assertEditable(array $current, int $version): void
    {
        if ($current['version'] !== $version) {
            throw new HttpException(409, 'version_conflict', 'The item has changed. Reload it before saving.', ['version' => $current['version']]);
        }
        if ($current['retiredAt'] !== null) {
            throw new HttpException(422, 'item_retired', 'A retired item cannot be changed.');
        }
    }

    private function validateSeriesAndNumber(int $unitId, array $item, ?int $id): void
    {
        $series = $this->items()->lockSeries($unitId, $item['seriesId']);
        if ($series === null || $series['kind'] !== 'part' || $series['archived_at'] !== null) {
            throw Input::invalid('seriesId', 'invalid');
        }
        $type = $this->items()->lockPartType($unitId, (int) $series['part_type_id']);
        if ($type === null || !$type['numbered'] || $type['archived_at'] !== null) {
            throw Input::invalid('seriesId', 'invalid');
        }
        foreach ([$series['region_id'], $type['region_id']] as $regionId) {
            if (!$this->items()->regionIsActive($unitId, $regionId === null ? null : (int) $regionId)) {
                throw Input::invalid('seriesId', 'invalid');
            }
        }
        if ($item['number'] !== null && $this->items()->numberExists($item['seriesId'], $item['number'], !$series['allow_number_reuse'], $id)) {
            throw new HttpException(422, 'number_already_used', 'The number is already used in this series.');
        }
    }

    private function values(Input $input, ?array $current = null): array
    {
        $result = [
            'seriesId' => $input->has('seriesId') || $current === null ? $input->id('seriesId') : $current['seriesId'],
            'number' => $input->has('number') || $current === null ? $input->optionalString('number', 100) : $current['number'],
        ];
        foreach (['variant' => 100, 'size' => 200, 'description' => 2000, 'note' => 5000, 'locationNote' => 2000] as $key => $max) {
            $result[$key] = $input->has($key) ? $input->optionalString($key, $max) : ($current[$key] ?? null);
        }
        foreach (['condition' => self::CONDITIONS, 'location' => self::LOCATIONS] as $key => $allowed) {
            $result[$key] = $input->has($key) ? $input->enum($key, $allowed) : ($current[$key] ?? ($key === 'condition' ? 'ok' : 'unknown'));
        }
        $result['issuable'] = $input->has('issuable') ? $input->bool('issuable') : ($current['issuable'] ?? true);
        $result['acquiredOn'] = $input->has('acquiredOn') ? $this->date($input->optionalString('acquiredOn', 10), 'acquiredOn') : ($current['acquiredOn'] ?? null);
        return $result;
    }

    private function date(mixed $value, string $field): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || !preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $value, $parts)
            || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            throw Input::invalid($field, 'invalid');
        }
        return $value;
    }

    private function pagination(array $query): array
    {
        return [$this->queryInteger($query['limit'] ?? '50', 'limit', 1, 200), $this->queryInteger($query['offset'] ?? '0', 'offset', 0, PHP_INT_MAX)];
    }

    private function queryInteger(mixed $value, string $field, int $min, int $max): int
    {
        if (!is_string($value) || !preg_match('/^(0|[1-9][0-9]*)$/D', $value)) {
            throw Input::invalid($field, 'invalid');
        }
        $integer = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => $min, 'max_range' => $max]]);
        return $integer === false ? throw Input::invalid($field, 'invalid') : $integer;
    }

    private function only(array $values, array $allowed): void
    {
        foreach (array_keys($values) as $key) {
            if (!in_array($key, $allowed, true)) {
                throw Input::invalid((string) $key, 'not_allowed');
            }
        }
    }

    private function fund(RequestContext $context, string $unitId, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unitId, $write);
    }

    private function items(): ItemRepository
    {
        return new ItemRepository($this->db());
    }
}
