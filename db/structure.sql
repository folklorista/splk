CREATE DATABASE `splk` COLLATE utf8mb4_czech_ci;

GRANT ALL PRIVILEGES ON `splk`.* TO `splk` @localhost;

CREATE TABLE `auth.role` (
    `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` varchar(30) NOT NULL,
    `description` varchar(200) NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE = 'InnoDB';

INSERT INTO
    `auth.role` (`name`, `description`)
VALUES
    ('superadmin', 'superadministrátor'),
    ('admin', 'administrátor'),
    ('user', 'uživatel');

CREATE TABLE `auth.user` (
    `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username` varchar(30) NOT NULL,
    `password` varchar(100) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE = 'InnoDB';

INSERT INTO
    `auth.user` (`username`, `password`)
VALUES
    ('superadmin1', 'superadmin1'),
    ('admin1', 'admin1'),
    ('user1', 'user1');

CREATE TABLE `auth.user×role` (
    `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_user` int NOT NULL,
    `id_role` int NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`id_user`) REFERENCES `auth.user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`id_role`) REFERENCES `auth.role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY `id_user_id_role` (`id_user`, `id_role`)
) ENGINE = 'InnoDB';

INSERT INTO
    `auth.user×role` (`id_user`, `id_role`)
VALUES
    (1, 1),
    (2, 2),
    (2, 3),
    (3, 3);

CREATE TABLE `log.action` (
    `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` varchar(30) NOT NULL,
    `description` varchar(200) NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE = 'InnoDB';

CREATE TABLE `log.event` (
    `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_user` int NOT NULL,
    `id_action` int NOT NULL,
    `data` json NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`id_user`) REFERENCES `auth.user` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
    FOREIGN KEY (`id_action`) REFERENCES `log.action` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE = 'InnoDB';

INSERT INTO
    `log.action` (`name`, `description`)
VALUES
    ('user.login', 'Přihlášení uživatele do systému'),
    ('user.logout', 'Odhlášení uživatele ze systému');