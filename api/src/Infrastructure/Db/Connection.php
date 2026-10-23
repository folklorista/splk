<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Db;

use PDO;

/** Opens the PDO connection on first use, so requests that need no database (preflight, 404) never connect. */
final class Connection
{
    private ?PDO $pdo;

    /** @param array<string, mixed> $settings see ConnectionFactory::create() */
    public function __construct(private readonly array $settings = [], ?PDO $pdo = null)
    {
        $this->pdo = $pdo;
    }

    public static function fromPdo(PDO $pdo): self
    {
        return new self([], $pdo);
    }

    public function pdo(): PDO
    {
        return $this->pdo ??= ConnectionFactory::create($this->settings);
    }
}
