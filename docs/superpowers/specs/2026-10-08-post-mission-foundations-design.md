# Post Mission — Fase 1: fundamentos y planificación

**Estado:** Borrador para revisión de Joshua  
**Fecha:** 2026-10-08  
**Producto:** Post Mission — “The mission ended. Your purpose continues.”

## 1. Objetivo

Entregar la primera parte utilizable de Post Mission como aplicación privada y persistente. Una persona podrá autenticarse, completar su perfil, organizar sus metas por áreas de vida y crear tareas asociadas. Los datos se guardarán en Neon y se accederán exclusivamente mediante una API del servidor.

Esta fase debe establecer los límites del sistema y demostrar el recorrido completo React → API → autenticación/autorización → servicio de dominio → Drizzle → Neon, sin simular persistencia.

## 2. Usuario y utilidad

El usuario principal es una persona que regresa de una misión y quiere convertir sus prioridades personales en metas y acciones manejables. La aplicación debe ayudarle a responder: “¿Qué quiero construir en esta etapa de mi vida y cuál es el siguiente paso concreto?”.

El uso recurrente de esta fase se centra en revisar metas y completar o ajustar tareas. El producto evita presión innecesaria: presenta progreso y próximos pasos de forma clara, sin métricas de productividad decorativas.

## 3. Alcance de la fase

### Incluido

- Aplicación React con Vite y TypeScript estricto.
- Interfaz inicial en español y preparada para centralizar traducciones futuras.
- Autenticación con Clerk, sujeta a verificación de compatibilidad, flujos, límites y condiciones actuales antes de integrarla.
- Perfil personal con nombre visible, zona horaria y preferencias mínimas.
- Áreas de vida privadas, reordenables y archivables.
- Metas privadas con periodos `year`, `month`, `week` y `day`, fechas, estado y asociación opcional con un área.
- Jerarquía de metas con validación de padre/hijo, ciclos y compatibilidad de periodos en el servidor.
- Tareas privadas, asociadas opcionalmente a una meta, con estado, prioridad y fecha de vencimiento.
- API versionada bajo `/api/v1`, con contratos y errores consistentes.
- Persistencia PostgreSQL en Neon mediante Drizzle y migraciones versionadas.
- Diseño mobile-first, temas claro/oscuro/sistema, estados de carga, vacío, error y éxito.
- Pruebas de reglas de dominio y de aislamiento entre dos usuarios para los endpoints implementados.
- PWA instalable con recursos estáticos; sin operaciones de escritura offline.

### Fuera de alcance

Calendar, People, Map, Notes, Journey, Reviews, recordatorios, asociaciones entre notas y entidades, archivo global, eliminación de cuenta, notificaciones push, recurrencia, analítica avanzada, funciones sociales, IA y seguimiento en segundo plano. Se abordarán en fases posteriores después de validar el núcleo.

## 4. Arquitectura

Se usará una aplicación modular desplegada en Cloudflare Workers con recursos estáticos. React/Vite presenta la experiencia y llama a la API; Hono organiza rutas `/api/v1`; middleware verifica la identidad Clerk; esquemas Zod validan las entradas; servicios aplican reglas del dominio; Drizzle ejecuta consultas parametrizadas y transacciones contra Neon.

```text
React PWA
  └─ fetch /api/v1
       └─ Cloudflare Worker + Hono
            ├─ autenticación Clerk
            ├─ validación Zod y autorización por propietario
            ├─ servicios de perfil, áreas, metas y tareas
            └─ Drizzle → Neon PostgreSQL
```

Se prefiere un Worker modular a separar cada dominio en un servicio independiente: mantiene un despliegue sencillo y permite separar dominios en el código. La separación operativa se reconsiderará cuando exista una necesidad medible.

Dependencias frontend previstas: React, Vite, TypeScript, Tailwind CSS 4, Shadcn UI, Lucide React, Motion con movimiento reducido, TanStack Query, React Hook Form, Zod y Sonner. Backend: Cloudflare Vite plugin, Wrangler, Hono, Drizzle y el controlador Neon compatible con Workers. Como las mutaciones jerárquicas requieren transacciones interactivas, se utilizará Neon WebSockets (`neon-serverless`) si las pruebas de compatibilidad local lo confirman. El `Pool` se crea, utiliza y cierra dentro de cada solicitud Worker; nunca se reutiliza globalmente entre solicitudes. Neon HTTP se reserva para operaciones simples que no requieran transacción interactiva. Las versiones se elegirán tras verificar compatibilidad en documentación oficial y el ecosistema real del proyecto.

## 5. Autenticación, autorización y privacidad

