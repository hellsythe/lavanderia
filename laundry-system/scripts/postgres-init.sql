-- Init script para LavanderPro
-- Se ejecuta la primera vez que se crea el volumen (Postgres 16+).
-- Crea extensiones recomendadas; las tablas las maneja TypeORM migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext"; -- case-insensitive email