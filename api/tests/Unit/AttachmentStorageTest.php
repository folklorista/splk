<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Splk\Api\Infrastructure\Attachments\AttachmentStorage;

final class AttachmentStorageTest extends TestCase
{
    private const ID = '5a90cf99-3e78-4046-b9b9-05aff2c3af63';
    private string $root;

    protected function setUp(): void { $this->root = sys_get_temp_dir() . '/splk-private-' . bin2hex(random_bytes(8)); }
    protected function tearDown(): void
    {
        if (is_dir($this->root)) {
            $link = $this->root . '/' . self::ID;
            if (is_link($link)) unlink($link); else (new AttachmentStorage($this->root))->remove(self::ID);
            rmdir($this->root);
        }
    }

    public function testOpaqueFilesArePrivateAndRemovalIsRetryable(): void
    {
        $store = new AttachmentStorage($this->root); $store->write(self::ID, 'content', 'preview');
        self::assertSame('content', $store->read(self::ID)); self::assertSame('preview', $store->read(self::ID, true));
        self::assertSame(0700, fileperms($this->root . '/' . self::ID) & 0777);
        self::assertSame(0600, fileperms($store->path(self::ID)) & 0777);
        $store->remove(self::ID); $store->remove(self::ID);
        self::assertDirectoryDoesNotExist($this->root . '/' . self::ID);
    }

    public function testTraversalNeverCreatesStorage(): void
    {
        try { (new AttachmentStorage($this->root))->write('../public/photo', 'content', null); self::fail('Traversal accepted'); }
        catch (\LogicException) { self::assertDirectoryDoesNotExist($this->root); }
    }

    public function testPublicWebRootCannotBeUsedAsPrivateStorage(): void
    {
        $public = dirname(__DIR__, 2) . '/public';
        try { (new AttachmentStorage($public))->write(self::ID, 'content', null); self::fail('Public storage accepted'); }
        catch (\RuntimeException) { self::assertDirectoryDoesNotExist($public . '/' . self::ID); }
    }

    public function testSymlinksCannotEscapeThePrivateStore(): void
    {
        mkdir($this->root, 0700); symlink(dirname(__DIR__, 2), $this->root . '/' . self::ID);
        try { (new AttachmentStorage($this->root))->read(self::ID); self::fail('Symlink accepted'); }
        catch (\RuntimeException) { self::assertFileExists(dirname(__DIR__, 2) . '/composer.json'); }
    }
}
