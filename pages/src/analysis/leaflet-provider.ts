/**
 * Leaflet Provider
 * 
 * Leaflet implementation of the MapProvider interface.
 * Handles rendering of flight tracks, task turnpoints, and events.
 */

import type { IGCFix } from './igc-parser';
import type { XCTask } from './xctsk-parser';
import type { FlightEvent } from './event-detector';
import { getEventStyle } from './event-detector';
import type { MapProvider, MapBounds } from './map-provider';

// Leaflet types (loaded dynamically via CDN)
declare const L: any;

/**
 * Load Leaflet from CDN if not already loaded
 */
async function loadLeaflet(): Promise<void> {
    if (typeof L !== 'undefined') {
        return; // Already loaded
    }

    return new Promise((resolve, reject) => {
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        cssLink.crossOrigin = '';
        document.head.appendChild(cssLink);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Leaflet'));
        document.head.appendChild(script);
    });
}

/**
 * Create a circle polygon (approximation) for cylinder rendering
 */
function createCirclePolygon(
    centerLat: number,
    centerLon: number,
    radiusMeters: number,
    numPoints = 64
): [number, number][] {
    const coords: [number, number][] = [];

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;

        // Convert radius from meters to degrees (approximate)
        const latOffset = (radiusMeters / 111320) * Math.cos(angle);
        const lonOffset =
            (radiusMeters / (111320 * Math.cos((centerLat * Math.PI) / 180))) *
            Math.sin(angle);

        coords.push([centerLat + latOffset, centerLon + lonOffset]);
    }

    return coords;
}

/**
 * Create a Leaflet map provider
 */
