# Journey · primer recorrido completo

## Alcance

- Fecha de regreso opcional y modalidad de visualización: duración de calendario o días transcurridos.
- El día del regreso cuenta como día 0. El cálculo usa la fecha local de la zona del perfil, sin convertir una fecha de calendario en un instante de la misión.
- Hitos privados con título, fecha, descripción opcional y archivo recuperable. Se muestran hitos próximos y anteriores.
- Acceso secundario desde Inicio; los cinco destinos principales permanecen iguales.

## Datos y permisos

- Fecha y modalidad viven en `profiles`, una fila por cuenta.
- Los hitos tienen `user_id`; cada lectura y modificación filtra por la identidad verificada en el Worker.
- El Worker valida con Zod. Las fechas futuras de regreso se rechazan usando la zona horaria del perfil.
- No se generan hitos automáticos ni se guardan datos privados en caché pública.

## Verificación

Probar cálculos de días y meses, validación y aislamiento de rutas, migración, build, lint y el recorrido en navegador.

## Resultado

- Migración `0005_colorful_sauron.sql` generada y aplicada al entorno local de Neon. Las filas de perfil existentes reciben el modo `elapsed` por defecto y mantienen la fecha de regreso vacía.
- Pantalla y acceso desde Inicio comprobados en escritorio y a 390 × 844 px. Ningún dato personal nuevo fue guardado durante la revisión visual.
- Queda pendiente una prueba autenticada de extremo a extremo con dos cuentas; las rutas exigen sesión y filtran los hitos por `user_id` verificado.