- Clerk establece la identidad; el Worker valida la sesión/token en cada ruta privada.
- La identidad se obtiene de la sesión verificada, nunca de un `user_id` confiado desde el navegador.
- Cada consulta y mutación de recursos filtra por el propietario autenticado.
- Al crear una relación (por ejemplo, una tarea y su meta), el servicio comprueba que ambos registros pertenecen al mismo usuario.
- Los IDs ajenos deben producir una respuesta que no revele si el registro existe.
- Las entradas se validan en el servidor. El ocultamiento de controles en la interfaz no se considera autorización.
- Los secretos de Clerk y Neon existirán solo en variables privadas del Worker. Nunca se exponen en bundles `VITE_*`.
- Los logs no registrarán contenido de notas personales ni otros datos privados.
- No se configurará facturación automática. Se documentarán cuotas y comportamiento al alcanzarlas.

Clerk queda como proveedor preferido, no como una compatibilidad asumida: antes de implementar se confirmarán en fuentes oficiales sus SDK/flujos vigentes para Cloudflare Workers, Google OAuth si se habilita, plan gratuito, cuotas y términos comerciales. Si existe una incompatibilidad esencial o un coste necesario, se presentará la evidencia y se evaluará Better Auth antes de cambiar el proveedor.

## 6. Modelo de datos inicial

Todas las entidades de dominio usan UUID, fechas de creación/actualización y `user_id` para propiedad. El identificador de Clerk es texto.

### `profiles`

- `user_id` (texto, PK, identificador Clerk)
- `display_name`
- `timezone` (zona IANA)
- `theme_preference` (`system`, `light`, `dark`)
- `created_at`, `updated_at`

### `life_areas`

- `id` (UUID), `user_id`, `name`, `icon` opcional, `sort_order`
- `archived_at` nullable, `created_at`, `updated_at`
- Índice por usuario y orden; unicidad de nombre activo por usuario si la experiencia lo requiere.

### `goals`

- `id` (UUID), `user_id`, `life_area_id` nullable, `parent_goal_id` nullable
- `title`, `description` nullable, `period_type` (`year`, `month`, `week`, `day`)
- `start_date`, `target_date`, `status`, `completed_at` nullable
- `archived_at` nullable, `created_at`, `updated_at`
- `target_date >= start_date`; FKs compuestas que preservan propietario en asociaciones.
- Índices por usuario/periodo/estado, usuario/fechas y padre.

### `tasks`

- `id` (UUID), `user_id`, `goal_id` nullable, `title`, `description` nullable
- `status`, `priority`, `due_at` nullable, `completed_at` nullable
- `archived_at` nullable, `created_at`, `updated_at`
- FKs compuestas para impedir que una tarea apunte a una meta de otro usuario.
- Índice por usuario/estado/vencimiento.

Los niveles temporales de metas y ausencia de ciclos requieren reglas de dominio transaccionales. Cuando haya concurrencia, la mutación debe serializarse o usar una estrategia de bloqueo adecuada; no se confiará únicamente en la validación del cliente. Los detalles de edición/movimiento de subárboles se especificarán antes de implementar esa operación.

## 7. Contratos API iniciales

Todas las rutas usan `/api/v1`. Respuesta de éxito `{ "data": ... }`; error `{ "error": { "code", "message", "details", "requestId" } }` sin trazas ni datos sensibles.

- `GET /me`, `PATCH /me`
- `GET|POST /life-areas`, `PATCH /life-areas/:id`, `POST /life-areas/:id/archive`, `POST /life-areas/:id/restore`
- `GET|POST /goals`, `GET|PATCH /goals/:id`, `POST /goals/:id/complete`, `POST /goals/:id/archive`, `POST /goals/:id/restore`
- `GET|POST /tasks`, `GET|PATCH /tasks/:id`, `POST /tasks/:id/complete`, `POST /tasks/:id/archive`, `POST /tasks/:id/restore`

El archivado y la restauración son explícitos; ningún endpoint de esta fase elimina permanentemente entidades personales.

Listados tendrán paginación y filtros solo donde sean necesarios para las pantallas. Las rutas se validarán contra esquemas compartidos cuando sea práctico, pero el Worker seguirá siendo la autoridad final.

## 8. Experiencia UI/UX

### Identidad y navegación

Dirección visual: **Purposeful Calm**. Se partirá de Midnight Navy, Warm Ivory, Sage y Soft Amber; los tonos finales se comprobarán por contraste antes de establecer tokens. Manrope se usará solo si carga ligera y licencia son adecuadas. Lucide será la iconografía común.

La experiencia móvil prioriza Home y Plan, con navegación persistente de bajo esfuerzo. En escritorio se muestra la invitación definida por el producto para continuar en el teléfono; esta decisión de interfaz no sustituye los controles de seguridad de la API. Tablets y plegables recibirán una composición adaptada al espacio disponible.

### Vistas de la primera fase

