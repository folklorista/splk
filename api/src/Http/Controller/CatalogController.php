<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use PDO;
use Splk\Api\Authorization\FundAccess;
use Splk\Api\Authorization\Mandates;
use Splk\Api\Domain\Costumes\CatalogRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Audit\AuditLog;
use Splk\Api\Infrastructure\Db\Transaction;

/**
 * Nastavení – catalog and series of a fund: /v1/funds/{unitId}/regions|part-types|series (api-v1 chap. 4.4).
 * Read: costumes.manage or costumes.view; write: costumes.manage of that unit (D-21, D-36).
 * Rows are archived instead of deleted. Kind and part type of a series never change, they define its identity (K24).
 */
final class CatalogController
{
    private const GENDERS = ['male', 'female'];

    /** @param \Closure(): PDO $db */
    public function __construct(private readonly \Closure $db)
    {
    }

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/funds/{unitId}/regions', $this->listRegions(...));
        $router->add('POST', '/v1/funds/{unitId}/regions', $this->createRegion(...));
        $router->add('PATCH', '/v1/funds/{unitId}/regions/{id}', $this->updateRegion(...));
        $router->add('GET', '/v1/funds/{unitId}/part-types', $this->listPartTypes(...));
        $router->add('POST', '/v1/funds/{unitId}/part-types', $this->createPartType(...));
        $router->add('PATCH', '/v1/funds/{unitId}/part-types/{id}', $this->updatePartType(...));
        $router->add('GET', '/v1/funds/{unitId}/series', $this->listSeries(...));
        $router->add('POST', '/v1/funds/{unitId}/series', $this->createSeries(...));
        $router->add('PATCH', '/v1/funds/{unitId}/series/{id}', $this->updateSeries(...));
    }

    private function listRegions(Request $request, RequestContext $context): Response
    {
        return Response::json(['items' => $this->catalog()->regions($this->fund($context, false))]);
    }

    private function createRegion(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $input = Input::fromRequest($request);
        $region = ['name' => $input->text('name'), 'parentId' => $input->nullableId('parentId')];
        $this->assertParentRegion($unitId, $region['parentId'], null);

        return $this->write($context, $unitId, 'region', 'create', function () use ($unitId, $region, $context): array {
            $id = $this->catalog()->insertRegion($unitId, $region['name'], $region['parentId'], self::actor($context));

            return $this->catalog()->findRegion($unitId, $id);
        }, 201);
    }

    private function updateRegion(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $current = $this->catalog()->findRegion($unitId, self::id($context)) ?? throw self::notFound();
        $input = Input::fromRequest($request);
        $region = [
            'name' => $input->has('name') ? $input->text('name') : $current['name'],
            'parentId' => $input->has('parentId') ? $input->nullableId('parentId') : $current['parentId'],
            'archived' => $input->has('archived') ? $input->bool('archived') : $current['archived'],
        ];
        if ($region['parentId'] !== $current['parentId']) {
            $this->assertParentRegion($unitId, $region['parentId'], $current['id']);
        }

        return $this->write($context, $unitId, 'region', 'update', function () use ($unitId, $current, $region): array {
            $this->catalog()->updateRegion($current['id'], $region);

            return $this->catalog()->findRegion($unitId, $current['id']);
        });
    }

    private function listPartTypes(Request $request, RequestContext $context): Response
    {
        return Response::json(['items' => $this->catalog()->partTypes($this->fund($context, false))]);
    }

    private function createPartType(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $input = Input::fromRequest($request);
        $type = [
            'name' => $input->text('name'),
            'gender' => $input->enum('gender', self::GENDERS, true),
            'regionId' => $input->nullableId('regionId'),
            'numbered' => $input->bool('numbered', true),
        ];
        $this->assertRegion($unitId, $type['regionId']);

        return $this->write($context, $unitId, 'part_type', 'create', function () use ($unitId, $type, $context): array {
            $id = $this->catalog()->insertPartType($unitId, $type, self::actor($context));

            return $this->catalog()->findPartType($unitId, $id);
        }, 201);
    }

    private function updatePartType(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $current = $this->catalog()->findPartType($unitId, self::id($context)) ?? throw self::notFound();
        $input = Input::fromRequest($request);
        $type = [
            'name' => $input->has('name') ? $input->text('name') : $current['name'],
            'gender' => $input->has('gender') ? $input->enum('gender', self::GENDERS, true) : $current['gender'],
            'regionId' => $input->has('regionId') ? $input->nullableId('regionId') : $current['regionId'],
            'numbered' => $input->has('numbered') ? $input->bool('numbered') : $current['numbered'],
            'archived' => $input->has('archived') ? $input->bool('archived') : $current['archived'],
        ];
        if ($type['regionId'] !== $current['regionId']) {
            $this->assertRegion($unitId, $type['regionId']);
        }

        return $this->write($context, $unitId, 'part_type', 'update', function () use ($unitId, $current, $type): array {
            $this->catalog()->updatePartType($current['id'], $type);

            return $this->catalog()->findPartType($unitId, $current['id']);
        });
    }

    private function listSeries(Request $request, RequestContext $context): Response
    {
        return Response::json(['items' => $this->catalog()->series($this->fund($context, false))]);
    }

    private function createSeries(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $input = Input::fromRequest($request);
        $kind = $input->enum('kind', ['part', 'kit']);
        $partTypeId = $input->nullableId('partTypeId');
        $partType = null;
        if ($kind === 'part') {
            $partType = $partTypeId === null ? throw Input::invalid('partTypeId', 'required') : $this->catalog()->findPartType($unitId, $partTypeId);
            if ($partType === null || $partType['archived']) {
                throw Input::invalid('partTypeId', 'invalid');
            }
            if (!$partType['numbered']) {
                // unnumbered parts are counted per part type, they have no series (D-35, D-37)
                throw new HttpException(422, 'part_type_not_numbered', 'Unnumbered part types have no series.');
            }
        } elseif ($partTypeId !== null) {
            throw Input::invalid('partTypeId', 'not_allowed');
        }

        $series = [
            'kind' => $kind,
            'name' => $input->has('name') || $partType === null ? $input->text('name') : $partType['name'],
            'partTypeId' => $partTypeId,
            'regionId' => $input->has('regionId') ? $input->nullableId('regionId') : $partType['regionId'] ?? null,
            'gender' => $input->has('gender') ? $input->enum('gender', self::GENDERS, true) : $partType['gender'] ?? null,
            'variant' => $input->optionalString('variant', 100),
            'allowNumberReuse' => $input->bool('allowNumberReuse', true),
        ];
        $this->assertRegion($unitId, $series['regionId']);

        return $this->write($context, $unitId, 'series', 'create', function () use ($unitId, $series, $context): array {
            $id = $this->catalog()->insertSeries($unitId, $series, self::actor($context));

            return $this->catalog()->findSeries($unitId, $id);
        }, 201);
    }

    private function updateSeries(Request $request, RequestContext $context): Response
    {
        $unitId = $this->fund($context, true);
        $current = $this->catalog()->findSeries($unitId, self::id($context)) ?? throw self::notFound();
        $input = Input::fromRequest($request);
        if ($input->has('kind') && $input->enum('kind', ['part', 'kit']) !== $current['kind']) {
            throw Input::invalid('kind', 'immutable');
        }
        if ($input->has('partTypeId') && $input->nullableId('partTypeId') !== $current['partTypeId']) {
            throw Input::invalid('partTypeId', 'immutable');
        }
        $series = [
            'name' => $input->has('name') ? $input->text('name') : $current['name'],
            'regionId' => $input->has('regionId') ? $input->nullableId('regionId') : $current['regionId'],
            'gender' => $input->has('gender') ? $input->enum('gender', self::GENDERS, true) : $current['gender'],
            'variant' => $input->has('variant') ? $input->optionalString('variant', 100) : $current['variant'],
            'allowNumberReuse' => $input->has('allowNumberReuse') ? $input->bool('allowNumberReuse') : $current['allowNumberReuse'],
            'archived' => $input->has('archived') ? $input->bool('archived') : $current['archived'],
        ];
        if ($series['regionId'] !== $current['regionId']) {
            $this->assertRegion($unitId, $series['regionId']);
        }

        return $this->write($context, $unitId, 'series', 'update', function () use ($unitId, $current, $series): array {
            $this->catalog()->updateSeries($current['id'], $series);

            return $this->catalog()->findSeries($unitId, $current['id']);
        });
    }

    /**
     * Runs the write and its audit row in one transaction; a duplicate active name is a 422.
     *
     * @param callable(): array<string, mixed> $work returns the stored entity
     */
    private function write(RequestContext $context, int $unitId, string $entity, string $action, callable $work, int $status = 200): Response
    {
        try {
            $result = Transaction::run(($this->db)(), function () use ($work, $context, $unitId, $entity, $action): array {
                $result = $work();
                (new AuditLog(($this->db)()))->record(self::actor($context), "$entity.$action", $entity, $result['id'], $unitId, $result);

                return $result;
            });
        } catch (\PDOException $e) {
            if (Transaction::isUniqueViolation($e)) {
                throw new HttpException(422, 'duplicate_name', 'An active entry with this name already exists.');
            }
            throw $e;
        }

        return Response::json($result, $status);
    }

    /** Parent must be an active top-level region of the same fund: regions have two levels, region → area (D-37). */
    private function assertParentRegion(int $unitId, ?int $parentId, ?int $regionId): void
    {
        if ($parentId === null) {
            return;
        }
        $parent = $this->catalog()->findRegion($unitId, $parentId);
        if ($parent === null || $parent['archived'] || $parent['parentId'] !== null || $parentId === $regionId) {
            throw Input::invalid('parentId', 'invalid');
        }
        if ($regionId !== null && $this->catalog()->hasChildRegions($regionId)) {
            throw Input::invalid('parentId', 'region_has_children');
        }
    }

    private function assertRegion(int $unitId, ?int $regionId): void
    {
        if ($regionId === null) {
            return;
        }
        $region = $this->catalog()->findRegion($unitId, $regionId);
        if ($region === null || $region['archived']) {
            throw Input::invalid('regionId', 'invalid');
        }
    }

    private function fund(RequestContext $context, bool $write): int
    {
        $mandates = Mandates::forAccount(($this->db)(), self::actor($context));

        return (new FundAccess(($this->db)()))->require($mandates, $context->params['unitId'], $write);
    }

    private function catalog(): CatalogRepository
    {
        return new CatalogRepository(($this->db)());
    }

    private static function actor(RequestContext $context): int
    {
        return $context->session?->accountId ?? throw new \LogicException('Route requires a session');
    }

    private static function id(RequestContext $context): int
    {
        $id = filter_var($context->params['id'], FILTER_VALIDATE_INT);

        return $id === false ? throw self::notFound() : $id;
    }

    private static function notFound(): HttpException
    {
        return new HttpException(404, 'not_found', 'Not found.');
    }
}
