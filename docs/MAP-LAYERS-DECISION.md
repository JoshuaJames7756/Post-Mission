# Capas del mapa — decisión actual

**Decisión:** conservar una sola capa de calles en el MVP. El usuario busca, marca y recupera lugares; una segunda capa añade controles, peticiones e implicaciones de privacidad sin resolver un problema demostrado. La alternativa topográfica sería útil para rutas o senderismo, que hoy no son parte del flujo.

La app carga las teselas solo tras una acción explícita del usuario y muestra atribución en el mapa. Si fallan las imágenes, ahora permite reintentar a petición del usuario o volver a la lista. No se descargan mapas para uso sin conexión.

## Condiciones revisadas (4 nov 2026)

- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): servicio comunitario sin garantía de disponibilidad; exige atribución, caché normal del navegador y prohíbe descarga anticipada u offline.
- [OpenTopoMap](https://www.opentopomap.org/about): capa topográfica con atribución y licencia CC BY-SA; no aporta una ventaja clara a los lugares personales del MVP.
- [Esri Basemap Styles](https://developers.arcgis.com/rest/basemap-styles/) y [precios](https://developers.arcgis.com/pricing/credits/): ofrecen imágenes satelitales, pero requieren cuenta/token y tienen consumo medido con coste después de la cuota gratuita. No se activará facturación para esta fase.
- [Stadia Maps Pricing](https://stadiamaps.com/pricing): su plan gratuito no permite uso comercial ni incluye la capa satelital; las opciones satelitales figuran en planes de pago.

Si más adelante usuarios piden imágenes satelitales para reconocer un punto, evaluar un proveedor con condiciones comerciales, límites y costes transparentes antes de integrar la capa. El mapa actual mantiene un proveedor inyectable para facilitar ese cambio.
