<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/** Typed access to a JSON request body; invalid input is a 422 validation_failed with the field in details. */
final class Input
{
    /** @param array<mixed> $data */
    public function __construct(private readonly array $data)
    {
    }

    public static function fromRequest(Request $request): self
    {
        return new self($request->json());
    }

    public function string(string $field, int $maxLength = 500): string
    {
        $value = $this->data[$field] ?? null;
        if (!is_string($value) || trim($value) === '') {
            throw self::invalid($field, 'required');
        }
        if (mb_strlen($value) > $maxLength) {
            throw self::invalid($field, 'too_long');
        }

        return $value;
    }

    public function email(string $field): string
    {
        $value = trim($this->string($field, 254));
        if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw self::invalid($field, 'invalid_email');
        }

        return $value;
    }

    public function has(string $field): bool
    {
        return array_key_exists($field, $this->data);
    }

    /** Missing, null or blank = null. */
    public function optionalString(string $field, int $maxLength = 500): ?string
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return null;
        }
        if (!is_string($value)) {
            throw self::invalid($field, 'invalid');
        }
        if (mb_strlen($value) > $maxLength) {
            throw self::invalid($field, 'too_long');
        }

        return trim($value);
    }

    /** Trimmed required text. */
    public function text(string $field, int $maxLength = 200): string
    {
        return trim($this->string($field, $maxLength));
    }

    /** Positive integer id or null. */
    public function nullableId(string $field): ?int
    {
        $value = $this->data[$field] ?? null;
        if ($value === null) {
            return null;
        }
        if (!is_int($value) || $value < 1) {
            throw self::invalid($field, 'invalid');
        }

        return $value;
    }

    public function id(string $field): int
    {
        return $this->nullableId($field) ?? throw self::invalid($field, 'required');
    }

    public function bool(string $field, ?bool $default = null): bool
    {
        $value = $this->data[$field] ?? $default;
        if (!is_bool($value)) {
            throw self::invalid($field, $value === null ? 'required' : 'invalid');
        }

        return $value;
    }

    /** @param list<string> $allowed */
    public function enum(string $field, array $allowed, bool $nullable = false): ?string
    {
        $value = $this->data[$field] ?? null;
        if ($value === null && $nullable) {
            return null;
        }
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            throw self::invalid($field, $value === null ? 'required' : 'invalid');
        }

        return $value;
    }

    public static function invalid(string $field, string $reason): HttpException
    {
        return new HttpException(422, 'validation_failed', 'Invalid input.', ['field' => $field, 'reason' => $reason]);
    }
}
