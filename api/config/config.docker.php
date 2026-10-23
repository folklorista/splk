<?php

// Local Docker configuration (selected by SPLK_API_CONFIG in docker-compose.yml). No secrets: local database only.
// Plain HTTP on localhost, so the session cookie cannot use the __Host- prefix or Secure.

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'db',
        'port' => (int) (getenv('DB_PORT') ?: 5432),
        'database' => getenv('DB_NAME') ?: 'splk',
        'user' => getenv('DB_USER') ?: 'splk',
        'password' => getenv('DB_PASSWORD') ?: 'splk',
        'sslmode' => 'disable',
    ],
    'cors' => [
        'allowedOrigins' => [
            'http://localhost:4200',
        ],
    ],
    'session' => [
        'cookieName' => 'vonica_sid',
        'cookieSecure' => false,
        'absoluteLifetime' => 30 * 24 * 3600,
        'idleTimeout' => 14 * 24 * 3600,
    ],
];
