# Avisos internos

Inicio consulta `/api/v1/reminders` con identidad verificada. El Worker selecciona tareas abiertas y con fecha vencida o de hoy, eventos programados que empiezan hoy o mañana (o en las próximas 24 horas si tienen hora), y revisiones en borrador de períodos anteriores recientes. Excluye elementos archivados, completados y cancelados. La fecha local se calcula con la zona horaria del perfil.

Se presenta como máximo una fila por categoría, hasta tres filas. El enlace de una revisión abre el borrador concreto. No se envían push, correos ni avisos con la app cerrada. No se registra una impresión de pantalla, solo la acción explícita “Ocultar por hoy”. Esa acción se guarda con una restricción única por usuario, categoría y fecha local. Las tres preferencias se guardan por separado en el perfil desde Ajustes. El servidor toma el usuario de Clerk, valida las entradas y nunca acepta un ID de usuario enviado por el navegador.

La migración `0008_mute_northstar.sql` añade las preferencias y el registro de avisos ocultos. Las preferencias anteriores reciben `true` por defecto. Para publicar, aplicar la migración antes de desplegar el Worker nuevo. El panel muestra error recuperable si falla la consulta. La ocultación nunca modifica las tareas, eventos ni revisiones.
