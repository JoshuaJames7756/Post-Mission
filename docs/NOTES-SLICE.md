# Notas · primer recorrido completo

## Diseño

Una nota conserva título, contenido y fechas en `notes`. Las relaciones con metas, tareas, eventos, personas y lugares se guardan en cinco tablas propias. Cada tabla usa claves foráneas compuestas `(user_id, id)` para impedir asociaciones entre cuentas incluso si falla una validación de la API.

El Worker valida la entrada con Zod, toma el usuario de la sesión verificada y comprueba que todos los destinos pertenezcan a esa cuenta. Crear o reemplazar los vínculos ocurre dentro de una transacción. Archivar una nota no archiva los destinos; archivar un destino no borra la nota.

La vista es secundaria y se abre desde Inicio. El editor permite varios vínculos de cada tipo, conserva los ya seleccionados al buscar y muestra los vínculos en la tarjeta de la nota. Los registros archivados siguen disponibles para mantener y editar relaciones existentes.

## Estado y siguiente mejora

La migración `0006_graceful_skullbuster.sql` está aplicada al entorno local. Se probó una nota ficticia con cinco vínculos, recarga, edición, archivo y restauración en navegador. Falta prueba autenticada entre dos cuentas y paginación/búsqueda en servidor para cuentas con muchos registros. La pantalla usa búsqueda local sobre los elementos cargados de la cuenta, suficiente para el volumen actual.
