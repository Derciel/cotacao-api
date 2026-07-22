// Native fetch
import { config } from 'dotenv';
config({ path: './frontend/.env' });

const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;

const payload = {
  origin: { location: { latLng: { latitude: -23.5505, longitude: -46.6333 } } }, // SP
  destination: { location: { latLng: { latitude: -22.9068, longitude: -43.1729 } } }, // RJ
  travelMode: "DRIVE",
  routingPreference: "TRAFFIC_AWARE",
  extraComputations: ["TOLLS"]
};

fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'routes.travelAdvisory.tollInfo,routes.legs'
  },
  body: JSON.stringify(payload)
}).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
