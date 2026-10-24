<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use Splk\Api\Http\HttpException;

/** D-65: keep compressed pixels and orientation, discard EXIF/XMP/IPTC and embedded previews. */
final class AttachmentImage
{
    /** @return array{content: string, thumbnail: string, orientation: int} */
    public static function prepare(string $content, string $mime, int $maxPixels = 24000000): array
    {
        $orientation = 1;
        $clean = match ($mime) {
            'image/jpeg' => self::jpeg($content, $orientation),
            'image/png' => self::png($content, $orientation),
            default => throw self::invalid(),
        };
        $size = @getimagesizefromstring($clean);
        if ($size === false || $size[0] <= 0 || $size[1] <= 0 || $size[0] * $size[1] > $maxPixels) throw self::invalid();
        $limit = trim((string) ini_get('memory_limit'));
        if (preg_match('/^(\d+)([KMG]?)$/iD', $limit, $parts)) {
            $bytes = (int) $parts[1] * match (strtoupper($parts[2])) { 'G' => 1073741824, 'M' => 1048576, 'K' => 1024, default => 1 };
            // Rotation can temporarily retain two GD buffers; fail before allocating either.
            if (memory_get_usage(true) + strlen($content) * 3 + $size[0] * $size[1] * 12 + 16777216 > $bytes) throw self::invalid();
        }
        $image = @imagecreatefromstring($clean);
        if ($image === false) throw self::invalid();
        if (in_array($orientation, [2, 5, 7], true)) imageflip($image, IMG_FLIP_HORIZONTAL);
        if ($orientation === 4) imageflip($image, IMG_FLIP_VERTICAL);
        $angle = match ($orientation) { 3 => 180, 5, 8 => 90, 6, 7 => -90, default => 0 };
        if ($angle !== 0) $image = imagerotate($image, $angle, 0);
        $width = imagesx($image); $height = imagesy($image);
        $scale = min(1, 480 / max($width, $height));
        $thumbnail = imagecreatetruecolor(max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)));
        imagefill($thumbnail, 0, 0, imagecolorallocate($thumbnail, 255, 255, 255));
        imagecopyresampled($thumbnail, $image, 0, 0, 0, 0, imagesx($thumbnail), imagesy($thumbnail), $width, $height);
        ob_start();
        try { imagejpeg($thumbnail, null, 85); $preview = ob_get_contents(); }
        finally { ob_end_clean(); }
        if (!is_string($preview) || $preview === '') throw self::invalid();
        return ['content' => $clean, 'thumbnail' => $preview, 'orientation' => $orientation];
    }

    private static function jpeg(string $data, int &$orientation): string
    {
        if (!str_starts_with($data, "\xff\xd8")) throw self::invalid();
        $output = ''; $offset = 2; $length = strlen($data); $seenOrientation = null; $scan = false;
        while ($offset < $length) {
            if (ord($data[$offset]) !== 255) throw self::invalid();
            while ($offset < $length && ord($data[$offset]) === 255) $offset++;
            if ($offset >= $length) throw self::invalid();
            $marker = ord($data[$offset++]);
            if ($marker === 0xd9) {
                if (!$scan || $offset !== $length) throw self::invalid();
                $orientation = $seenOrientation ?? 1;
                $exif = self::orientationTiff($orientation);
                return "\xff\xd8\xff\xe1" . pack('n', strlen($exif) + 8) . "Exif\0\0" . $exif . $output . "\xff\xd9";
            }
            if ($marker === 0 || $marker === 0xd8 || ($marker >= 0xd0 && $marker <= 0xd7) || $offset + 2 > $length) throw self::invalid();
            $size = unpack('n', substr($data, $offset, 2))[1];
            if ($size < 2 || $offset + $size > $length) throw self::invalid();
            $payload = substr($data, $offset + 2, $size - 2);
            if ($marker === 0xe1 && str_starts_with($payload, "Exif\0\0")) self::readOrientation(substr($payload, 6), $seenOrientation);
            // APP0/APP2/APP14 preserve JFIF, colour profiles and Adobe colour transforms.
            if (!in_array($marker, [0xe1, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xef, 0xfe], true)) {
                $output .= "\xff" . chr($marker) . substr($data, $offset, $size);
            }
            $offset += $size;
            if ($marker !== 0xda) continue;
            $scan = true; $start = $offset;
            while ($offset < $length) {
                if (ord($data[$offset]) !== 255) { $offset++; continue; }
                $next = $offset + 1;
                while ($next < $length && ord($data[$next]) === 255) $next++;
                if ($next >= $length) throw self::invalid();
                $code = ord($data[$next]);
                if ($code === 0 || ($code >= 0xd0 && $code <= 0xd7)) { $offset = $next + 1; continue; }
                break;
            }
            $output .= substr($data, $start, $offset - $start);
        }
        throw self::invalid();
    }

    private static function png(string $data, int &$orientation): string
    {
        $signature = "\x89PNG\r\n\x1a\n";
        if (!str_starts_with($data, $signature)) throw self::invalid();
        $output = $signature; $offset = 8; $length = strlen($data); $seenOrientation = null;
        while ($offset + 12 <= $length) {
            $size = unpack('N', substr($data, $offset, 4))[1];
            if ($size > $length - $offset - 12) throw self::invalid();
            $type = substr($data, $offset + 4, 4); $payload = substr($data, $offset + 8, $size);
            if (hash('crc32b', $type . $payload, true) !== substr($data, $offset + 8 + $size, 4)) throw self::invalid();
            if ($type === 'eXIf') self::readOrientation($payload, $seenOrientation);
            if (!in_array($type, ['eXIf', 'tEXt', 'zTXt', 'iTXt'], true) && $type !== 'IEND') $output .= substr($data, $offset, $size + 12);
            $offset += $size + 12;
            if ($type === 'IEND') {
                if ($size !== 0 || $offset !== $length) throw self::invalid();
                $orientation = $seenOrientation ?? 1;
                // Keep eXIf before IDAT for readers that expect metadata ahead of image data.
                $headerEnd = 8 + 12 + unpack('N', substr($output, 8, 4))[1];
                return substr($output, 0, $headerEnd) . self::pngChunk('eXIf', self::orientationTiff($orientation))
                    . substr($output, $headerEnd) . self::pngChunk('IEND', '');
            }
        }
        throw self::invalid();
    }

    private static function readOrientation(string $tiff, ?int &$seen): void
    {
        $little = str_starts_with($tiff, "II\x2a\0");
        if (!$little && !str_starts_with($tiff, "MM\0\x2a")) throw self::invalid();
        $read = static function (int $offset, int $size) use ($tiff, $little): int {
            if ($offset < 0 || $offset + $size > strlen($tiff)) throw self::invalid();
            return unpack($size === 2 ? ($little ? 'v' : 'n') : ($little ? 'V' : 'N'), substr($tiff, $offset, $size))[1];
        };
        $offset = $read(4, 4);
        if ($offset < 8) throw self::invalid();
        $count = $read($offset, 2);
        if ($offset + 2 + $count * 12 + 4 > strlen($tiff)) throw self::invalid();
        for ($i = 0; $i < $count; $i++) {
            $entry = $offset + 2 + $i * 12;
            if ($read($entry, 2) !== 0x112) continue;
            if ($read($entry + 2, 2) !== 3 || $read($entry + 4, 4) !== 1) throw self::invalid();
            $value = $read($entry + 8, 2);
            if ($value < 1 || $value > 8 || ($seen !== null && $seen !== $value)) throw self::invalid();
            $seen = $value;
        }
    }

    private static function orientationTiff(int $value): string
    {
        return "II\x2a\0" . pack('Vv', 8, 1) . pack('vvVv', 0x112, 3, 1, $value) . "\0\0" . pack('V', 0);
    }
    private static function pngChunk(string $type, string $data): string { return pack('N', strlen($data)) . $type . $data . hash('crc32b', $type . $data, true); }
    private static function invalid(): HttpException { return new HttpException(422, 'invalid_file', 'The image is unsupported, malformed or exceeds the pixel limit.'); }
}
