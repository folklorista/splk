<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use Splk\Api\App;
use Splk\Api\Config;
use Splk\Api\Http\Response;
use Splk\Api\Infrastructure\Db\Connection;
use Splk\Api\Infrastructure\Db\ConnectionFactory;
use Splk\Api\Tests\Support\RecordingMailer;

/** Committed fixtures in a disposable schema allow real concurrent transactions without leaking test data. */
final class InventoryConcurrencyTest extends ApiTestCase
{
    private string $schema;
    private PDO $other;
    private App $otherApp;
    private array $credentials;
    private int $fund;
    private int $person;
    private int $item;
    private int $kit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->db->rollBack();
        try {
            $this->schema = 'inventory_concurrency_' . bin2hex(random_bytes(8));
            $this->other = ConnectionFactory::create(self::settings((getenv('DB_NAME') ?: 'splk') . '_test'));
            $this->other->exec('CREATE SCHEMA ' . $this->schema);
            $this->other->exec('SET search_path TO ' . $this->schema . ', public');
            $files = glob(dirname(__DIR__, 2) . '/db/migrations/*.php');
            sort($files, SORT_STRING);
            foreach ($files as $file) {
                require_once $file;
                $name = basename($file, '.php');
                $class = str_replace(' ', '', ucwords(str_replace('_', ' ', substr($name, 15))));
                $migration = new $class('testing', (int) substr($name, 0, 14));
                $migration->setAdapter(new \Phinx\Db\Adapter\PostgresAdapter(['connection' => $this->other]));
                $migration->up();
            }
            $this->db->exec('SET search_path TO ' . $this->schema . ', public');
            $this->db->beginTransaction();
            $this->fund = $this->createUnit();
            $actor = $this->createAccount();
            $this->grant($actor, 'costumes.manage', $this->fund);
            $this->signInAs($actor);
            ['token' => $token, 'session' => $session] = $this->app->sessions()->create($actor, 'Concurrent PHPUnit');
            $this->credentials = ['token' => $token, 'csrf' => $session->csrfToken];
            $this->person = $this->insert("INSERT INTO persons (first_name, last_name) VALUES ('Concurrent', 'Holder')");
            $type = $this->insert("INSERT INTO costume_part_types (unit_id, name) VALUES ({$this->fund}, 'Shirt')");
            $series = $this->insert("INSERT INTO costume_series (unit_id, kind, name, part_type_id) VALUES ({$this->fund}, 'part', 'Shirts', $type)");
            $kitSeries = $this->insert("INSERT INTO costume_series (unit_id, kind, name) VALUES ({$this->fund}, 'kit', 'Kits')");
            $this->item = $this->insert("INSERT INTO costume_items (unit_id, series_id, number, location) VALUES ({$this->fund}, $series, '1', 'store')");
            $this->kit = $this->insert("INSERT INTO costume_kits (unit_id, series_id, number) VALUES ({$this->fund}, $kitSeries, 'K1')");
            $this->db->commit();
            $this->otherApp = new App(new Config(['cors' => ['allowedOrigins' => [self::ORIGIN]]]), Connection::fromPdo($this->other), new RecordingMailer());
            $this->db->exec("SET statement_timeout = '8s'");
            $this->other->exec("SET statement_timeout = '8s'");
        } catch (\Throwable $error) {
            $this->tearDown();
            throw $error;
        }
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        if (isset($this->other) && $this->other->inTransaction()) $this->other->rollBack();
        $this->db->exec('SET search_path TO public');
        $this->db->exec('SET statement_timeout = 30000');
        if (isset($this->schema)) $this->db->exec('DROP SCHEMA IF EXISTS ' . $this->schema . ' CASCADE');
    }

    public static function operations(): array
    {
        return ['item issue' => ['issue'], 'kit composition' => ['composition']];
    }

    #[DataProvider('operations')]
    public function testStartRejectsAnUncommittedOperationAndRetryFreezesTheCommittedResult(string $operation): void
    {
        [$path, $body, $status, $audit] = $this->operation($operation);
        $this->db->beginTransaction();
        self::assertStatus($status, $this->post($path, $body));
        self::assertSame(1, $this->auditCount($audit));
        // The other session sees neither the uncommitted operation nor a partial inventory.
        self::assertSame(0, (int) $this->other->query('SELECT count(*) FROM audit_log')->fetchColumn());
        self::assertError(409, 'inventory_busy', $this->otherStart());
        foreach (['inventories', 'inventory_targets', 'audit_log'] as $table) {
            self::assertSame(0, (int) $this->other->query("SELECT count(*) FROM $table")->fetchColumn(), $table);
        }
        // Issue first locks loan tables after item row locks. A failed freeze must release
        // its earlier SHARE locks, otherwise this later item UPDATE would form a lock cycle.
        $this->db->exec("SET LOCAL lock_timeout = '250ms'");
        $this->db->exec("UPDATE costume_items SET description = 'After rejected freeze' WHERE id = {$this->item}");
        $this->db->commit();
        $started = $this->otherStart();
        self::assertStatus(201, $started);
        $targets = $this->targets($started->decodedBody()['id']);
        $piece = $this->piece($targets);
        self::assertSame($operation === 'issue' ? $this->person : null, $piece['holderPersonId']);
        self::assertSame($operation === 'composition' ? $this->kit : null, $piece['snapshot']['kitId']);
        self::assertSame(1, $this->auditCount('inventory.create'));
        self::assertSame(1, (int) $this->db->query('SELECT count(*) FROM inventories')->fetchColumn());
        self::assertSame(2, count($targets));
    }

    #[DataProvider('operations')]
    public function testOperationWaitsForStartedInventoryAndDoesNotChangeItsFrozenTargets(string $operation): void
    {
        $this->db->beginTransaction();
        $started = $this->post($this->base(), ['name' => 'Before operation', 'scope' => (object) []]);
        self::assertStatus(201, $started);
        $id = $started->decodedBody()['id'];
        $before = $this->targets($id);
        [$path, $body, $status, $audit] = $this->operation($operation);
        $pipes = [];
        $process = proc_open([PHP_BINARY, dirname(__DIR__) . '/Support/inventory-concurrency-worker.php'],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        self::assertIsResource($process);
        try {
            fwrite($pipes[0], json_encode($this->credentials + ['settings' => self::settings((getenv('DB_NAME') ?: 'splk') . '_test'),
                'schema' => $this->schema, 'path' => $path, 'body' => $body], JSON_THROW_ON_ERROR));
            fclose($pipes[0]);
            stream_set_timeout($pipes[1], 10);
            $pid = (int) fgets($pipes[1]);
            self::assertGreaterThan(0, $pid);
            $mainPid = (int) $this->db->query('SELECT pg_backend_pid()')->fetchColumn();
            $deadline = microtime(true) + 4;
            $blocked = false;
            do {
                $blockers = $this->db->query("SELECT $mainPid = ANY(pg_blocking_pids($pid))")->fetchColumn();
                if ($blockers) { $blocked = true; break; }
                usleep(10000);
            } while (microtime(true) < $deadline);
            self::assertTrue($blocked, 'Writer must actually wait for the inventory transaction, not merely run afterwards.');
            self::assertSame(0, $this->auditCount($audit));
            $this->db->commit();
            $line = fgets($pipes[1]);
            self::assertNotFalse($line, stream_get_contents($pipes[2]));
            $result = json_decode($line, true, 64, JSON_THROW_ON_ERROR);
            self::assertSame($status, $result['status'], $line);
            self::assertSame($before, $this->targets($id));
            self::assertSame(1, $this->auditCount($audit));
            self::assertSame(1, $this->auditCount('inventory.create'));
            self::assertSame($operation === 'composition' ? $this->kit : null,
                $this->get('/v1/items/' . $this->item)->decodedBody()['kitId']);
            self::assertSame($operation === 'issue' ? ['personId' => $this->person] : null,
                $this->get('/v1/items/' . $this->item)->decodedBody()['holder']);
            fclose($pipes[1]); fclose($pipes[2]);
            self::assertSame(0, proc_close($process));
            $process = null;
        } finally {
            if ($this->db->inTransaction()) $this->db->rollBack();
            if (is_resource($process)) {
                proc_terminate($process);
                foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
                proc_close($process);
            }
        }
    }

    private function operation(string $operation): array
    {
        return $operation === 'issue'
            ? ["/v1/funds/{$this->fund}/loans", ['holder' => ['personId' => $this->person], 'items' => [$this->item]], 201, 'loan.issue']
            : ["/v1/kits/{$this->kit}/composition", ['version' => 1, 'action' => 'add', 'itemId' => $this->item, 'itemVersion' => 1], 200, 'kit.composition'];
    }

    private function otherStart(): Response
    {
        return $this->otherApp->handle(new \Splk\Api\Http\Request('POST', $this->base(),
            ['Origin' => self::ORIGIN, 'Content-Type' => 'application/json', 'X-CSRF-Token' => $this->credentials['csrf']],
            cookies: [self::COOKIE => $this->credentials['token']], body: json_encode(['name' => 'Concurrent', 'scope' => (object) []], JSON_THROW_ON_ERROR), clientIp: '192.0.2.1'));
    }

    private function targets(int $id): array { return $this->get("/v1/inventories/$id/targets")->decodedBody()['items']; }
    private function piece(array $targets): array { return array_values(array_filter($targets, fn (array $t): bool => $t['itemId'] === $this->item))[0]; }
    private function base(): string { return "/v1/funds/{$this->fund}/inventories"; }
    private function insert(string $sql): int { return (int) $this->db->query($sql . ' RETURNING id')->fetchColumn(); }
}
