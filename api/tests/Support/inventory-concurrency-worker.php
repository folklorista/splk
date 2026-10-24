<?php

declare(strict_types=1);

use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Request;
use Splk\Api\Infrastructure\Db\Connection;
use Splk\Api\Infrastructure\Db\ConnectionFactory;
use Splk\Api\Tests\Support\RecordingMailer;

require dirname(__DIR__, 2) . '/vendor/autoload.php';

// Only the isolated schema in the local PHPUnit database is reachable by this worker.
$input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
if (!str_ends_with($input['settings']['database'], '_test') || !preg_match('/^inventory_concurrency_[a-f0-9]+$/D', $input['schema'])) {
    throw new RuntimeException('Invalid concurrency test destination.');
}
$db = ConnectionFactory::create($input['settings']);
$db->exec('SET search_path TO ' . $input['schema'] . ', public');
$db->exec("SET statement_timeout = '8s'");
$app = new App(new Config(['cors' => ['allowedOrigins' => ['https://krojarka.vonica.cz']]]), Connection::fromPdo($db), new RecordingMailer());
echo $db->query('SELECT pg_backend_pid()')->fetchColumn() . "\n";
flush();
$response = $app->handle(new Request('POST', $input['path'], [
    'Origin' => 'https://krojarka.vonica.cz', 'Content-Type' => 'application/json', 'X-CSRF-Token' => $input['csrf'],
], cookies: ['__Host-vonica_sid' => $input['token']], body: json_encode($input['body'], JSON_THROW_ON_ERROR), clientIp: '192.0.2.1'));
echo json_encode(['status' => $response->status, 'body' => $response->decodedBody()], JSON_THROW_ON_ERROR) . "\n";
