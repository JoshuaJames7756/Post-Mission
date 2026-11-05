# Post Mission — estado y checklist

**Estado:** núcleo de cinco destinos y módulos de apoyo funcionales en desarrollo local. Estamos en pulido de experiencia y verificación previa al lanzamiento; aún no se ha desplegado a producción.

## Completado

- [x] Splash “Purposeful Calm”: brújula vectorial sin recuadro, respiración suave con respeto a movimiento reducido, Manrope alojada localmente y contraste según el tema. La preferencia visual se aplica antes de React desde una copia local no sensible y se reconcilia con el perfil del servidor; fuente y script se precargan para la PWA.

- [x] Captura rápida global para tareas y notas, etiquetas de áreas en Inicio y Agenda, y compartir voluntariamente el resumen de la revisión semanal. El service worker recibe Push y la app ofrece solicitar permiso tras completar una tarea. El envío programado y las suscripciones Push siguen pendientes.

- [x] Prueba de aislamiento de API con dos identidades simuladas y consultas reales de tareas, notas y revisiones: una cuenta no puede leer ni completar la tarea o revisión de otra, ni listar sus notas. El centro de archivo verifica el filtro de propietario en sus ocho fuentes. Se ejecuta con datos en memoria, sin tocar Neon. Falta repetir el flujo con dos cuentas Clerk reales en un entorno aislado antes del lanzamiento.
- [x] “Mover a hoy” usa la ruta privada de actualización: prueba de API confirma que otra cuenta recibe 404 y no puede cambiar la fecha, mientras el propietario sí puede hacerlo.

- [x] Recuperación de fallos transitorios en la lectura del estado de cuenta: dos reintentos solo ante errores de red o servidor; errores de autenticación y validación no se repiten. La API registra ruta y cadena de tipos/códigos de error sin datos de la solicitud. Una conexión intermitente de Neon observada en desarrollo aún requiere seguimiento antes de publicar.

- [x] Pasada móvil de Personas y Mapa: tarjetas de lista más compactas, títulos con jerarquía tipográfica consistente y acciones táctiles de 40 px. En Mapa, la lista muestra que el punto está guardado en lugar de exponer coordenadas crudas; estas permanecen en la edición del lugar. Revisado con datos cargados a 390 px.

- [x] Revisiones diarias y semanales: período local con semanas que comienzan el lunes, un borrador por cuenta y período, guardado automático con versión para evitar sobrescrituras, estados de guardado/error, finalización explícita y reapertura. Migración `0007` aplicada en Neon local; revisión semanal ficticia guardada, completada y reabierta en navegador.

- [x] Notas: una nota independiente puede enlazarse a varias metas, tareas, eventos, personas y lugares mediante cinco tablas de asociación tipadas. Crear, editar, buscar, archivar y restaurar con API privada y validación de pertenencia. Migración `0006` aplicada en Neon local; nota ficticia con cinco vínculos guardada y probada en navegador.

- [x] Journey: acceso secundario desde Inicio, fecha de regreso opcional, duración o días transcurridos (regreso = día 0), hitos con fecha y descripción, edición y archivo recuperable. API privada, validación de fechas y migración `0005` aplicada al entorno local. Vista revisada en escritorio y móvil; 138 pruebas aprobadas.

- [x] Seguridad de Personas: prueba de servicio que confirma que una persona ajena a la cuenta no permite consultar ni reemplazar sus vínculos con eventos. La suite completa pasó con 128 pruebas; sigue pendiente la prueba autenticada de extremo a extremo entre cuentas.
- [x] Aislamiento de Agenda en la API: con dos identidades simuladas, una cuenta ajena no ve el evento en el listado ni por ID y no puede completarlo; el propietario sí. La prueba real con dos sesiones de Clerk sigue pendiente antes de publicar.
- [x] Validar los UUID de Tareas, Metas y Eventos antes de consultar Neon y responder 404 al archivar o restaurar un registro inexistente o ajeno. Cubierto por pruebas de API con identidades simuladas.

- [x] Personas: el editor se abre con foco en Nombre, se cierra con Escape y devuelve el foco a Añadir persona o a la persona editada; la animación de desplazamiento respeta movimiento reducido. Recorrido de crear y editar comprobado en navegador, sin guardar datos de prueba.

- [x] PWA: apertura sin red con pantalla pública autónoma servida por el service worker, sin mostrar datos privados ni prometer guardado offline. “Reintentar” hace una navegación nueva en cada intento y vuelve a la app cuando regresa la conexión. Verificado en preview de producción deteniendo y restaurando el servidor; prueba del service worker, build y lint aprobados.

