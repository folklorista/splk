<?php

declare(strict_types=1);

namespace Splk\Api\Http;

final class Request
{
    /** @var array<string, string> lower-case header names */
    private readonly array $headers;

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $query
     * @param array<string, string> $cookies
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        array $headers = [],
        public readonly array $query = [],
        public readonly array $cookies = [],
        public readonly string $body = '',
        public readonly string $clientIp = '',
    ) {
        $this->headers = array_change_key_case($headers, CASE_LOWER);
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[str_replace('_', '-', substr($key, 5))] = (string) $value;
            }
        }
        foreach (['CONTENT_TYPE' => 'content-type', 'CONTENT_LENGTH' => 'content-length'] as $key => $name) {
            if (isset($_SERVER[$key])) {
                $headers[$name] = (string) $_SERVER[$key];
            }
        }

        $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            is_string($path) && $path !== '' ? $path : '/',
            $headers,
            $_GET,
            array_map('strval', $_COOKIE),
            (string) file_get_contents('php://input'),
            (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function cookie(string $name): ?string
    {
        return $this->cookies[$name] ?? null;
    }

    public function isSafeMethod(): bool
    {
        return in_array($this->method, ['GET', 'HEAD', 'OPTIONS'], true);
    }

    /** Media type without parameters, e.g. "application/json". */
    public function mediaType(): ?string
    {
        $type = $this->header('content-type');

        return $type === null ? null : strtolower(trim(explode(';', $type)[0]));
    }

    /** @return array<mixed> decoded JSON body; empty body = empty array */
    public function json(): array
    {
        if (trim($this->body) === '') {
            return [];
        }

        try {
            $data = json_decode($this->body, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(400, 'invalid_json', 'Request body is not valid JSON.');
        }
        if (!is_array($data)) {
            throw new HttpException(400, 'invalid_json', 'Request body must be a JSON object or array.');
        }

        return $data;
    }
}
