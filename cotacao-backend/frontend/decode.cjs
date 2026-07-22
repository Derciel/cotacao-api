const OpenLocationCode = require('open-location-code').OpenLocationCode;
const openLocationCode = new OpenLocationCode();
try {
  // Decode PV72+7V with Londrina coordinates as reference
  const fullCode = openLocationCode.recoverNearest("PV72+7V", -23.3106, -51.1628);
  const decoded = openLocationCode.decode(fullCode);
  console.log("Full Code:", fullCode);
  console.log("Coordinates:", decoded.latitudeCenter, decoded.longitudeCenter);
} catch(e) {
  console.log("Error:", e);
}
