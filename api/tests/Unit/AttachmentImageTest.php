<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Splk\Api\Domain\Costumes\AttachmentImage;
use Splk\Api\Http\HttpException;

final class AttachmentImageTest extends TestCase
{
    public static function orientations(): array
    {
        // Expected top-left colour of the visually oriented 3x2 pattern, independently of GD transforms.
        return ['normal' => [1, 0], 'horizontal mirror' => [2, 2], 'half turn' => [3, 5],
            'vertical mirror' => [4, 3], 'transpose' => [5, 0], 'clockwise' => [6, 3],
            'transverse' => [7, 5], 'counterclockwise' => [8, 2]];
    }

    #[DataProvider('orientations')]
    public function testGpsIsRemovedWithoutChangingJpegPixelsOrOrientation(int $orientation, int $corner): void
    {
        $jpeg = $this->image('jpeg');
        $input = substr($jpeg, 0, 2) . $this->exif($orientation) . $this->segment(0xe1, 'http://ns.adobe.com/xap/1.0/' . "\0GPSLatitude=GPS-SECRET")
            . $this->segment(0xed, 'IPTC GPS-SECRET') . substr($jpeg, 2);
        $result = AttachmentImage::prepare($input, 'image/jpeg');
        self::assertStringNotContainsString('GPS-SECRET', $result['content']);
        self::assertStringNotContainsString('GPS-SECRET', $result['thumbnail']);
        self::assertSame($orientation, $result['orientation']);
        $raw = imagecreatefromstring($jpeg); $clean = imagecreatefromstring($result['content']);
        foreach ([[20, 20], [60, 20], [100, 60]] as [$x, $y]) self::assertSame(imagecolorat($raw, $x, $y), imagecolorat($clean, $x, $y));
        $preview = imagecreatefromstring($result['thumbnail']);
        self::assertSame($orientation >= 5 ? 80 : 120, imagesx($preview));
        self::assertSame($orientation >= 5 ? 120 : 80, imagesy($preview));
        $colour = imagecolorat($preview, 20, 20);
        $actual = [($colour >> 16) & 255, ($colour >> 8) & 255, $colour & 255];
        foreach ($this->colours()[$corner] as $index => $expected) self::assertEqualsWithDelta($expected, $actual[$index], 20);
    }

    public function testBigEndianExifRetainsOrientationAndDiscardsGpsPayload(): void
    {
        $jpeg = $this->image('jpeg');
        $tiff = "MM\0\x2a" . pack('Nn', 8, 2) . pack('nnNn', 0x112, 3, 1, 6) . "\0\0"
            . pack('nnNN', 0x8825, 4, 1, 38) . pack('N', 0) . 'GPS-SECRET';
        $result = AttachmentImage::prepare(substr($jpeg, 0, 2) . $this->segment(0xe1, "Exif\0\0" . $tiff) . substr($jpeg, 2), 'image/jpeg');
        self::assertSame(6, $result['orientation']); self::assertStringNotContainsString('GPS-SECRET', $result['content']);
    }

    public function testPngMetadataIsRemovedWhilePixelsAndTransparencyArePreserved(): void
    {
        $png = $this->image('png');
        $offset = 33;
        $input = substr($png, 0, $offset) . $this->chunk('tEXt', "Location\0GPS-SECRET")
            . $this->chunk('eXIf', substr($this->exif(1), 10)) . substr($png, $offset);
        $result = AttachmentImage::prepare($input, 'image/png');
        self::assertStringNotContainsString('GPS-SECRET', $result['content']);
        $before = imagecreatefromstring($png); $after = imagecreatefromstring($result['content']);
        foreach ([[0, 0], [20, 20], [100, 60]] as [$x, $y]) self::assertSame(imagecolorat($before, $x, $y), imagecolorat($after, $x, $y));
        self::assertSame('image/jpeg', getimagesizefromstring($result['thumbnail'])['mime']);
    }

    public function testMalformedExifAndOversizedImagesAreRejectedInsteadOfLosingOrientation(): void
    {
        $jpeg = $this->image('jpeg');
        foreach (["\xff\xd8\xff\xe1\xff\xff", substr($jpeg, 0, 2) . $this->segment(0xe1, "Exif\0\0broken") . substr($jpeg, 2),
            substr($jpeg, 0, 2) . $this->exif(9) . substr($jpeg, 2), $jpeg . 'trailing payload'] as $invalid) {
            $this->reject(fn () => AttachmentImage::prepare($invalid, 'image/jpeg'));
        }
        $this->reject(fn () => AttachmentImage::prepare($jpeg, 'image/jpeg', 10));
        $png = $this->image('png'); $png[40] = chr(ord($png[40]) ^ 1);
        $this->reject(fn () => AttachmentImage::prepare($png, 'image/png'));
    }

    public function testThumbnailIsSmallerAndContainsNoSourceExif(): void
    {
        $image = imagecreatetruecolor(1200, 800); ob_start(); imagejpeg($image); $jpeg = ob_get_clean();
        $result = AttachmentImage::prepare($jpeg, 'image/jpeg');
        self::assertSame([480, 320], array_slice(getimagesizefromstring($result['thumbnail']), 0, 2));
        self::assertStringNotContainsString("Exif\0\0", $result['thumbnail']);
    }

    private function image(string $format): string
    {
        $image = imagecreatetruecolor(120, 80); imagesavealpha($image, true);
        foreach ($this->colours() as $i => [$red, $green, $blue]) {
            $x = ($i % 3) * 40; $y = intdiv($i, 3) * 40;
            imagefilledrectangle($image, $x, $y, $x + 39, $y + 39, imagecolorallocate($image, $red, $green, $blue));
        }
        imagesetpixel($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
        ob_start(); $format === 'jpeg' ? imagejpeg($image) : imagepng($image); return ob_get_clean();
    }
    private function colours(): array { return [[240, 20, 20], [20, 240, 20], [20, 20, 240], [240, 240, 20], [240, 20, 240], [20, 240, 240]]; }
    private function segment(int $marker, string $payload): string { return "\xff" . chr($marker) . pack('n', strlen($payload) + 2) . $payload; }
    private function chunk(string $type, string $payload): string { return pack('N', strlen($payload)) . $type . $payload . hash('crc32b', $type . $payload, true); }
    private function exif(int $orientation): string
    {
        return $this->segment(0xe1, "Exif\0\0II\x2a\0" . pack('Vv', 8, 2) . pack('vvVv', 0x112, 3, 1, $orientation) . "\0\0"
            . pack('vvVV', 0x8825, 4, 1, 38) . pack('V', 0) . 'GPS-SECRET');
    }
    private function reject(callable $operation): void
    {
        try { $operation(); self::fail('Malformed image accepted'); }
        catch (HttpException $error) { self::assertSame(422, $error->status); self::assertSame('invalid_file', $error->errorCode); }
    }
}
