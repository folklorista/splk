# Local development image of the API – production has no Docker (Apache 2.4 + PHP 8.5 FPM + PostgreSQL 18),
# so the image mimics it: Apache with mod_rewrite serving public/ as the web root.
FROM php:8.5-apache

RUN a2enmod rewrite headers \
 && apt-get update && apt-get install -y --no-install-recommends libpq-dev unzip postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && docker-php-ext-install pdo_pgsql \
 && sed -ri 's!/var/www/html!/app/public!g' /etc/apache2/sites-available/000-default.conf \
 && printf '<Directory /app/public>\n    AllowOverride All\n    Require all granted\n</Directory>\n' > /etc/apache2/conf-enabled/splk-api.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
