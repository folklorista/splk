<?php

declare(strict_types=1);

// The hosting default is display_errors=1 (hosting doc chap. 3); errors must only reach the log.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header_remove('X-Powered-By');

require dirname(__DIR__) . '/vendor/autoload.php';

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Request;

try {
    $app = new App(Config::load(Config::defaultPath()));
} catch (\Throwable $e) {
    error_log((string) $e);
    (new HttpException(500, 'internal_error', 'Internal server error.'))->toResponse()->send();
    exit;
}

$app->handle(Request::fromGlobals())->send();
