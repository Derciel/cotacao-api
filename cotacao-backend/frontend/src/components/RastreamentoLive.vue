<template>
  <div class="rastreamento-live">
    <div class="map-container" ref="mapContainer">
      <!-- Map will be initialized here -->
    </div>

    <!-- Alert Panel -->
    <div v-if="activeAlert" class="alert-panel">
      <div class="alert-header">
        <h3>������⚠ ALERTA DE DESVIO</h3>
        <button @click="acknowledgeAlert" class="acknowledge-btn">
          Reconhecer
        </button>
      </div>
      <div class="alert-body">
        <p><strong>Caminhão:</strong> {{ activeAlert.truck.licensePlate }}</p>
        <p><strong>Motorista:</strong> {{ activeAlert.truck.driverName }}</p>
        <p><strong>Distância da rota:</strong> {{ activeAlert.deviationDistance.toFixed(0) }}m</p>
        <p><strong>Limite permitido:</strong> {{ activeAlert.route.deviationThreshold }}m</p>
        <p><strong>Horário:</strong> {{ formatTimestamp(activeAlert.timestamp) }}</p>
        <p><strong>Última posição conhecida:</strong></p>
        <p>
          {{ activeAlert.lastPosition.latitude.toFixed(6) }},
          {{ activeAlert.lastPosition.longitude.toFixed(6) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import io from 'socket.io-client';

export default {
  name: 'RastreamentoLive',
  setup() {
    // Map state
    const mapContainer = ref(null);
    const map = ref(null);
    const center = ref([-15.793889, -47.882778]); // Brasília coordinates as default
    const zoom = ref(13);

    // Data
    const trucks = ref([]); // Array of truck objects with position data
    const routes = ref([]); // Array of route objects
    const activeAlert = ref(null); // Current active alert
    const markers = ref({}); // Map of truckId to Leaflet marker
    const polylines = ref({}); // Map of routeId to Leaflet polyline
    const socket = ref(null); // WebSocket connection

    // Initialize Leaflet map
    const initMap = () => {
      if (mapContainer.value && !map.value) {
        // Initialize Leaflet map
        map.value = L.map(mapContainer.value).setView(center.value, zoom.value);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.value);

        // Update center and zoom when map moves
        map.value.on('moveend', () => {
          const newCenter = map.value.getCenter();
          center.value = [newCenter.lat, newCenter.lng];
        });

        map.value.on('zoomend', () => {
          zoom.value = map.value.getZoom();
        });
      }
    };

    // Initialize WebSocket connection
    const initWebSocket = () => {
      // In a real app, this would come from environment variables
      const wsUrl =
        import.meta.env.VITE_WS_URL ||
        `${window.location.origin.replace(/^http/, 'ws')}`;
      socket.value = io(wsUrl, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.value.on('connect', () => {
        console.log('WebSocket connected');
        // Join a room for general alerts or user-specific alerts
        socket.value.emit('join', 'route_monitoring');
      });

      socket.value.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        // Attempt to reconnect
      });

      // Listen for deviation alerts
      socket.value.on('deviation-alert', (alertData) => {
        handleDeviationAlert(alertData);
      });

      // Listen for truck position updates (if using WebSocket for positions too)
      socket.value.on('truck-position', (positionData) => {
        updateTruckPosition(positionData);
      });
    };

    // Handle incoming deviation alert
    const handleDeviationAlert = (alertData) => {
      // Play alert sound
      playAlertSound();

      // Set active alert (in a real app, we might queue multiple alerts)
      activeAlert.value = {
        ...alertData,
        timestamp: new Date(alertData.timestamp),
      };

      // Optionally, we could also update the truck's position in the markers
      if (alertData.lastPosition) {
        updateTruckPosition({
          licensePlate: alertData.truck.licensePlate,
          latitude: alertData.lastPosition.latitude,
          longitude: alertData.lastPosition.longitude,
          speed: alertData.lastPosition.speed,
          status: alertData.lastPosition.status,
          isDeviated: true,
          deviationDistance: alertData.deviationDistance,
        });
      }
    };

    // Acknowledge the current alert
    const acknowledgeAlert = () => {
      activeAlert.value = null;
      // In a real app, we might also notify the backend that the alert was acknowledged
      if (socket.value) {
        socket.value.emit('alert-acknowledged', {
          // alertId would be needed in a real implementation
        });
      }
    };

    // Play alert sound using Web Audio API
    const playAlertSound = () => {
      // Create or resume audio context
      if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Create oscillator
      const oscillator = window.audioContext.createOscillator();
      const gainNode = window.audioContext.createGain();

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(window.audioContext.destination);

      // Set parameters for alert sound
      oscillator.frequency.setValueAtTime(800, window.audioContext.currentTime); // 800 Hz
      gainNode.gain.setValueAtTime(0.7, window.audioContext.currentTime); // Volume
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        window.audioContext.currentTime + 2.0
      ); // Fade out over 2 seconds

      // Start and stop
      oscillator.start();
      oscillator.stop(window.audioContext.currentTime + 2.2);

      // Clean up after finished
      setTimeout(() => {
        if (window.audioContext.state === 'closed') {
          window.audioContext = null;
        }
      }, 2500);
    };

    // Update or add a truck position
    const updateTruckPosition = (truckData) => {
      // Find existing truck index
      const existingIndex = trucks.value.findIndex(
        (t) => t.licensePlate === truckData.licensePlate
      );

      const truckObject = {
        licensePlate: truckData.licensePlate,
        latitude: truckData.latitude,
        longitude: truckData.longitude,
        speed: truckData.speed,
        status: truckData.status || 'unknown',
        driverName: truckData.driverName || 'Não informado',
        isDeviated: truckData.isDeviated || false,
        deviationDistance: truckData.deviationDistance,
        lastUpdate: new Date(),
      };

      if (existingIndex >= 0) {
        trucks.value[existingIndex] = truckObject;
      } else {
        trucks.value.push(truckObject);
      }

      // Update or create marker on map
      updateTruckMarker(truckObject);
    };

    // Update or create a Leaflet marker for a truck
    const updateTruckMarker = (truck) => {
      if (!map.value) return;

      // Remove existing marker if present
      if (markers.value[truck.licensePlate]) {
        map.value.removeLayer(markers.value[truck.licensePlate]);
      }

      // Create new marker
      const marker = L.marker([truck.latitude, truck.longitude], {
        icon: getTruckIcon(truck),
        title: `${truck.licensePlate} - ${truck.driverName}`,
      }).addTo(map.value);

      // Bind popup
      marker.bindPopup(createTruckPopup(truck));

      // Store marker reference
      markers.value[truck.licensePlate] = marker;

      // Auto-pan to show the truck if it's deviated or on first load
      if (truck.isDeviated || trucks.value.length === 1) {
        map.value.setView([truck.latitude, truck.longitude], Math.max(zoom.value, 15));
      }
    };

    // Create popup content for a truck
    const createTruckPopup = (truck) => {
      const popupContent = document.createElement('div');
      popupContent.className = 'popup-content';
      popupContent.innerHTML = `
        <strong>Caminhão:</strong> ${truck.licensePlate}<br />
        <strong>Motorista:</strong> ${truck.driverName}<br />
        <strong>Velocidade:</strong> ${truck.speed?.toFixed(1)} km/h<br />
        <strong>Status:</strong>
        <span class="status-badge ${truck.status}">
          ${truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
        </span>
        ${truck.isDeviated
          ? `<br /><span class="deviation-alert">� ����� �� DESVIO: ${truck.deviationDistance?.toFixed(
              0
            )}m</span>`
          : ''
        }
      `;
      return popupContent;
    };

    // Load routes (in a real app, this would come from an API)
    const loadRoutes = async () => {
      try {
        // This is a placeholder - in reality, we'd call an API to get active routes
        // For now, we'll use mock data or empty array

        // For demo purposes, we'll add a sample route if none exist
        if (routes.value.length === 0) {
          routes.value = [
            {
              id: 1,
              name: 'Rota Exemplo 1',
              coordinates: [
                [-15.7801, -47.9292],
                [-15.7950, -47.8900],
                [-15.8100, -47.8500],
                [-15.7900, -47.8200],
              ],
              color: 'blue',
              deviationThreshold: 100, // meters
            },
            {
              id: 2,
              name: 'Rota Exemplo 2',
              coordinates: [
                [-15.8200, -47.8800],
                [-15.8000, -47.8600],
                [-15.7800, -47.8400],
                [-15.7600, -47.8200],
              ],
              color: 'green',
              deviationThreshold: 150,
            },
          ];

          // Create polylines for routes
          routes.value.forEach((route) => {
            createRoutePolyline(route);
          });
        }
      } catch (error) {
        console.error('Failed to load routes:', error);
      }
    };

    // Create or update a Leaflet polyline for a route
    const createRoutePolyline = (route) => {
      if (!map.value) return;

      // Remove existing polyline if present
      if (polylines.value[route.id]) {
        map.value.removeLayer(polylines.value[route.id]);
      }

      // Convert coordinates to Leaflet latlngs
      const latLngs = route.coordinates.map(
        (coord) => [coord.latitude, coord.longitude]
      );

      // Create polyline
      const polyline = L.polyline(latLngs, {
        color: route.color || 'blue',
        weight: 4,
        opacity: 0.7,
      }).addTo(map.value);

      // Bind popup
      polyline.bindPopup(
        `<strong>Rota:</strong> ${route.name}<br /><strong>Limite de desvio:</strong> ${route.deviationThreshold}m`
      );

      // Store polyline reference
      polylines.value[route.id] = polyline;

      // Fit bounds to show all routes
      if (routes.value.length > 0) {
        const allLatLngs = routes.value.flatMap((r) =>
          r.coordinates.map((c) => [c.latitude, c.longitude])
        );
        if (allLatLngs.length > 0) {
          const bounds = L.latLngBounds(allLatLngs);
          map.value.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    };

    // Get appropriate icon for truck based on status
    const getTruckIcon = (truck) => {
      // Define icon properties based on status
      let iconColor = 'green'; // Default to normal
      if (truck.status === 'deviated' || truck.isDeviated) {
        iconColor = 'red';
      } else if (truck.status === 'stopped' || truck.speed === 0) {
        iconColor = 'orange';
      }

      // Create custom icon
      return L.icon({
        iconUrl: `https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-${iconColor}.png`,
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });
    };

    // Format timestamp for display
    const formatTimestamp = (date) => {
      if (!(date instanceof Date)) {
        date = new Date(date);
      }
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    // Load routes on mount
    const loadInitialData = () => {
      loadRoutes();
    };

    // Initialize the component
    const initialize = () => {
      initMap();
      loadInitialData();
      initWebSocket();

      // In a real app, we might also start polling for truck positions via REST
      // or set up another WebSocket for position updates
    };

    // Cleanup on unmount
    onBeforeUnmount(() => {
      if (socket.value) {
        socket.value.disconnect();
        socket.value = null;
      }
      // Close audio context to prevent leaks
      if (window.audioContext) {
        window.audioContext.close();
        window.audioContext = null;
      }
      // Remove map
      if (map.value) {
        map.value.remove();
        map.value = null;
      }
    });

    // Lifecycle hooks
    onMounted(() => {
      initialize();
    });

    // Return exposed properties and methods
    return {
      mapContainer,
      center,
      zoom,
      trucks,
      routes,
      activeAlert,
      acknowledgeAlert,
      formatTimestamp,
      getTruckIcon,
      // Leaflet
      L,
    };
  },
};
</script>

<style scoped>
.rastreamento-live {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.alert-panel {
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(255, 68, 68, 0.95);
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 350px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.alert-header h3 {
  margin: 0;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.acknowledge-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.acknowledge-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.alert-body {
  padding: 20px;
}

.alert-body p {
  margin: 8px 0;
  line-height: 1.4;
}

.alert-body p strong {
  display: inline-block;
  min-width: 120px;
}

.status-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.ativo {
  background: #d4edda;
  color: #155724;
}

.status-badge.parado {
  background: #fff3cd;
  color: #856404;
}

.status-badge.deviated {
  background: #f8d7da;
  color: #721c24;
}

.deviation-alert {
  display: inline-block;
  background: #ffeb3b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
  font-weight: bold;
  margin-top: 4px;
}

.popup-content {
  line-height: 1.4;
  min-width: 200px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .alert-panel {
    top: 10px;
    left: 10px;
    max-width: calc(100% - 20px);
  }

  .alert-header h3 {
    font-size: 1.1rem;
  }

  .alert-body {
    padding: 16px;
  }
}
</style>