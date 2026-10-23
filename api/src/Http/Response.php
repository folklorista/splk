<?php

declare(strict_types=1);

namespace Splk\Api\Http;

final class Response
{
    /**
     * @param array<string, string> $headers
     * @param list<string> $cookies raw Set-Cookie values
     */
    public function __construct(
        public readonly int $status = 200,
        public readonly array $headers = [],
        public readonly string $body = '',
        public readonly array $cookies = [],
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self(
            $status,
            ['Content-Type' => 'application/json; charset=utf-8'],
            json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );
    }

    public static function noContent(): self
    {
        return new self(204);
    }

    public function withHeader(string $name, string $value): self
    {
        return new self($this->status, [$name => $value] + $this->headers, $this->body, $this->cookies);
    }

    public function withCookie(string $setCookie): self
    {
        return new self($this->status, $this->headers, $this->body, [...$this->cookies, $setCookie]);
    }

    public function header(string $name): ?string
    {
        foreach ($this->headers as $key => $value) {
            if (strcasecmp($key, $name) === 0) {
                return $value;
            }
        }

        return null;
    }

    /** @return array<mixed> */
    public function decodedBody(): array
    {
        return $this->body === '' ? [] : json_decode($this->body, true, 64, JSON_THROW_ON_ERROR);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }
        foreach ($this->cookies as $cookie) {
            header('Set-Cookie: ' . $cookie, false);
        }
        echo $this->body;
    }
}
