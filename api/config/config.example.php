<?php

// Template of config/config.php on the hosting (uploaded once by hand, never overwritten by deploy, D-54).
// The real file is git-ignored. Local Docker uses config/config.docker.php instead.

return [
    'db' => [
        'host' => '',
        'port' => 5432,
        'database' => '',
        'user' => '',
        'password' => '',
        // the hosting reaches PostgreSQL over the provider's private network without TLS (hosting doc chap. 3)
        'sslmode' => 'disable',
    ],
    'app' => [
        // base URL for links in e-mails (password reset)
        'krojarkaUrl' => 'https://krojarka.vonica.cz',
    ],
    // SMTP of krojarka@vonica.cz (D-55)
    'mail' => [
        'transport' => 'smtp',
        'host' => 'smtp.websupport.cz',
        'port' => 465,
        'secure' => 'ssl',
        'username' => 'krojarka@vonica.cz',
        'password' => '',
        'from' => 'krojarka@vonica.cz',
        'fromName' => 'Krojařka',
    ],
    'cors' => [
        'allowedOrigins' => [
            'https://krojarka.vonica.cz',
        ],
    ],
    'session' => [
        'cookieName' => '__Host-vonica_sid',
        'cookieSecure' => true,
        'absoluteLifetime' => 30 * 24 * 3600,
        'idleTimeout' => 14 * 24 * 3600,
    ],
];
