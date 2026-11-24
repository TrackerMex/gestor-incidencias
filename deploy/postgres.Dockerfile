FROM postgres:17.12-bookworm
COPY deploy/postgres-init.sql /docker-entrypoint-initdb.d/01-gestor.sql
