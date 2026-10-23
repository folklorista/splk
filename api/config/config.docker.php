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
    'app' => [
        'krojarkaUrl' => 'http://localhost:4200',
    ],
    // e-mails are written to the log (docker compose logs api); MAIL_TRANSPORT=smtp sends them for real
    'mail' => [
        'transport' => getenv('MAIL_TRANSPORT') ?: 'log',
        'host' => getenv('MAIL_SMTP_HOST') ?: 'smtp.websupport.cz',
        'port' => (int) (getenv('MAIL_SMTP_PORT') ?: 465),
        'secure' => 'ssl',
        'username' => getenv('MAIL_USERNAME') ?: '',
        'password' => getenv('MAIL_PASSWORD') ?: '',
        'from' => getenv('MAIL_USERNAME') ?: 'krojarka@vonica.cz',
        'fromName' => 'Krojařka',
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
