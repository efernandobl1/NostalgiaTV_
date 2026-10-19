# Reset de la base de datos para el esquema v2

El backend v2 usa una única migración `InitialCreate` generada desde
[`nostalgiatv_v2.dbml`](nostalgiatv_v2.dbml). La migración no convierte los datos
del esquema v1. Para conservar catálogo, canales y audiencia, seguir
[V1-DATA.md](V1-DATA.md), que genera un script de datos desde un backup v1 y lo
aplica después del reset. Usuarios, comentarios y registros de actividad no se
conservan.

## Qué hace la migración automática

`--migrate` (servicio `migrate`) y el arranque en desarrollo comparan las
migraciones aplicadas con las del código:

- Base vacía: crea el esquema v2, los datos semilla y, con
  `BootstrapAdminPassword`, inicializa la cuenta `admin`.
- Base con migraciones v1: se detiene con un error que apunta a este documento.
  **No modifica ni borra nada.**

Borrar la base de producción es irreversible. Nunca se automatiza: lo hace una
persona, después de verificar un backup.

## Producción (VPS)

Hacer esto **antes** de fusionar a `main`, porque el merge despliega
automáticamente y `manage.py update` detiene la API antes de migrar: con una
base v1 el sitio queda detenido hasta completar el reset.

1. Backup verificado (base, medios y configuración):

   ```bash
   sudo python3 deploy/manage.py backup /opt/nostalgiatv
   ```

2. Detener los servicios que escriben:

   ```bash
   sudo docker compose --project-directory /opt/nostalgiatv stop webapp webapi media-worker
   ```

3. Recrear la base vacía desde el contenedor de SQL Server. El comando no pide
   confirmación: revisar la ruta y el nombre de la base antes de ejecutarlo.

   ```bash
   sudo docker compose --project-directory /opt/nostalgiatv exec sqlserver \
     /bin/bash -lc 'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b \
     -Q "ALTER DATABASE [NostalgiaTV] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [NostalgiaTV]; CREATE DATABASE [NostalgiaTV];"'
   ```

4. Volver a crear los usuarios de base de datos `nostalgia_app` y
   `nostalgia_migrator` dentro de la base nueva. `manage.py` los provisiona
   desde `.env`; ejecutar su función `provision_logins` (o repetir las sentencias
   `CREATE USER ... FOR LOGIN` y `ALTER ROLE` que contiene).

5. Definir una contraseña nueva y única en `BOOTSTRAP_ADMIN_PASSWORD` dentro de
   `/opt/nostalgiatv/.env`. La contraseña anterior del administrador está
   comprometida y no debe reutilizarse.

6. Fusionar a `main`. El despliegue aplica `InitialCreate` sobre la base vacía y
   arranca la API. Después, quitar `BOOTSTRAP_ADMIN_PASSWORD` del `.env`.

7. Si se conservan los datos de v1, aplicar el script en cuanto termine el
   despliegue ([V1-DATA.md](V1-DATA.md), paso 6).

## Medios existentes

Los archivos en `uploads/` se conservan. Con [V1-DATA.md](V1-DATA.md) las series
mantienen su identificador y su carpeta, así que los episodios siguen vinculados.
Sin migrar los datos, las carpetas antiguas no se vinculan solas: crear la serie
de nuevo, mover sus videos a la carpeta que crea el panel (`season N`,
`specials`, `movies`) y usar «Escanear carpeta».

## Desarrollo local

Usar otra base (por ejemplo `NostalgiaTV_v2`) en
`appsettings.Local.json` o borrar la base local de desarrollo. La API aplica la
migración al arrancar en `Development`.
