<?php

declare(strict_types=1);

namespace Splk\Api;

/**
 * Application configuration loaded from a PHP file returning an array.
 * On the hosting the file lives in config/ outside the web root and deploy never overwrites it (D-54).
 */
final class Config
{
    /** @param array<string, mixed> $values */
    public function __construct(private readonly array $values)
    {
    }

    public static function load(string $path): self
    {
        if (!is_file($path)) {
            throw new \RuntimeException('Configuration file not found: ' . $path);
        }

        $values = require $path;
        if (!is_array($values)) {
            throw new \RuntimeException('Configuration file must return an array: ' . $path);
        }

        return new self($values);
    }

    /** Resolves the config file: SPLK_API_CONFIG (local Docker) or config/config.php (hosting). */
    public static function defaultPath(): string
    {
        $path = getenv('SPLK_API_CONFIG');

        return is_string($path) && $path !== '' ? $path : dirname(__DIR__) . '/config/config.php';
    }

    /** Reads a value by dot path, e.g. "db.host". */
    public function get(string $key, mixed $default = null): mixed
    {
        $value = $this->values;
        foreach (explode('.', $key) as $part) {
            if (!is_array($value) || !array_key_exists($part, $value)) {
                return $default;
            }
            $value = $value[$part];
        }

        return $value;
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        return $this->values;
    }
}
