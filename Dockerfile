# Lokální vývojové prostředí – na produkci Docker není (Apache 2.4 + PHP 8.5 + MariaDB 11.4),
# proto image napodobuje produkci: Angular build obsluhovaný Apachem s PHP.

FROM node:20-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci
COPY . .
RUN node scripts/sync-public.mjs && npm --prefix frontend run build

FROM php:8.5-apache
# mod_rewrite + AllowOverride kvůli SPA fallbacku v .htaccess, mod_headers kvůli cache hlavičkám service workeru
RUN a2enmod rewrite headers \
 && docker-php-ext-install pdo_mysql \
 && printf '<Directory /var/www/html>\n    AllowOverride All\n</Directory>\n' > /etc/apache2/conf-enabled/splk.conf
COPY --from=build /src/frontend/dist/frontend/browser/ /var/www/html/
