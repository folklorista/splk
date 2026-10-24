<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/** Trusted PHP upload descriptor, never constructed from request JSON or client paths. */
final class UploadedFile
{
    public function __construct(private readonly string $temporaryPath, private readonly int $error = UPLOAD_ERR_OK)
    {
    }

    public static function fromGlobals(array $file): self
    {
        $path = $file['tmp_name'] ?? null; $error = $file['error'] ?? null;
        if (!is_string($path) || !is_int($error)) return new self('', UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_OK && !is_uploaded_file($path)) return new self('', UPLOAD_ERR_NO_FILE);
        return new self($path, $error);
    }

    public function read(int $limit): string
    {
        if (in_array($this->error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) throw new HttpException(413, 'file_too_large', 'The upload exceeds the configured limit.');
        if ($this->error !== UPLOAD_ERR_OK) throw new HttpException(422, 'invalid_file', 'The upload did not complete.');
        $stream = @fopen($this->temporaryPath, 'rb');
        if ($stream === false) throw new HttpException(422, 'invalid_file', 'The upload is unavailable.');
        try { $content = stream_get_contents($stream, $limit + 1); }
        finally { fclose($stream); }
        if ($content === false || $content === '') throw new HttpException(422, 'invalid_file', 'The upload is empty.');
        if (strlen($content) > $limit) throw new HttpException(413, 'file_too_large', 'The upload exceeds the configured limit.');
        return $content;
    }
}