- **Acceso:** inicio de sesión y estados de autenticación, sin una landing promocional.
- **Onboarding/perfil:** nombre, zona horaria y preferencia visual; completar onboarding no bloquea la lectura de ajustes posteriores.
- **Home:** siguiente tarea, metas activas y acceso directo a planificar; sin estadísticas ficticias.
- **Plan:** áreas de vida, árbol de metas y tareas relacionadas; crear, editar, completar y archivar con confirmación cuando corresponda.
- **Settings mínimo:** perfil, tema y cierre de sesión.

Cada vista dependiente de datos define carga, contenido, vacío, error de red, sesión vencida, permiso denegado y acción de reintento. Los formularios mantienen los valores ante errores recuperables y confirman éxito solo después de respuesta del servidor.

### Accesibilidad

Foco visible, etiquetas asociadas, teclado, contraste WCAG 2.2 AA como objetivo, errores junto al campo, estados que no dependan solo del color, objetivos táctiles cómodos y respeto a `prefers-reduced-motion`. Axe automatizado complementará revisión manual; no se afirmará conformidad total solo por una prueba automática.

## 9. PWA y red

El manifiesto y los iconos permitirán instalación. Solo se cachearán recursos estáticos públicos. Respuestas privadas de API no se almacenarán en caché compartida. Las operaciones requieren conexión; al perderla se conserva el último contenido confirmado cuando sea viable y se ofrece reintento. No habrá guardado local presentado como confirmación del servidor.

## 10. Plan de implementación

1. **Fundamentos:** estructura, Vite/React/TypeScript estricto, diseño base, integración Vite/Workers, pruebas y calidad.
2. **Identidad y perfil:** Clerk verificado, middleware de identidad, esquema/migración de perfil y ajustes.
3. **Planificación:** áreas, metas, jerarquía, tareas y endpoints; aislamiento multitenant probado.
4. **Experiencia:** Home, Plan, estados, responsive, temas y onboarding.
5. **PWA y preparación:** manifiesto, caché estática segura, documentación y revisión de cuotas.

Cada etapa tendrá validación de tipo, lint, pruebas pertinentes y build. No se afirmará que una etapa está verificada si no se ejecutaron sus comandos. No se desplegará ni activará facturación durante estas fases sin autorización expresa.

## 11. Criterios de aceptación de la fase

1. Un usuario puede iniciar sesión y completar/editar su perfil.
2. Puede crear, listar, actualizar, archivar y reordenar áreas de vida.
3. Puede crear y consultar metas de los cuatro periodos, con fechas válidas y jerarquía compatible.
4. El servidor rechaza ciclos, padres incompatibles y relaciones con registros ajenos.
5. Puede crear, listar, actualizar y completar tareas, con o sin meta.
6. Todos los cambios persisten después de recargar y son privados por usuario.
7. Pruebas con dos usuarios cubren lectura, edición, archivado/completado y asociaciones manipuladas.
8. La interfaz presenta estados de carga, vacío y error; los formularios no pierden datos ante errores recuperables.
9. Tema del sistema, claro y oscuro funcionan; preferencia manual persiste.
10. Recursos PWA estáticos son instalables y no se cachean respuestas privadas.
11. TypeScript, lint, pruebas definidas y build se ejecutan y reportan con resultados reales.
12. Existe documentación de configuración local, variables, migraciones, cuotas verificadas y despliegue.

## 12. Riesgos y decisiones pendientes

- **Clerk en Workers:** validar SDK, verificación de token y plan vigente antes de fijar integración.
- **Neon en Workers:** validar controlador, conexiones y límites vigentes; no abrir conexiones por solicitud sin seguir el patrón recomendado oficialmente.
- **Jerarquía temporal:** definir con precisión si el padre debe ser estrictamente el periodo inmediatamente superior y qué transformación ocurre al cambiar el periodo; no implementar movimiento de subárbol sin decisión.
- **Cuotas gratuitas:** capturar límites oficiales vigentes al momento de implementación y documentar qué función se degrada si se alcanza una cuota.
- **Escritorio:** la invitación a usar teléfono es una regla del producto; confirmar comportamiento durante pruebas de usabilidad si interfiere con tareas de configuración.

## 13. Revisión propia

- La fase tiene un límite verificable y no intenta construir vistas desconectadas del backend.
- El frontend no recibe credenciales de Neon ni decide la propiedad de los recursos.
- La API verifica identidad, entrada y propiedad de registros relacionados.
- Las restricciones relacionales y las transacciones cubren integridad; las reglas jerárquicas no se atribuyen falsamente a una FK.
- No se presentan servicios, límites gratuitos, compatibilidad de Clerk ni resultados de pruebas como ya verificados.
- La única decisión funcional de la jerarquía que debe cerrarse antes de implementar movimientos es la política de cambios de periodo.
