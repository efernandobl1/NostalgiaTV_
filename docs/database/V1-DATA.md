# Migrar los datos de v1 a la base v2

`InitialCreate` crea una base v2 vacía. Para conservar el catálogo y la audiencia
de producción se genera un script de `INSERT` desde una **copia restaurada** de la
base v1 y se ejecuta una sola vez sobre la base v2 recién creada.

El generador es [`deploy/v1-migration/generate_inserts.py`](../../deploy/v1-migration/generate_inserts.py).

## Qué se migra

| Se migra | No se migra |
| --- | --- |
| Categorías, series, temporadas y sus categorías | Usuarios (v2 crea un `admin` nuevo) |
| Episodios (rutas `/uploads/...`, parte A/B detectada del nombre) | Refresh tokens |
| Canales, eras, series y temporadas de cada era, selecciones | Registro de actividad |
| Ajustes de la plataforma y política de CPU | Trabajos de medios |
| Perfiles, dispositivos vigentes, progreso y rangos vistos | Programación generada (se regenera) |

- Se conservan los identificadores originales: los enlaces, los dispositivos
  emparejados y las carpetas `series/<nombre>-<id>` siguen siendo válidos.
- Los episodios duplicados (misma serie, temporada, tipo, número y parte) se
  reducen a uno; el disponible gana al no disponible y su progreso se reasigna.
- Los perfiles enlazados al administrador de v1 se enlazan al `admin` de v2.
  Los dispositivos de ese perfil siguen activos; los de perfiles anónimos también.
- `Series.FolderPath` y `ChannelEras.FolderPath` se copian tal cual
  (`/app/wwwroot/uploads/...`). Es la misma raíz de medios que usa v2 en el
  contenedor, así que «Escanear carpeta» funciona sobre las carpetas existentes.

## Archivos sensibles

El `.bak` y el `.sql` generado contienen perfiles, hashes de tokens de
dispositivos y datos de audiencia. No se suben al repositorio ni se comparten.
Borrarlos al terminar, junto con la copia restaurada de v1.

## Procedimiento en producción

Seguir este orden. Los pasos 1 y 4 a 6 son los de [RESET.md](RESET.md).

1. **Backup verificado** en la VPS, inmediatamente antes del reset (los datos
   se copian de este backup; lo que cambie después se pierde):

   ```bash
   sudo python3 deploy/manage.py backup /opt/nostalgiatv
   ```

   Extraer la base y dejarla legible para descargarla:

   ```bash
   sudo tar -xf /opt/nostalgiatv/backups/<fecha>.tar -C ~ database.bak
   sudo chown "$USER": ~/database.bak && chmod 600 ~/database.bak
   ```

2. **Restaurar una copia local** (Windows, SQL Server Express) después de
   descargar `database.bak`, por ejemplo a `C:\Users\Public\Documents\ntv-restore\`
   (carpeta legible por el servicio de SQL Server). Consultar los nombres
   lógicos y restaurar con otro nombre:

   ```powershell
   sqlcmd -S "localhost\SQLEXPRESS" -E -C -Q "RESTORE FILELISTONLY FROM DISK=N'C:\Users\Public\Documents\ntv-restore\database.bak'"
   sqlcmd -S "localhost\SQLEXPRESS" -E -C -Q "RESTORE DATABASE [NostalgiaTV_v1_copy] FROM DISK=N'C:\Users\Public\Documents\ntv-restore\database.bak' WITH MOVE N'<datos>' TO N'C:\Users\Public\Documents\ntv-restore\v1_copy.mdf', MOVE N'<log>' TO N'C:\Users\Public\Documents\ntv-restore\v1_copy.ldf', RECOVERY"
   ```

3. **Generar el script**:

   ```powershell
   $env:PYTHONIOENCODING = "utf-8"
   python deploy/v1-migration/generate_inserts.py --server "localhost\SQLEXPRESS" --database NostalgiaTV_v1_copy --out "$HOME\Documents\NostalgiaTV_v1_to_v2_data.sql"
   ```

   El resumen final muestra cuántas filas se insertan por tabla y qué
   duplicados se descartaron. Revisarlo antes de seguir.

4. **Reset de la base** según [RESET.md](RESET.md) (pasos 2 a 5): detener los
   servicios, recrear la base vacía, recrear los usuarios SQL y definir un
   `BOOTSTRAP_ADMIN_PASSWORD` nuevo.

5. **Fusionar a `main`**. El despliegue aplica `InitialCreate`, crea el `admin`
   y arranca la API con el catálogo vacío.

6. **Aplicar los datos** en cuanto termine el despliegue. Subir el script
   (`scp ... NostalgiaTV_v1_to_v2_data.sql <usuario>@<vps>:~/`) y ejecutarlo con
   los servicios que escriben detenidos:

   ```bash
   cd /opt/nostalgiatv
   sudo docker compose stop webapp webapi media-worker
   sudo docker compose exec -T sqlserver /bin/bash -lc \
     'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -Nm -C -b -f 65001 -d NostalgiaTV' \
     < ~/NostalgiaTV_v1_to_v2_data.sql
   sudo docker compose up -d --wait
   ```

   El script corre en una sola transacción: ante cualquier error no deja nada
   a medias. Se niega a correr si ya hay series, canales o perfiles
   (`Msg 50000`) o si no existe el `admin` (`Msg 50001`). Si alguien abrió el
   sitio entre los pasos 5 y 6 y creó un perfil, repetir el reset (pasos 3 a 5
   de RESET.md y `sudo docker compose run --rm --no-deps migrate`) y volver a
   este paso.

7. **Después**:
   - Quitar `BOOTSTRAP_ADMIN_PASSWORD` del `.env`.
   - Entrar al panel con el `admin` nuevo y usar «Escanear carpeta» en cada
     serie para importar los videos que estén en disco y no en la base (por
     ejemplo, temporadas copiadas pero nunca importadas).
   - Borrar `~/database.bak`, `~/NostalgiaTV_v1_to_v2_data.sql`, la copia local
     y la base `NostalgiaTV_v1_copy`.

## Probar antes en local

Restaurar la copia v1 (paso 2), crear una base v2 vacía con el migrador y
aplicar el script con `sqlcmd -S "localhost\SQLEXPRESS" -E -C -b -f 65001 -d <base v2> -i <script>`.
Luego arrancar la API contra esa base y revisar series, episodios, canales y
perfiles desde el panel.
