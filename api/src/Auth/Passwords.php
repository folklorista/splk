<?php

declare(strict_types=1);

namespace Splk\Api\Auth;

use Splk\Api\Http\Input;

/** Argon2id hashing (D-12) and the minimal password rule. */
final class Passwords
{
    public const MIN_LENGTH = 10;
    public const MAX_LENGTH = 200;

    // Verified when the account does not exist, so a login takes the same time either way.
    private const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$NlY5cWNpUlBxNllOdXV2UA$bRotEkI7gdtzgMufbL3nAGWyPnAP89PkyBdVrfLFCYg';

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }

    public static function verify(string $password, ?string $hash): bool
    {
        return password_verify($password, $hash ?? self::DUMMY_HASH) && $hash !== null;
    }

    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID);
    }

    /** @throws \Splk\Api\Http\HttpException 422 when the new password is too short or too long */
    public static function assertAcceptable(string $field, string $password): void
    {
        if (mb_strlen($password) < self::MIN_LENGTH) {
            throw Input::invalid($field, 'password_too_short');
        }
        if (mb_strlen($password) > self::MAX_LENGTH) {
            throw Input::invalid($field, 'too_long');
        }
    }
}
