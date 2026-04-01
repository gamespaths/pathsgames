FROM php:8.2-cli

WORKDIR /app

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
        unzip \
        && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo pdo_mysql

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copy dependency files first for layer caching
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --optimize-autoloader

# Copy source
COPY src/ ./src/
COPY public/ ./public/

# Expose port
EXPOSE 8042

# Run PHP built-in server
CMD ["php", "-S", "0.0.0.0:8042", "-t", "public"]
