<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/** Error rendered as {"error": {"code", "message", "details"}} with a stable code (api-v1 chap. 2.2). */
class HttpException extends \RuntimeException
{
    /**
     * @param array<string, mixed> $details
     * @param array<string, string> $headers
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }

    public function toResponse(): Response
    {
        $body = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->details !== []) {
            $body['details'] = $this->details;
        }

        $response = Response::json(['error' => $body], $this->status);
        foreach ($this->headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response;
    }
}
