<?php

declare(strict_types=1);

namespace Splk\Api\Infrastructure\Attachments;

/** Private UUID-only paths; access decisions are made before this store is called. */
final class AttachmentStorage
{
    public function __construct(private readonly string $root)
    {
    }

    public function write(string $id, string $content, ?string $thumbnail): void
    {
        $directory = $this->directory($id);
        if (!mkdir($directory, 0700)) throw new \RuntimeException('Cannot create attachment directory.');
        try {
            $this->writeFile($directory . '/content', $content);
            if ($thumbnail !== null) $this->writeFile($directory . '/thumbnail', $thumbnail);
        } catch (\Throwable $error) {
            $this->remove($id);
            throw $error;
        }
    }

    public function read(string $id, bool $thumbnail = false): string
    {
        $path = $this->path($id, $thumbnail);
        $content = file_get_contents($path);
        if ($content === false) throw new \RuntimeException('Stored attachment is unavailable.');
        return $content;
    }

    /** Used only after authorization, with metadata row locks held until ZIP creation finishes. */
    public function path(string $id, bool $thumbnail = false): string
    {
        $directory = $this->directory($id);
        $path = $directory . ($thumbnail ? '/thumbnail' : '/content');
        if (is_link($directory) || is_link($path) || !is_file($path)) throw new \RuntimeException('Stored attachment is unavailable.');
        return $path;
    }

    public function remove(string $id): void
    {
        $directory = $this->directory($id);
        if (is_link($directory)) throw new \RuntimeException('Invalid attachment directory.');
        foreach (['content', 'thumbnail'] as $name) {
            $path = $directory . '/' . $name;
            if (is_link($path)) throw new \RuntimeException('Invalid attachment file.');
            if (is_file($path) && !unlink($path)) throw new \RuntimeException('Cannot remove attachment content.');
        }
        if (is_dir($directory) && !rmdir($directory)) throw new \RuntimeException('Cannot remove attachment directory.');
    }

    public function temporaryFile(): string
    {
        $path = tempnam($this->root(), '.export-');
        if ($path === false) throw new \RuntimeException('Cannot create export file.');
        chmod($path, 0600);
        return $path;
    }

    private function directory(string $id): string
    {
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $id)) throw new \LogicException('Invalid storage identifier.');
        return $this->root() . '/' . $id;
    }

    private function root(): string
    {
        if (!is_dir($this->root) && !mkdir($this->root, 0700, true) && !is_dir($this->root)) throw new \RuntimeException('Cannot create private attachment storage.');
        $root = realpath($this->root); $public = realpath(dirname(__DIR__, 3) . '/public');
        if ($root === false || $public === false || $root === $public || str_starts_with($root, $public . DIRECTORY_SEPARATOR)) {
            throw new \RuntimeException('Attachment storage must be outside the public web root.');
        }
        return $root;
    }

    private function writeFile(string $path, string $content): void
    {
        $stream = fopen($path, 'xb');
        if ($stream === false) throw new \RuntimeException('Cannot create attachment file.');
        try {
            if (!chmod($path, 0600)) throw new \RuntimeException('Cannot secure attachment file.');
            $offset = 0; $length = strlen($content);
            while ($offset < $length) {
                $written = fwrite($stream, substr($content, $offset));
                if ($written === false || $written === 0) throw new \RuntimeException('Incomplete attachment write.');
                $offset += $written;
            }
        } finally { fclose($stream); }
    }
}