- [x] Agenda con teclado: las 24 zonas invisibles del horario dejan de ser paradas de Tab; el clic en una hora sigue rellenando esa hora. El formulario se cierra con Escape y devuelve el foco a Añadir evento, al evento editado o al horario según el origen. Comprobado en navegador. Suite completa: 127 pruebas aprobadas.

- [x] Revisión de escritorio con datos cargados en Inicio, Plan, Agenda, Personas y Mapa. En Inicio, reservar espacio para Cuenta y mostrar completa la fecha; en Ajustes, aislar el fondo y contener el foco del teclado, con cierre por Escape y retorno a Cuenta. Comprobado en navegador a 1280, 900 y 780 px, y con build/lint.

- [x] Pasada visual móvil con datos de ejemplo: en Plan, separar título y metadatos de cada tarea y ampliar las acciones táctiles; en Personas, mostrar los seis filtros de relación sin scroll horizontal; en Mapa, acercar los lugares guardados a la búsqueda. Revisado en navegador y con build/lint.

- [x] PWA: corregir la detección de archivos versionados de Vite y guardar JavaScript, CSS y precarga inicial junto al HTML durante la instalación. Confirmado con pruebas del service worker y respuestas 200 en preview de producción; falta probar la instalación y el modo sin conexión en un teléfono.

- [x] Inicio: propósito personal opcional, editable desde una tarjeta compacta y guardado en el perfil. Migración `0004` aplicada en la base del entorno local; los perfiles existentes quedan intactos. Editor comprobado en navegador.

- [x] Datos de ejemplo: desde Inicio se cargan una sola vez áreas, metas, tareas, eventos, personas y lugares ficticios conectados. La API privada los inserta en una transacción por cuenta, sin reemplazar datos propios. Verificado en la sesión local en las cinco secciones.

- [x] Cálculo semanal basado en tareas reales y zona horaria del perfil. La tarjeta del resumen se retiró de Inicio en el rediseño para reducir duplicidad.

- [x] Agenda: mostrar los eventos con hora en la zona del perfil, también cuando cambian de fecha; conservar la zona de origen en el editor y la fecha del calendario al abrirlo. Eventos de todo el día conservan sus fechas.

- [x] Agenda: marcador Ahora con hora en vivo, actualización al volver a la pestaña y botón Hoy que vuelve a centrar el horario; los cambios del reloj conservan el scroll manual. Comprobado con reloj simulado.

- [x] Búsqueda de Personas y Lugares con pausa de 250 ms, resultados anteriores visibles durante la consulta y aviso accesible; conservar datos previos solo dentro de la misma cuenta. Recorrido comprobado con respuestas simuladas pendientes.

- [x] Archivado de Personas y Lugares con aviso y acción Deshacer; avisos móviles por encima del dock. Recorrido de archivo y restauración comprobado con datos simulados en ambos módulos.

- [x] Entrada ligera durante el arranque web y transiciones breves entre secciones; respetar movimiento reducido y omitir la entrada adicional en PWA instalada.

