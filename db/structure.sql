CREATE DATABASE `splk` COLLATE utf8mb4_czech_ci;




CREATE USER 'splk' @'localhost' IDENTIFIED BY 'splk';




GRANT ALL PRIVILEGES ON `splk`.* TO 'splk' @'localhost';
-- Adminer 4.8.1 MySQL 10.6.12-MariaDB-0ubuntu0.22.04.1 dump




SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';




SET NAMES utf8mb4;




CREATE TABLE `group` (
`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
`name` varchar(64) NOT NULL COMMENT 'název',
`description` varchar(256) DEFAULT NULL COMMENT 'popis',
`group_id` int(11) DEFAULT NULL COMMENT 'ID rodiče',
`sort` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'řazení',
`created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'datum založení',
`updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() COMMENT 'datum změny',
UNIQUE KEY `group_id_name` (`group_id`,`name`),
KEY `sort` (`sort`),
CONSTRAINT `group_group_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `group` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='skupina';




INSERT INTO `group` (`id`, `name`, `description`, `group_id`) VALUES
(1, 'Vonica', 'hlavní skupina pro všechny Voničáře, zdejší akce uvidí jak ti současní, tak i bývalí členové', NULL),
(2, 'aktivní členové', 'pro všechny, kdo chodí na nácviky a vystoupení', 1),
(3, 'taneční složka', 'tanečníci a tanečnice', 2),
(4, 'Denica', 'cimbálová muzika', 2),
(5, 'tanečníci', 'pouze chlapi', 3),
(6, 'tanečnice', 'pouze holky', 3),
(7, 'výbor', NULL, 1);




CREATE TABLE `place` (
`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
`name` varchar(64) NOT NULL COMMENT 'název',
`description` varchar(256) DEFAULT NULL COMMENT 'popis',
`gps_lat` decimal(9,7) DEFAULT NULL COMMENT 'GPS souřadnice (lat)',
`gps_lon` decimal(9,7) DEFAULT NULL COMMENT 'GPS souřadnice (lon)',
`created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'datum založení',
`updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() COMMENT 'datum změny',
UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='umístění';




INSERT INTO `place` (`id`, `name`, `gps_lat`, `gps_lon`) VALUES
(1, 'ZK204 (taneční sál)', '49.2251697', '17.6656944'),
(2, 'ZK204 (velký sklad)', '49.2251697', '17.6656944'),
(3, 'Malá scéna (hlavní sál)', '49.2248428', '17.6798644'),
(4, 'Městské divadlo Zlín', '49.2252325', '17.6693881'),
(5, 'Náměstí Míru, Zlín', '49.2268381', '17.6669333');




CREATE TABLE `event` (
`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
`name` varchar(64) NOT NULL COMMENT 'název',
`description` varchar(256) DEFAULT NULL COMMENT 'popis',
`group_id` int(11) DEFAULT NULL COMMENT 'ID skupiny',
`place_id` int(11) DEFAULT NULL COMMENT 'ID umístění',
`starts_at` timestamp NULL DEFAULT NULL COMMENT 'datum začátku',
`ends_at` timestamp NULL DEFAULT NULL COMMENT 'datum konce',
`created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'datum založení',
`updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() COMMENT 'datum změny',
KEY `starts_at` (`starts_at`),
CONSTRAINT `event_group_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `group` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
CONSTRAINT `event_place_ibfk_2` FOREIGN KEY (`place_id`) REFERENCES `place` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='událost';




INSERT INTO `event` (`id`, `name`, `description`, `group_id`, `place_id`, `starts_at`, `ends_at`) VALUES
(1, 'Výročí děvčice', '20. výročí děvčic\n15:40-15:50 prostorovka\n 17:00-18:00 vystoupení\nObtáčaná+Hrozenská, Zálesí I., spol.závěr sedlácké', 2, 3, '2023-11-04 15:40:00', '2023-11-04 18:00:00'),
(2, 'pravidelný nácvik', 'Obtáčaná+Hrozenská a Zálesí I.\nPozor, končíme už ve 21:00', 3, 1, '2023-10-20 19:15:00', '2023-10-20 21:00:00'),
(3, 'pravidelný nácvik', 'Obtáčaná+Hrozenská a Zálesí I., zpěvy Sedlácké', 3, 1, '2023-10-24 19:00:00', '2023-10-24 21:00:00'),
(4, 'pravidelný nácvik', 'Obtáčaná+Hrozenská a Zálesí I.', 3, 1, '2023-10-27 19:15:00', '2023-10-27 21:30:00'),
(5, 'schůze výboru', NULL, 7, 2, '2023-10-27 19:15:00', '2023-10-27 21:30:00'),
(6, 'vystoupení Kašava+Vonica+Bartošák', 'dvě vystoupení ve 14h v 18h', 2, 3, '2024-04-21 14:00:00', '2024-04-21 21:00:00');




CREATE TABLE `user` (
`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
`email` varchar(256) NOT NULL COMMENT 'e-mail',
`password` varchar(256) NOT NULL COMMENT 'přihlašovací heslo',
`first_name` VARCHAR(64) NOT NULL COMMENT 'křestní jméno',
`last_name` VARCHAR(64) NOT NULL COMMENT 'příjmení',
`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE = 'InnoDB' DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='uživatel';




INSERT INTO
`user` (`id`, `last_name`,  `first_name`, `email`, `password`)
VALUES
(1, 'Čermáková',    'Jana', 'cermakovaJ@vonica.cz', 'cermakova'),
(2, 'Dokoupilová',  'Veronika', 'dokoupilovaV@vonica.cz',   'dokoupilova'),
(3, 'Doleželová',   'Adéla',    'dolezelovaA@vonica.cz',    'dolezelova'),
(4, 'Foukalová',    'Kateřina', 'foukalovaK@vonica.cz', 'foukalova'),
(5, 'Guzman',   'Emily',    'guzmanE@vonica.cz',    'guzman'),
(6, 'Hornáčková',   'Hana', 'hornackovaH@vonica.cz',    'hornackova'),
(7, 'Hornáčková',   'Tereza',   'hornackovaT@vonica.cz',    'hornackova'),
(8, 'Hutěčková',    'Eliška',   'huteckovaE@vonica.cz', 'huteckova'),
(9, 'Konečná',  'Petra',    'konecnaP@vonica.cz',   'konecna'),
(10, 'Krunertová',  'Anita',    'krunertovaA@vonica.cz',    'krunertova'),
(11, 'Machová', 'Helena',   'machovaH@vonica.cz',   'machova'),
(12, 'Machová', 'Vendula',  'machovaV@vonica.cz',   'machova'),
(13, 'Poláchová',   'Berenika', 'polachovaB@vonica.cz', 'polachova'),
(14, 'Prucková',    'Tereza',   'pruckovaT@vonica.cz',  'pruckova'),
(15, 'Škubalová',   'Lucie',    'skubalovaL@vonica.cz', 'skubalova'),
(16, 'Trvajová',    'Marcela',  'trvajovaM@vonica.cz',  'trvajova'),
(17, 'Urbanová',    'Marcela',  'urbanovaM@vonica.cz',  'urbanova'),
(18, 'Zelinková',   'Anna', 'zelinkovaA@vonica.cz', 'zelinkova'),
(19, 'Zelinková',   'Lucie',    'zelinkovaL@vonica.cz', 'zelinkova'),
(20, 'Šimková', 'Veronika', 'simkovaV@vonica.cz',   'simkova'),
(21, 'Jevická', 'Tereza',   'jevickaT@vonica.cz',   'jevicka'),
(22, 'Krzyžánková', 'Jana', 'krzyzankovaJ@vonica.cz',   'krzyzankova'),
(23, 'Lattenbergová',   'Dana', 'lattenbergovaD@vonica.cz', 'lattenbergova'),
(24, 'Dokoupil',    'Jakub',    'dokoupilJ@vonica.cz',  'dokoupil'),
(25, 'Kučera',  'Ondra',    'kuceraO@vonica.cz',    'kucera'),
(26, 'Mořingl', 'Petr', 'moringlP@vonica.cz',   'moringl'),
(27, 'Musil',   'Michal',   'musilM@vonica.cz', 'musil'),
(28, 'Nguyen',  'Petr', 'nguyenP@vonica.cz',    'nguyen'),
(29, 'Prokop',  'Jaromír',  'prokopJ@vonica.cz',    'prokop'),
(30, 'Škubal',  'Stanislav',    'skubalS@vonica.cz',    'skubal'),
(31, 'Vančura', 'Lukáš',    'vancuraL@vonica.cz',   'vancura'),
(32, 'Verner',  'Tomáš',    'vernerT@vonica.cz',    'verner'),
(33, 'Vrba',    'Pavel',    'vrbaP@vonica.cz',  'vrba');


CREATE TABLE `user_group` (
`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
`user_id` int NOT NULL,
`group_id` int NOT NULL,
`is_admin` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'je administrátorem',
`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP,
FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
FOREIGN KEY (`group_id`) REFERENCES `group` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
UNIQUE KEY `user_id_group_id_ibfk_1` (`user_id`, `group_id`)
) ENGINE = 'InnoDB';




-- všichni
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 1 as group_id FROM user;


-- aktivní členové
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 2 as group_id FROM user WHERE user.id <= 32;


-- taneční složka
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 3 as group_id FROM user WHERE user.id <= 32;


-- tanečníci
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 5 as group_id FROM user WHERE user.id > 23 AND user.id <= 32;


-- tanečnice
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 6 as group_id FROM user WHERE user.id <= 23;


-- výbor
INSERT INTO
`user_group` (`user_id`, `group_id`)
SELECT id as user_id, 7 as group_id FROM user WHERE user.last_name IN ('Dokoupilová', 'Hornáčková', 'Konečná', 'Škubalová', 'Urbanová', 'Jevická', 'Lattenbergová', 'Dokoupil', 'Musil', 'Škubal', 'Vančura');


CREATE TABLE `user_event` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `attendance` enum('yes','no','other') COLLATE utf8mb4_czech_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY `user_id` (`user_id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `user_event_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_event_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `event` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;




CREATE TABLE `log_action` (
`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
`name` varchar(30) NOT NULL,
`description` varchar(200) NULL,
`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE = 'InnoDB';




CREATE TABLE `log_event` (
`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
`id_user` int NOT NULL,
`id_action` int NOT NULL,
`data` json NULL,
`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`updated_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP,
FOREIGN KEY (`id_user`) REFERENCES `user` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
FOREIGN KEY (`id_action`) REFERENCES `log_action` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE = 'InnoDB';




INSERT INTO
`log_action` (`name`, `description`)
VALUES
('user.login', 'Přihlášení uživatele do systému'),
('user.logout', 'Odhlášení uživatele ze systému');



