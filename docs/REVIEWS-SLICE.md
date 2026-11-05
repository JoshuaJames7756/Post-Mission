# Revisiones · recorrido diario y semanal

## Períodos y datos

La revisión diaria usa la fecha local del perfil. La semanal se identifica por el lunes de esa semana, también calculado desde la fecha local. PostgreSQL impone una revisión única por `(user_id, period_type, period_start)` y valida que el período semanal empiece en lunes.

Cada revisión guarda logros, dificultades, reflexión y próximos pasos, más estado `draft`/`completed`, marcas de tiempo y una revisión numérica. El Worker usa la identidad de Clerk verificada para todas las consultas. No admite períodos futuros.

## Guardado y conflictos

La interfaz espera 700 ms tras la última edición y envía el borrador al servidor. Muestra “Guardando” hasta recibir respuesta y “Guardado” solo tras confirmación. Los cambios se envían en orden; si se escribe durante una petición, se programa otra después. La API exige `baseRevision`; una revisión modificada en otra sesión devuelve conflicto en lugar de sobrescribirla. Completar y reabrir incrementan la misma versión y nunca crean otra fila.

Si falla el guardado, el texto permanece visible como no guardado, los campos se bloquean y se ofrece reintento o descarte. No hay cola ni edición offline. Se avisa al intentar salir con cambios pendientes. El historial permite volver a borradores anteriores.

## Verificación y límites

La migración `0007_sharp_doctor_strange.sql` se aplicó al entorno local. Se verificó el período semanal, guardado automático, finalización y reapertura de una revisión ficticia en navegador. Faltan una prueba autenticada entre dos cuentas, recuperación ante conflicto en varias pestañas reales y una revisión de accesibilidad completa antes de publicar.
