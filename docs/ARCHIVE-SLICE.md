# Centro de archivo

Desde Inicio se abre `#archive`. La lista reúne áreas, metas, tareas, eventos, personas, lugares, hitos y notas archivadas. El Worker filtra siempre por la identidad verificada, acepta búsqueda por título, tipo y página, y devuelve hasta 24 elementos ordenados por fecha de archivo. La búsqueda usa parámetros SQL; no mezcla registros de otras cuentas. La consulta se actualiza cada vez que se entra al centro.

Restaurar utiliza las rutas existentes de cada dominio. Si una meta depende de un área o meta superior archivada, se informa del conflicto y debe restaurarse primero la relación. Lo mismo ocurre con tareas y eventos vinculados a metas archivadas. Las relaciones no se borran al archivar o restaurar. Los errores aparecen junto al registro para poder resolverlos sin perder el contexto.

Se verificó en el navegador el ciclo completo con una nota ficticia: archivarla, encontrarla por búsqueda y restaurarla. La lista vacía y los estados de carga y error tienen tratamiento explícito. No fue necesaria una migración adicional.