- [x] Autenticación y perfil con Clerk; preferencias de tema.
- [x] API privada en Cloudflare Workers y persistencia en Neon/PostgreSQL.
- [x] Inicio, áreas de vida, metas jerárquicas y tareas.
- [x] Agenda con vistas de día y mes, tira semanal, línea de tiempo por hora y eventos asociados a metas.
- [x] Personas con búsqueda, edición, relación, notas privadas, archivo y vínculos a eventos.
- [x] Mapa con selección manual de puntos, lugares guardados, búsqueda y vínculos a eventos.
- [x] Navegación principal con cinco destinos; cuenta y ajustes como acción separada del dock.
- [x] Agenda compacta: acción de crear evento junto al día, sin duplicarla en el encabezado; menos espacio superior en las secciones.
- [x] Reducir cabeceras repetidas en Plan, Agenda, Personas y Mapa; dejar Cuenta en Inicio y quitar el mensaje que ocupaba la línea de tiempo vacía.
- [x] Mantener la capitalización natural del español en las fechas de Inicio y Agenda.
- [x] En Inicio, quitar la frase duplicada y acercar la acción principal al saludo.
- [x] Mantener un encabezado accesible y compacto por sección, con icono y contexto, sin cabeceras grandes repetidas.
- [x] Retirar el pie “Purpose over pressure” repetido en todas las secciones.
- [x] Simplificar los textos de Mapa y corregir el conteo singular/plural de Personas.
- [x] Usar skeletons durante la carga inicial del Inicio, Plan, Agenda, Personas y lugares del Mapa.
- [x] Mantener skeletons consistentes desde la preparación de perfil y preferencias hasta la carga de cada sección, sin alternar primero a spinner en pantalla completa.
- [x] Dar al título de nueva meta una fila completa y ordenar sus selectores para evitar que se comprima en móvil.
- [x] Mostrar las metas con fecha pasada como “Revisar fecha” usando la zona horaria del perfil, sin cambiar sus fechas guardadas.
- [x] Mantener completar meta como acción directa y reunir editar y archivar en un menú de tres puntos por meta.
- [x] En la vista diaria de Agenda, conservar las 24 horas en el único scroll de la página y enfocar automáticamente la hora actual (o el primer evento del día), sin scroll anidado. Mantener la fecha y “Añadir evento” visibles en un encabezado compacto al recorrer el horario en móvil.
- [x] En la vista mensual de Agenda, sustituir los títulos ilegibles dentro de las celdas móviles por puntos de color, ampliar el área para elegir un día y mostrar su cantidad de eventos a lectores de pantalla. Mantener la lista del día debajo y separar “Añadir evento” del botón flotante.
- [x] En el formulario de Agenda, aumentar la legibilidad de campos y ayudas en móvil, apilar las horas de inicio y fin para mostrar el valor completo y ocultar Captura rápida mientras se edita un evento. Comprobado en vista previa sin guardar datos de prueba.
- [x] En Captura rápida, enfocar el título al abrir y al cambiar entre tarea y nota; ampliar campos y controles en móvil. Verificado en la vista previa y en la prueba de interacción.
- [x] En Agenda, arrastrar eventos programados con hora dentro del mismo día para cambiar su inicio en bloques de 15 minutos, conservando la duración y la zona horaria; alternativa de teclado con Alt + flechas. Guardado verificado en navegador y evento de ejemplo restaurado a su hora original.
- [x] En Agenda, arrastrar el borde inferior de un evento para ajustar su duración en bloques de 15 minutos, con vista previa y alternativa de teclado Alt + Mayús + flechas. Guardado verificado en navegador y evento de ejemplo restaurado a su duración original.
- [x] En Personas, filtrar la lista por relaciones ya guardadas y mantener la búsqueda; no simular datos de último contacto.
- [x] En el encabezado de Mapa, alinear título y acciones en su propio espacio; mantener “Añadir lugar” como acción primaria y separar los controles en pantallas estrechas.
- [x] Alinear a la izquierda los títulos de Plan y Agenda, y agrupar las secciones de Plan en una navegación segmentada con la selección actual visible.
- [x] Convertir Tareas, Metas y Áreas en vistas excluyentes de Plan sincronizadas con el hash; unificar los formularios de creación y reunir editar, reordenar y archivar áreas en un menú de tres puntos. Probado en escritorio y móvil; el orden de ejemplo se restauró tras la prueba.
- [x] Reiniciar la posición de scroll al cambiar entre secciones principales para que sus encabezados y controles no queden fuera de vista.
- [x] En Plan e Inicio, mostrar las tareas de fechas pasadas como “De ayer” o “Pendiente” según la zona horaria del perfil, con acción rápida “Mover a hoy” y reversión si falla el guardado. El marcado de tareas con conexión usa actualización optimista; sin conexión conserva la cola local.
- [x] En Plan, mantener “Mover a hoy” visible en móvil y reunir editar, archivar y reabrir en un menú contextual por tarea para reducir la sobrecarga de acciones.
- [x] En Plan, titular la lista “Pendientes” porque reúne tareas de hoy, anteriores y futuras; quitar la frase introductoria para acercar el formulario. En Inicio, mostrar “Hoy” junto al icono de reprogramación para que la acción se entienda sin depender de un tooltip. Revisado visualmente en móvil.
- [x] En Metas, ampliar a 44 px las acciones de completar y abrir el menú; mejorar el tamaño de los campos de creación y la lectura de títulos y fechas en móvil. Revisado visualmente en móvil.
- [x] En Plan, mostrar fecha objetivo y vencimiento de cada meta; la antigua lista de metas en Inicio se retiró en el rediseño y quedó un acceso rápido a Metas.
- [x] Refactorizar Inicio: avatar de Clerk junto al saludo, propósito destacado, un solo “Foco de hoy” con tareas y eventos completables y cuatro accesos rápidos en cuadrícula de dos columnas. El título y los datos de cada tarea comparten el área táctil del checkbox; “Hoy” conserva una acción independiente. Revisado en escritorio y móvil.
- [x] Corregir la respuesta de completar/reabrir/archivar/restaurar en tareas, eventos y metas: el servidor ya devuelve el objeto actualizado sin error después de guardar. Comprobado en navegador completando y reabriendo una tarea ficticia.
- [x] Estados principales de carga con indicador; ajustes con fondo desenfocado, scroll bloqueado y cierre con Escape.

