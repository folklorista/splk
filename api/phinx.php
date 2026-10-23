<?php

// Phinx runs only from the developer machine (PHP in Docker), never on an HTTP request (D-45).
//   development – local Docker database (DB_* from docker-compose.yml)
//   testing     – <DB_NAME>_test, created and migrated by the integration tests
//   production  – hosting database over TLS (PG_* from the root .env, home IP allowed by D-13)

$local = static fn (string $suffix = ''): array => [
    'adapter' => 'pgsql',
    'host' => getenv('DB_HOST') ?: 'db',
    'port' => (int) (getenv('DB_PORT') ?: 5432),
    'name' => (getenv('DB_NAME') ?: 'splk') . $suffix,
    'user' => getenv('DB_USER') ?: 'splk',
    'pass' => getenv('DB_PASSWORD') ?: 'splk',
    'charset' => 'utf8',
];

return [
    'paths' => [
        'migrations' => __DIR__ . '/db/migrations',
        'seeds' => __DIR__ . '/db/seeds',
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'development',
        'development' => $local(),
        'testing' => $local('_test'),
        'production' => [
            'adapter' => 'pgsql',
            // Phinx has no DSN options for pgsql; pdo_pgsql turns ";key=value" into a libpq parameter, so TLS is enforced here
            'host' => (getenv('PG_HOST') ?: '') . ';sslmode=require',
            'port' => (int) (getenv('PG_PORT') ?: 5432),
            'name' => getenv('PG_DATABASE') ?: '',
            'user' => getenv('PG_USER') ?: '',
            'pass' => getenv('PG_PASSWORD') ?: '',
            'charset' => 'utf8',
        ],
    ],
    'version_order' => 'creation',
];
