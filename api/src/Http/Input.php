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

    public static function invalid(string $field, string $reason): HttpException
    {
        return new HttpException(422, 'validation_failed', 'Invalid input.', ['field' => $field, 'reason' => $reason]);
    }
}
