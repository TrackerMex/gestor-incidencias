\getenv app_password GESTOR_DB_PASSWORD
CREATE ROLE gestor LOGIN PASSWORD :'app_password';
ALTER DATABASE gestor OWNER TO gestor;