export async function createLeafletProvider(container: HTMLElement): Promise<MapProvider> {
    await loadLeaflet();

    // Initialize the map
    const map = L.map(container, {
        center: [45, 0],
        zoom: 5,
        zoomControl: true,
    });

    // Add OpenStreetMap tiles (with terrain option)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });

    // OpenTopoMap for terrain view
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    });

    // Satellite layer (ESRI)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    });

    // Add default layer and layer control
    topoLayer.addTo(map);
    L.control.layers({
        'Topo': topoLayer,
        'Street': osmLayer,
        'Satellite': satelliteLayer,
    }).addTo(map);

    // Add scale control
    L.control.scale({ maxWidth: 200 }).addTo(map);

    // State
    let currentFixes: IGCFix[] = [];
    let currentTask: XCTask | null = null;
    let currentEvents: FlightEvent[] = [];
    let trackSegmentsGroup: any = L.layerGroup().addTo(map);
    let taskLayerGroup: any = L.layerGroup().addTo(map);
    let eventMarkersGroup: any = L.layerGroup().addTo(map);
    let highlightLayer: any = null;
    let activePopup: any = null;
    let boundsChangeCallback: (() => void) | null = null;

    // Listen for bounds changes
    map.on('moveend', () => {
        if (boundsChangeCallback) {
            boundsChangeCallback();
        }
    });

    /**
     * Get altitude-based color
     */
    function getAltitudeColor(altitude: number): string {
        if (altitude < 1000) return '#3b82f6';
        if (altitude < 2000) return '#22c55e';
        if (altitude < 3000) return '#eab308';
        return '#ef4444';
    }

    /**
     * Get turnpoint color based on type
     */
    function getTurnpointColor(type: string): string {
        switch (type) {
            case 'SSS': return '#22c55e';
            case 'ESS': return '#eab308';
            case 'TAKEOFF': return '#3b82f6';
            default: return '#a855f7';
        }
    }

    /**
     * Render the track with event-based coloring
     */
    function renderTrackWithEvents(): void {
        // Clear existing track segments
        trackSegmentsGroup.clearLayers();

        if (currentFixes.length === 0) return;

        // Build a map of fix index -> event type for segments
        const fixEventType: (string | null)[] = new Array(currentFixes.length).fill(null);

        for (const event of currentEvents) {
            if (event.segment) {
                const eventType = event.type.includes('thermal') ? 'thermal' :
                    event.type.includes('glide') ? 'glide' : null;
                if (eventType) {
                    for (let i = event.segment.startIndex; i <= event.segment.endIndex; i++) {
                        fixEventType[i] = eventType;
                    }
                }
            }
        }

        // Create segments with consistent colors
        let segmentStart = 0;
        let currentType = fixEventType[0];

        for (let i = 1; i <= currentFixes.length; i++) {
            const nextType = i < currentFixes.length ? fixEventType[i] : 'END';

            if (nextType !== currentType || i === currentFixes.length) {
                // Create segment from segmentStart to i
                const segmentFixes = currentFixes.slice(segmentStart, i + 1);
                const latlngs = segmentFixes.map(fix => [fix.latitude, fix.longitude] as [number, number]);

                // Color based on event type
                const color = currentType === 'thermal' ? '#f97316' :  // orange
                    currentType === 'glide' ? '#3b82f6' :     // blue
                        '#9ca3af';                                 // gray (default)

                const polyline = L.polyline(latlngs, {
                    color,
                    weight: 3,
                    opacity: 0.9,
                });
                trackSegmentsGroup.addLayer(polyline);

                segmentStart = i;
                currentType = nextType as string | null;
            }
        }

        // Fit bounds
        const bounds = L.latLngBounds(
            currentFixes.map(fix => [fix.latitude, fix.longitude])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    const provider: MapProvider = {
        setTrack(fixes: IGCFix[]) {
            currentFixes = fixes;
            renderTrackWithEvents();
        },

        setTask(task: XCTask) {
            currentTask = task;

            // Clear existing task elements
            taskLayerGroup.clearLayers();

            if (!task || task.turnpoints.length === 0) return;

            // Create task line
            const linePath = task.turnpoints.map(tp => [tp.waypoint.lat, tp.waypoint.lon] as [number, number]);
            const taskLine = L.polyline(linePath, {
                color: '#6366f1',
                weight: 2,
                opacity: 0.8,
                dashArray: '8, 8',
            });
            taskLayerGroup.addLayer(taskLine);

            // Create cylinders and markers
            for (const tp of task.turnpoints) {
                const color = getTurnpointColor(tp.type || '');

                // Create circle (cylinder)
                const circle = L.circle([tp.waypoint.lat, tp.waypoint.lon], {
                    radius: tp.radius,
                    color,
                    weight: 2,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: 0.15,
                });
                taskLayerGroup.addLayer(circle);

                // Create marker
                const markerIcon = L.divIcon({
                    className: 'leaflet-task-marker',
                    html: `<div style="
                        width: 12px; 
                        height: 12px; 
                        border-radius: 50%;
                        background: ${color}; 
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                });
                const marker = L.marker([tp.waypoint.lat, tp.waypoint.lon], { icon: markerIcon })
                    .bindTooltip(tp.waypoint.name || '', {
                        permanent: false,
                        direction: 'top',
                    });
                taskLayerGroup.addLayer(marker);
            }

            // Fit to task if no track
            if (currentFixes.length === 0) {
                const bounds = L.latLngBounds(
                    task.turnpoints.map(tp => [tp.waypoint.lat, tp.waypoint.lon])
                );
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        },

        setEvents(events: FlightEvent[]) {
            currentEvents = events;

            // Re-render track with event-based coloring
            if (currentFixes.length > 0) {
                renderTrackWithEvents();
            }

            // Clear existing markers
            eventMarkersGroup.clearLayers();

            // Key event types to show
            const keyEventTypes = new Set([
                'takeoff', 'landing', 'start_crossing', 'goal_crossing',
                'max_altitude', 'turnpoint_entry',
            ]);

            for (const event of events) {
                if (!keyEventTypes.has(event.type)) continue;

                const style = getEventStyle(event.type);

                const markerIcon = L.divIcon({
                    className: 'leaflet-event-marker',
                    html: `<div style="
                        width: 20px; 
                        height: 20px; 
                        border-radius: 50%;
                        background: ${style.color}; 
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        cursor: pointer;
                    "></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });

                const marker = L.marker([event.latitude, event.longitude], { icon: markerIcon })
                    .bindPopup(`<strong>${event.description}</strong><br>
                        <span style="color:#666">${event.time.toLocaleTimeString()}</span>`);
                eventMarkersGroup.addLayer(marker);
            }
        },

        panToEvent(event: FlightEvent) {
            // Close existing popup
            if (activePopup) {
                map.closePopup(activePopup);
                activePopup = null;
            }

            // Clear highlight
            if (highlightLayer) {
                map.removeLayer(highlightLayer);
                highlightLayer = null;
            }

            // Highlight segment if present
            if (event.segment && currentFixes.length > 0) {
                const segmentFixes = currentFixes.slice(event.segment.startIndex, event.segment.endIndex + 1);
                const latlngs = segmentFixes.map(fix => [fix.latitude, fix.longitude] as [number, number]);

                highlightLayer = L.polyline(latlngs, {
                    color: '#00ffff',
                    weight: 6,
                    opacity: 0.9,
                }).addTo(map);
            }

            // Determine popup location
            let popupLat = event.latitude;
            let popupLng = event.longitude;

            if (event.segment && currentFixes.length > 0) {
                const isStartEvent = event.type === 'thermal_entry' || event.type === 'glide_start';
                const fixIndex = isStartEvent ? event.segment.startIndex : event.segment.endIndex;
                const fix = currentFixes[fixIndex];
                if (fix) {
                    popupLat = fix.latitude;
                    popupLng = fix.longitude;
                }
            }

            // Show popup
            const style = getEventStyle(event.type);
            activePopup = L.popup({ closeOnClick: false })
                .setLatLng([popupLat, popupLng])
                .setContent(`
                    <div style="min-width: 150px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${style.color};"></span>
                            <strong>${event.description}</strong>
                        </div>
                        <div style="color: #94a3b8; font-size: 0.8125rem;">
                            ${event.time.toLocaleTimeString()} | ${event.altitude.toFixed(0)}m
                        </div>
                    </div>
                `)
                .openOn(map);

            // Pan to location
            map.setView([event.latitude, event.longitude], 14, {
                animate: true,
                duration: 1,
            });
        },

        getBounds(): MapBounds {
            const bounds = map.getBounds();
            return {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest(),
            };
        },

        onBoundsChange(callback: () => void) {
            boundsChangeCallback = callback;
        },

        destroy() {
            trackSegmentsGroup.clearLayers();
            taskLayerGroup.clearLayers();
            eventMarkersGroup.clearLayers();
            if (highlightLayer) {
                map.removeLayer(highlightLayer);
            }
            map.remove();
        },
    };

    return provider;
}
