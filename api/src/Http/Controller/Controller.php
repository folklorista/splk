<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use PDO;
use Splk\Api\Authorization\Mandates;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\RequestContext;
use Splk\Api\Infrastructure\Audit\AuditLog;
use Splk\Api\Infrastructure\Db\Transaction;

/** Shared plumbing of authenticated controllers: the session's account, mandates, route ids and audited writes. */
abstract class Controller
{
    /** @param \Closure(): PDO $db opens the connection only when a handler needs it */
    public function __construct(private readonly \Closure $db)
    {
    }

    protected function db(): PDO
    {
        return ($this->db)();
    }

    protected function mandates(RequestContext $context): Mandates
    {
        return Mandates::forAccount($this->db(), self::actor($context));
    }

    /**
     * Runs the write and its audit row in one transaction. $work returns the stored entity (with "id").
     * A unique violation becomes 422 $duplicateCode.
     *
     * @param callable(): array<string, mixed> $work
     * @param array<string, mixed>|null $auditData defaults to the returned entity
     * @return array<string, mixed>
     */
    protected function audited(RequestContext $context, string $action, ?int $unitId, callable $work, string $duplicateCode = 'duplicate_name', ?array $auditData = null): array
    {
        try {
            return Transaction::run($this->db(), function () use ($context, $action, $unitId, $work, $auditData): array {
                $result = $work();
                $entity = explode('.', $action)[0];
                (new AuditLog($this->db()))->record(self::actor($context), $action, $entity, $result['id'] ?? null, $unitId, $auditData ?? $result);

                return $result;
            });
        } catch (\PDOException $e) {
            if ($e->getCode() === '23514' && str_contains($e->getMessage(), 'Allocations and outstanding handovers exceed total stock')) {
                throw new HttpException(422, 'insufficient_stock', 'Allocations and outstanding handovers exceed total stock.');
            }
            if (Transaction::isUniqueViolation($e)) {
                throw new HttpException(422, $duplicateCode, 'An active entry with the same key already exists.');
            }
            throw $e;
        }
    }

    protected static function actor(RequestContext $context): int
    {
        return $context->session?->accountId ?? throw new \LogicException('Route requires a session');
    }

    protected static function routeId(RequestContext $context, string $param = 'id'): int
    {
        $id = filter_var($context->params[$param] ?? null, FILTER_VALIDATE_INT);

        return $id === false ? throw self::notFound() : $id;
    }

    protected static function notFound(): HttpException
    {
        return new HttpException(404, 'not_found', 'Not found.');
    }
}