## Siguiente trabajo de producto y UX

- [x] Notas independientes con vínculos tipados a metas, tareas, eventos, personas y lugares, más archivo recuperable.
- [x] Revisiones diaria y semanal con borrador, guardado automático y finalización explícita.
- [x] API de recordatorios internos y preferencias por categoría, implementada previamente. El panel y sus ajustes visibles se retiraron de Inicio en el rediseño; su reutilización futura queda por evaluar.
- [x] Onboarding de primer uso: bienvenida, Journey con fecha opcional, primera área y meta opcional; finalización verificada en el servidor.
- [x] Centro de archivo con búsqueda, filtros, paginación y restauración de áreas, metas, tareas, eventos, personas, lugares, hitos y notas.
- [x] Cierre seguro de cuenta y datos: confirmación escrita y verificación reciente, eliminación de Neon antes de Clerk, trabajo persistente con reintentos y bloqueo de nuevas escrituras. Migración `0010` aplicada en Neon local; probado con servicios simulados. Falta ensayo destructivo exclusivamente con una cuenta de prueba aislada antes de publicar.

- [x] Inicio: propósito personal guardado en el perfil y foco diario con tareas y eventos reales.
- [x] Personas: relaciones y eventos vinculados cubren el brief del MVP. Grupos personalizados e historial de contacto quedan para una versión posterior si existe una necesidad demostrada; la app aún no registra interacciones ni debe inventar fechas de último contacto.
- [x] Mapa: mostrar una ficha inferior sobre el mapa al seleccionar un lugar, con acceso a la ficha completa y edición.
- [x] Mapa: se evaluaron capas adicionales. Por ahora se conserva un solo mapa de calles: una capa satelital exige otro proveedor, claves y condiciones de cuota/coste; el relieve topográfico no mejora la tarea principal de guardar y encontrar lugares. Reconsiderar con demanda real y presupuesto. Si falla la carga de imágenes, ofrecer reintento y acceso directo a la lista sin perder los lugares.
- [x] Mapa: trasladar la atribución de OpenStreetMap a la esquina superior derecha del lienzo para que la ficha inferior del lugar y la captura rápida flotante no la tapen en móvil.
- [ ] Revisar la jerarquía visual de todas las secciones en móvil y escritorio con datos reales.
- [ ] Definir si “Comps”/momentos de fe pertenece al alcance del producto; por ahora es inspiración de las capturas, no una función implementada ni comprometida.

## Antes de publicar

- [x] Revisar el paquete local: Wrangler `--dry-run` prepara Worker y recursos públicos sin subirlos; `drizzle-kit check` valida migraciones `0000`–`0010`; los secretos locales no aparecen en `dist/client`. Corregido el origen local del archivo de ejemplo y documentados los pasos restantes en `docs/RELEASE-READINESS.md`.
- [ ] Revisar flujos autenticados entre cuentas y permisos de extremo a extremo.
- [ ] Configurar suscripciones Push, preferencias y envío programado antes de ofrecer recordatorios matutinos reales.
- [ ] Completar recorridos de navegador, accesibilidad y revisión responsive en tamaños de escritorio y móvil.
- [ ] Verificar instalación y apertura sin conexión de la PWA en un teléfono real; el ciclo offline y reconexión ya se comprobó en preview de escritorio.
- [ ] Preparar cuentas y variables de producción, revisar migraciones y recuperación de datos; no se ha desplegado a producción.
- [x] Dividir Agenda, Personas y Mapa en módulos de carga diferida, con skeletons y error recuperable. El paquete principal baja de 526,67 a 479,85 kB (sin comprimir); desaparece el aviso de 500 kB. Queda pendiente medir rendimiento real en teléfono.

## Criterio de alcance

Las mejoras de Personas, Mapa e Inicio se inspiran en patrones de las referencias, no en copiar pantallas. Antes de añadir un módulo nuevo, como Comps, confirmaremos que responde a una necesidad del brief y del producto.
