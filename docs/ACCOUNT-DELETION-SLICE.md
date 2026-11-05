# Eliminación de cuenta y datos

## Flujo

1. La persona abre **Cuenta → Ajustes → Eliminar cuenta y datos**, lee el alcance y escribe `BORRAR MI CUENTA`.
2. El servidor comprueba la sesión de Clerk, el origen de la solicitud y una verificación reciente estricta. Valida la frase exacta en el servidor.
3. Se registra una solicitud única en `account_deletions`. Desde entonces, las mutaciones ordinarias reciben HTTP 409.
4. Una transacción elimina notas, tareas, eventos, metas, áreas, personas, lugares y el perfil. Las tablas dependientes se eliminan por claves foráneas. El trabajo pasa a `data_deleted` en la misma transacción.
5. Después se elimina la identidad de Clerk. HTTP 404 equivale a identidad ya eliminada. Solo entonces se retira el trabajo y se responde `complete`. La interfaz cierra la sesión.

Si falla Neon, no se llama a Clerk. Si falla Clerk, el trabajo conserva `data_deleted`. El Worker reintenta los trabajos pendientes cada 15 minutos; la persona también puede reintentar mientras conserve una sesión válida. La pantalla pendiente comprueba el estado cada 30 segundos y cierra la sesión cuando confirma que el trabajo terminó. Un fallo de red conserva el estado pendiente. Los errores se registran sin datos de la cuenta.

## Despliegue

- Aplicar la migración versionada `0010_white_caretaker.sql` antes de desplegar este Worker. Comprueba antes los datos huérfanos con `node scripts/audit-profile-fks.mjs` en un entorno con `DATABASE_URL`; la migración fallará si ya existen huérfanos.
- Configurar `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` y `APP_ORIGIN` como valores privados del Worker, salvo la clave pública de Clerk que también usa el cliente. No publicar `.dev.vars` ni la URL de Neon.
- Confirmar que el cron `*/15 * * * *` está activo en Cloudflare. Vigilar errores `account_data_cleanup_error`, `account_identity_cleanup_error` y `account_cleanup_retry_error`, además del número de trabajos antiguos en `account_deletions`.
- Antes de producción, ensayar el proceso con una cuenta **ficticia y aislada** que contenga datos de cada módulo. Verificar que no quedan filas para su `user_id` y que Clerk ya no devuelve esa identidad. No usar la cuenta personal de Joshua para el ensayo.

## Alcance y límite

La eliminación es permanente y no ofrece recuperación desde la app. Las copias de seguridad y registros de proveedores externos tienen sus propias políticas de retención; revisarlas antes de publicar una promesa legal sobre plazos de borrado. La interfaz no anuncia éxito mientras quede un paso pendiente. Si se agota una cuota o falta un secreto, el trabajo permanece para reintento y no se aceptan escrituras nuevas de esa cuenta.
