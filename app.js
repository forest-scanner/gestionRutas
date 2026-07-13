/**
 * Lógica principal: Gestión de Zonas Verdes
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Mapa
    const MADRID_COORDS = [40.4168, -3.7038];
    const map = L.map('map').setView(MADRID_COORDS, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    // Elementos DOM
    const inputGeoJSON = document.getElementById('geojson-input');
    const btnExample = document.getElementById('btn-example');
    const btnDownloadExample = document.getElementById('btn-download-example');
    const btnToggleEdit = document.getElementById('btn-toggle-edit');
    const btnOptimize = document.getElementById('btn-optimize');
    const btnManualRoute = document.getElementById('btn-manual-route');
    const btnExportGPX = document.getElementById('btn-export-gpx');
    const btnExportGeoJSON = document.getElementById('btn-export-geojson');
    const statusMessage = document.getElementById('status-message');
    const pointsListEl = document.getElementById('points-list');

    // Estado
    let markersLayer = L.featureGroup().addTo(map);
    let routeLayer = L.featureGroup().addTo(map);
    let currentPoints = []; // [{ id, coordinates, idmint, descripcion, color }]
    let currentRouteGeoJSON = null;
    let isEditMode = false;
    let manualPointCounter = 1;
    
    // Inicializar SortableJS
    let sortableList = Sortable.create(pointsListEl, {
        animation: 150,
        handle: '.point-item',
        onEnd: (evt) => {
            // Actualizar currentPoints basado en el nuevo orden DOM
            const newOrderIds = Array.from(pointsListEl.children).map(li => li.dataset.id);
            const newPointsArray = [];
            newOrderIds.forEach(id => {
                const pt = currentPoints.find(p => p.id === id);
                if (pt) newPointsArray.push(pt);
            });
            currentPoints = newPointsArray;
            showMessage('Orden actualizado. Listo para calcular ruta manual.', 'info');
        }
    });

    const exampleGeoJSONData = {
        "type": "FeatureCollection",
        "features": [
            { "type": "Feature", "properties": { "idmint": "TOC-001", "descripcion": "tocones" }, "geometry": { "type": "Point", "coordinates": [-3.6826, 40.4183] } },
            { "type": "Feature", "properties": { "idmint": "TOC-002", "descripcion": "tocones" }, "geometry": { "type": "Point", "coordinates": [-3.7142, 40.4187] } },
            { "type": "Feature", "properties": { "idmint": "TOC-003", "descripcion": "tocones" }, "geometry": { "type": "Point", "coordinates": [-3.7025, 40.4115] } },
            { "type": "Feature", "properties": { "idmint": "TOC-004", "descripcion": "tocones" }, "geometry": { "type": "Point", "coordinates": [-3.6881, 40.4244] } },
            { "type": "Feature", "properties": { "idmint": "TOC-005", "descripcion": "tocones" }, "geometry": { "type": "Point", "coordinates": [-3.7224, 40.4239] } },
            { "type": "Feature", "properties": { "idmint": "PLA-001", "descripcion": "recien plantados" }, "geometry": { "type": "Point", "coordinates": [-3.6953, 40.4079] } },
            { "type": "Feature", "properties": { "idmint": "PLA-002", "descripcion": "recien plantados" }, "geometry": { "type": "Point", "coordinates": [-3.6900, 40.4100] } }
        ]
    };

    const getColorForDescription = (desc) => {
        const lowerDesc = (desc || '').toLowerCase();
        if (lowerDesc.includes('tocon') || lowerDesc.includes('tocones')) return '#ef4444'; // Rojo
        if (lowerDesc.includes('recien') || lowerDesc.includes('plantado')) return '#10b981'; // Verde
        if (lowerDesc.includes('muerto')) return '#6b7280'; // Gris
        return '#059669'; // Verde Esmeralda por defecto
    };

    const showMessage = (msg, type = 'info') => {
        statusMessage.textContent = msg;
        statusMessage.className = `status-message active ${type}`;
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const renderPointsList = () => {
        pointsListEl.innerHTML = '';
        if (currentPoints.length === 0) {
            pointsListEl.innerHTML = '<li class="empty-list">No hay puntos cargados.</li>';
            return;
        }

        currentPoints.forEach((p, index) => {
            const li = document.createElement('li');
            li.className = 'point-item';
            li.dataset.id = p.id;
            li.innerHTML = `
                <span class="point-drag-handle">☰</span>
                <div class="point-info">
                    <span class="point-id">${index + 1}. ${p.idmint}</span>
                    <span class="point-desc">${p.descripcion}</span>
                </div>
                <div class="point-color-indicator" style="background-color: ${p.color};"></div>
                <button onclick="window.deletePoint('${p.id}')" style="background:none;border:none;cursor:pointer;margin-left:8px;font-size:1.1rem;color:#ef4444;" title="Eliminar punto">🗑️</button>
            `;
            pointsListEl.appendChild(li);
        });
    };

    const processGeoJSON = (geojsonData) => {
        markersLayer.clearLayers();
        routeLayer.clearLayers();
        currentPoints = [];
        currentRouteGeoJSON = null;
        btnExportGPX.disabled = true;
        btnExportGeoJSON.disabled = true;
        const gmContainer = document.getElementById('google-maps-links');
        if(gmContainer) gmContainer.innerHTML = '';

        if (!geojsonData || !geojsonData.features) {
            showMessage('El archivo GeoJSON no es válido.', 'error');
            renderPointsList();
            return;
        }

        geojsonData.features.forEach((feature) => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const coords = feature.geometry.coordinates;
                const props = feature.properties || {};
                const idmint = props.idmint || 'Desconocido';
                const desc = props.descripcion || 'Sin descripción';
                const color = getColorForDescription(desc);

                currentPoints.push({
                    id: generateId(),
                    coordinates: coords,
                    idmint: idmint,
                    descripcion: desc,
                    color: color
                });
            }
        });

        refreshMarkers();
        renderPointsList();

        if (currentPoints.length < 2) {
            showMessage('Se necesitan al menos 2 puntos.', 'error');
            btnOptimize.disabled = true;
            btnManualRoute.disabled = true;
        } else {
            map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
            showMessage(`Se cargaron ${currentPoints.length} puntos. Elige el tipo de ruta.`, 'info');
            btnOptimize.disabled = false;
            btnManualRoute.disabled = false;
        }
    };

    inputGeoJSON.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try { processGeoJSON(JSON.parse(e.target.result)); }
            catch (error) { showMessage('Error al leer el archivo GeoJSON.', 'error'); }
        };
        reader.readAsText(file);
    });

    btnToggleEdit.addEventListener('click', () => {
        isEditMode = !isEditMode;
        if (isEditMode) {
            btnToggleEdit.classList.add('active');
            btnToggleEdit.innerHTML = '✅ Modo Añadir: ON';
            map.getContainer().style.cursor = 'crosshair';
            showMessage('Haz clic en cualquier parte del mapa para añadir un punto.', 'info');
        } else {
            btnToggleEdit.classList.remove('active');
            btnToggleEdit.innerHTML = '📍 Añadir en Mapa';
            map.getContainer().style.cursor = '';
        }
    });

    map.on('click', (e) => {
        if (!isEditMode) return;
        
        const latLng = e.latlng;
        const idmint = `MANUAL-${manualPointCounter++}`;
        const desc = 'Añadido en mapa';
        const color = '#f59e0b'; // Naranja/Ambar para puntos manuales
        
        currentPoints.push({
            id: generateId(),
            coordinates: [latLng.lng, latLng.lat], // Guardar como GeoJSON [lng, lat]
            idmint: idmint,
            descripcion: desc,
            color: color
        });

        refreshMarkers();
        renderPointsList();
        
        if (currentPoints.length >= 2) {
            btnOptimize.disabled = false;
            btnManualRoute.disabled = false;
            showMessage('Punto añadido. Puedes seguir añadiendo o calcular la ruta.', 'info');
        }
    });

    btnExample.addEventListener('click', () => processGeoJSON(exampleGeoJSONData));

    btnDownloadExample.addEventListener('click', () => {
        downloadFile(JSON.stringify(exampleGeoJSONData, null, 2), 'plantilla_zonas_verdes.geojson', 'application/geo+json');
    });

    const calculateRoute = async (mode = 'auto') => {
        if (currentPoints.length < 2) return;
        
        btnOptimize.disabled = true;
        btnManualRoute.disabled = true;
        showMessage(`Calculando ruta (${mode === 'auto' ? 'IA' : 'Manual'})...`, 'info');

        try {
            const coordsString = currentPoints.map(p => `${p.coordinates[0]},${p.coordinates[1]}`).join(';');
            let url = '';
            const routeProfileElement = document.getElementById('route-profile');
            const profile = routeProfileElement ? routeProfileElement.value : 'driving';
            
            if (mode === 'auto') {
                // Trip API: Reordena automáticamente (TSP), fija el origen (source=first)
                url = `https://router.project-osrm.org/trip/v1/${profile}/${coordsString}?geometries=geojson&roundtrip=true&source=first&destination=any`;
            } else {
                // Route API: Respeta el orden proporcionado y evita giros bruscos si es driving
                url = `https://router.project-osrm.org/route/v1/${profile}/${coordsString}?geometries=geojson&continue_straight=${profile === 'driving' ? 'true' : 'default'}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`OSRM Error: ${response.statusText}`);
            const data = await response.json();
            if (data.code !== 'Ok') throw new Error(data.message || 'Error desconocido.');

            routeLayer.clearLayers();
            
            // Si es trip, saca el geometry de trips[0], si es route lo saca de routes[0]
            const routeGeometry = (mode === 'auto') ? data.trips[0].geometry : data.routes[0].geometry;
            
            const routeStyle = { color: '#059669', weight: 5, opacity: 0.8, lineJoin: 'round' };
            const routeLeafletLayer = L.geoJSON(routeGeometry, { style: routeStyle }).addTo(routeLayer);
            map.fitBounds(routeLeafletLayer.getBounds(), { padding: [30, 30] });

            currentRouteGeoJSON = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": { "name": `Ruta de Inspección (${mode})` },
                        "geometry": routeGeometry
                    },
                    ...currentPoints.map(p => ({
                        "type": "Feature",
                        "properties": { "name": p.idmint, "desc": `IDMINT: ${p.idmint} - ${p.descripcion}` },
                        "geometry": { "type": "Point", "coordinates": p.coordinates }
                    }))
                ]
            };

            showMessage('Ruta calculada con éxito.', 'info');
            btnExportGPX.disabled = false;
            btnExportGeoJSON.disabled = false;
            generateGoogleMapsLinks();
        } catch (error) {
            console.error("Error:", error);
            showMessage('Error al calcular la ruta.', 'error');
        } finally {
            btnOptimize.disabled = false;
            btnManualRoute.disabled = false;
        }
    };

    btnOptimize.addEventListener('click', () => calculateRoute('auto'));
    btnManualRoute.addEventListener('click', () => calculateRoute('manual'));

    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    btnExportGPX.addEventListener('click', () => {
        if (!currentRouteGeoJSON) return;
        try {
            const gpxData = togpx(currentRouteGeoJSON);
            downloadFile(gpxData, `ruta_zonas_verdes_${new Date().getTime()}.gpx`, 'application/gpx+xml');
            showMessage('GPX exportado correctamente.', 'info');
        } catch (error) { showMessage('Error al generar GPX.', 'error'); }
    });

    btnExportGeoJSON.addEventListener('click', () => {
        if (!currentRouteGeoJSON) return;
        try {
            downloadFile(JSON.stringify(currentRouteGeoJSON, null, 2), `ruta_zonas_verdes_${new Date().getTime()}.geojson`, 'application/geo+json');
            showMessage('GeoJSON exportado correctamente.', 'info');
        } catch (error) { showMessage('Error al generar GeoJSON.', 'error'); }
    });

    // Nuevas funciones globales
    window.deletePoint = (id) => {
        currentPoints = currentPoints.filter(p => p.id !== id);
        refreshMarkers();
        renderPointsList();
        if (currentPoints.length < 2) {
            btnOptimize.disabled = true;
            btnManualRoute.disabled = true;
            routeLayer.clearLayers();
        }
    };

    const refreshMarkers = () => {
        markersLayer.clearLayers();
        currentPoints.forEach(p => {
            const latLng = [p.coordinates[1], p.coordinates[0]];
            L.circleMarker(latLng, {
                radius: 8, fillColor: p.color, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9
            }).bindPopup(`<b>IDMINT:</b> ${p.idmint}<br><b>Estado:</b> ${p.descripcion}<br><button onclick="window.deletePoint('${p.id}')" style="margin-top:5px;cursor:pointer;color:red;border:none;background:transparent;padding:0;font-size:0.85rem;text-decoration:underline;">Eliminar punto</button>`).addTo(markersLayer);
        });
    };

    let watchId = null;
    let locationMarker = null;

    const getNavIcon = (heading) => {
        // SVG de una flecha de navegación (chevron)
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6' stroke='white' stroke-width='2'><path d='M12 2L22 22L12 18L2 22L12 2Z'/></svg>`;
        return L.divIcon({
            className: 'custom-nav-icon',
            html: `<div style="width: 28px; height: 28px; background: url(\"data:image/svg+xml;utf8,${svg}\") no-repeat center center; background-size: contain; transform: rotate(${heading || 0}deg); filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    };

    window.toggleNavigation = () => {
        const btn = document.getElementById('btn-navigate');
        if (!btn) return;
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            if (locationMarker) {
                map.removeLayer(locationMarker);
                locationMarker = null;
            }
            btn.innerHTML = '📍 Seguir mi ubicación';
            btn.classList.remove('active');
        } else {
            if (!navigator.geolocation) {
                showMessage('Geolocalización no soportada.', 'error');
                return;
            }
            btn.innerHTML = '🛑 Detener navegación';
            btn.classList.add('active');
            
            // Usamos un lastHeading para no perder la orientación si el dispositivo se detiene
            let lastHeading = 0;
            
            watchId = navigator.geolocation.watchPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                    lastHeading = pos.coords.heading;
                }
                
                if (!locationMarker) {
                    locationMarker = L.marker([lat, lng], { icon: getNavIcon(lastHeading) }).addTo(map);
                } else {
                    locationMarker.setLatLng([lat, lng]);
                    locationMarker.setIcon(getNavIcon(lastHeading));
                }
                map.setView([lat, lng], 17);
            }, (err) => {
                showMessage('Error al obtener ubicación', 'error');
            }, { enableHighAccuracy: true });
        }
    };

    const generateGoogleMapsLinks = () => {
        const container = document.getElementById('google-maps-links');
        if (!container) return;
        container.innerHTML = '';
        if (currentPoints.length < 2) return;

        const maxIndexDiff = 9; // Google Maps soporta max 9 waypoints intermedios, total 11 paradas por enlace
        let startIndex = 0;
        let part = 1;

        while (startIndex < currentPoints.length - 1) {
            let endIndex = Math.min(startIndex + maxIndexDiff, currentPoints.length - 1);
            
            const slice = currentPoints.slice(startIndex, endIndex + 1);
            const coords = slice.map(p => `${p.coordinates[1]},${p.coordinates[0]}`);
            const origin = coords[0];
            const dest = coords[coords.length - 1];
            const waypoints = coords.slice(1, coords.length - 1).join('|');
            
            const routeProfileElement = document.getElementById('route-profile');
            const modeStr = (routeProfileElement && routeProfileElement.value === 'foot') ? 'walking' : 'driving';
            
            let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${modeStr}`;
            if (waypoints) url += `&waypoints=${waypoints}`;

            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.cssText = 'width: 100%; border-color: #4285F4; color: #4285F4; background: white;';
            btn.innerHTML = `<span class="icon">🗺️</span> Abrir en Google Maps ${currentPoints.length > 10 ? `(Tramo ${part})` : ''}`;
            btn.onclick = () => window.open(url, '_blank');
            
            container.appendChild(btn);

            startIndex = endIndex;
            part++;
        }
    };
});
