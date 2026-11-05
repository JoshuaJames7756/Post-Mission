# Preparación para publicar Post Mission

Estado revisado el 5 de noviembre de 2026. Esta revisión es local; no se ha desplegado a producción.

## Comprobado

- `pnpm build`, `pnpm lint` y la suite de pruebas pasan en el entorno local.
- `pnpm exec drizzle-kit check` valida el historial de migraciones `0000`–`0010`.
- `pnpm exec wrangler deploy --dry-run` prepara el Worker y los archivos estáticos sin subirlos. Wrangler lee `dist/client` como directorio de recursos públicos.
- Los valores locales de `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` y `DATABASE_URL` no aparecen en los archivos de `dist/client`.
- `.dev.vars`, `.env.local`, `dist` y `.wrangler` están excluidos por `.gitignore`.
- `.dev.vars.example` usa el origen local `http://localhost:5174`, igual que Vite.

## Antes del primer despliegue

1. Confirmar en la documentación oficial las cuotas y condiciones comerciales vigentes de Cloudflare Workers, Clerk Free y Neon Free. Estimar el uso esperado y definir qué mostrará la app si se agota una cuota.
2. Crear las cuentas de producción bajo control de Joshua y configurar en Cloudflare los secretos `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `DATABASE_URL` y `APP_ORIGIN`. Usar el dominio real en `APP_ORIGIN` y en la configuración de Clerk. No colocar secretos en variables `VITE_`.
3. Preparar la base de Neon de producción, revisar las migraciones `0000`–`0010` y ejecutar `pnpm db:migrate` explícitamente con la URL de producción. Registrar copia de seguridad y procedimiento de recuperación antes de migrar.
4. Probar con dos cuentas reales de Clerk que cada una solo puede leer y modificar sus propios datos en Inicio, Plan, Agenda, Personas, Mapa, Notas y Revisiones. Incluir asociaciones entre entidades y archivo/restauración.
5. Completar un recorrido de teclado y lector de pantalla, revisar móvil y escritorio, e instalar y abrir la PWA sin conexión en un teléfono real. Medir el rendimiento en ese dispositivo.
6. Ensayar la eliminación de cuenta solo con una cuenta de prueba aislada. Confirmar que la app no ofrece recordatorios Push programados hasta contar con suscripciones, preferencias y envío verificados.
7. Repetir `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm exec drizzle-kit check` y `pnpm exec wrangler deploy --dry-run` antes del despliegue autorizado.

## Alcance de esta comprobación

El despliegue en seco verifica el paquete local, no las credenciales, cuotas ni permisos de producción. La ausencia de secretos se comprobó en los recursos públicos generados; el Worker de producción aún necesita sus secretos configurados por separado. La prueba de aislamiento entre cuentas usa identidades simuladas y no sustituye el recorrido con dos sesiones reales de Clerk.
