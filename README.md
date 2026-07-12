
# Optimizador de Rutas - Zonas Verdes

Aplicación web estática para gestionar rutas de inspección y trabajos forestales (arbolado, tocones, nuevas plantaciones, etc.). 

La idea principal es subir un GeoJSON con los puntos de trabajo del día y sacar una ruta por calles para pasársela a los equipos de trabajos, ya sea en formato GPX para el navegador GPS o en GeoJSON para verlo luego en QGIS u otro visor SIG.

## Características

*   **Frontend puro**: Es todo HTML/CSS/JS. Se procesa íntegramente en el navegador, no hay base de datos ni backend complejo.
*   **Routing Automático (IA)**: Se conecta a la API pública de OSRM (Open Source Routing Machine) para resolver el "Problema del Viajante" (TSP). Te calcula la ruta más corta para pasar por todos los puntos y ahorrar tiempo.
*   **Modo Manual**: Como a veces el algoritmo no conoce las prioridades operativas, puedes ordenar los puntos a mano (arrastrándolos en la lista lateral) y forzar la ruta en ese orden exacto.
*   **Puntos al vuelo**: Puedes hacer clic en el mapa para añadir paradas extra que no venían en tu archivo original.
*   **Exportación dual**: Saca GPX clásico o un GeoJSON completo (mantiene la línea geométrica de la ruta y los puntos con todos sus atributos originales como el `idmint`).

## Uso

1.  Abre `index.html` en cualquier navegador (Chrome, Firefox, Edge).
2.  Sube tu archivo `.geojson` (los puntos deben ser tipo `Point` y se recomienda que tengan atributos `idmint` y `descripcion` para darles color). Si no tienes uno, pulsa "Descargar Plantilla" para ver el formato exacto.
3.  Reordena los puntos en la lista si lo necesitas o añade puntos nuevos clicando en el mapa.
4.  Dale a calcular ruta (IA o Manual).
5.  Exporta el resultado en el formato que prefieras.



## Dependencias externas

Están enlazadas por CDN directo para que funcione sin instalar nada:
*   [Leaflet](https://leafletjs.com/) (Motor del mapa).
*   [SortableJS](https://sortablejs.github.io/Sortable/) (Para hacer la lista arrastrable fluidamente).
*   [togpx](https://github.com/tyrasd/togpx) (Librería ligera para parsear de GeoJSON a GPX).
<img width="2470" height="1216" alt="image" src="https://github.com/user-attachments/assets/93812e23-071f-400b-b8e6-b0a79d6ad7bb" />
