<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/** Validation shared by the inventory endpoints; query integers arrive as strings, JSON quantities as integers. */
final class InventoryInput
{
    public static function only(array $values, array $allowed): void
    {
        foreach (array_keys($values) as $field) {
            if (!in_array($field, $allowed, true)) {
                throw Input::invalid((string) $field, 'not_allowed');
            }
        }
    }

    public static function quantity(array $values, string $field, int $minimum = 0): int
    {
        $value = $values[$field] ?? null;
        if (!is_int($value) || $value < $minimum || $value > 2147483647) {
            throw Input::invalid($field, 'invalid');
        }
        return $value;
    }

    public static function pagination(array $query): array
    {
        return [self::queryInteger($query['limit'] ?? '50', 'limit', 1, 200), self::queryInteger($query['offset'] ?? '0', 'offset', 0, PHP_INT_MAX)];
    }

    public static function queryInteger(mixed $value, string $field, int $min = 1, int $max = PHP_INT_MAX): int
    {
        if (!is_string($value) || !preg_match('/^(0|[1-9][0-9]*)$/D', $value)) {
            throw Input::invalid($field, 'invalid');
        }
        $number = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => $min, 'max_range' => $max]]);
        return $number === false ? throw Input::invalid($field, 'invalid') : $number;
    }

    public static function version(array $current, int $version): void
    {
        if ($current['version'] !== $version) {
            throw new HttpException(409, 'version_conflict', 'The record has changed. Reload before saving.', ['version' => $current['version']]);
        }
    }
}
