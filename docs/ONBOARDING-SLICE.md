# Onboarding de primer uso

El recorrido de Inicio tiene cuatro pasos: bienvenida y nombre, fecha de regreso y modalidad de Journey, primera área de vida y primera meta opcional. La fecha puede quedar vacía; Journey conserva su estado sin contador. No se piden personas, lugares, tareas ni notas para entrar.

Cada paso guarda mediante las rutas privadas existentes. Si una petición falla, el recorrido muestra el error y permanece en el mismo paso. La finalización se registra por `/api/v1/me/onboarding/complete` solo cuando existe perfil y al menos un área activa de la cuenta autenticada. La ruta es idempotente. La migración `0009_furry_sprite.sql` marca los perfiles previos como configurados y deja los perfiles nuevos pendientes.

Si el usuario recarga a mitad de camino, la app consulta sus datos persistidos. Si ya hay área, el recorrido retoma en la meta opcional. El usuario puede explorar otras secciones durante la configuración; Inicio le permite terminarla. No se marca el recorrido como completo por cerrar la pantalla.
