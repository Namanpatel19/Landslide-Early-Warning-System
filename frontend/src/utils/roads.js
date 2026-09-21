// Key Highway Segments for NER Road Connectivity prototype
// Approximate coordinates [lat, lon] for demonstration purposes

export const KEY_ROADS = [
  { id: 1, name: 'NH-27 (Silchar to Lumding)', coords: [[24.83, 92.80], [25.22, 93.05], [25.75, 93.17]] },
  { id: 2, name: 'NH-2 (Kohima to Imphal)', coords: [[25.67, 94.11], [25.20, 94.00], [24.81, 93.93]] },
  { id: 3, name: 'NH-702 (Mokokchung to Tuensang)', coords: [[26.33, 94.53], [26.25, 94.71], [26.27, 94.83]] },
  { id: 4, name: 'NH-10 (Siliguri to Gangtok)', coords: [[26.71, 88.43], [27.06, 88.46], [27.33, 88.61]] },
  { id: 5, name: 'NH-44 (Shillong to Agartala)', coords: [[25.57, 91.88], [25.17, 91.83], [24.53, 91.75], [23.83, 91.27]] },
  { id: 6, name: 'NH-15 (Tezpur to North Lakhimpur)', coords: [[26.63, 92.80], [26.84, 93.21], [27.23, 94.10]] },
  { id: 7, name: 'NH-29 (Dimapur to Kohima)', coords: [[25.90, 93.73], [25.81, 93.92], [25.67, 94.11]] },
];

export function getRoadStatus(road, activeRisks) {
  // Simple proximity check for prototype
  // If road is within ~0.1 degrees (~10-15km) of a High/Critical zone -> At Risk or Blocked
  let status = "Open";
  let color = "#16a34a"; // Green
  let nearestRisk = null;
  let minDistance = 999;

  for (const point of road.coords) {
    for (const risk of activeRisks) {
      if (risk.risk_level === 'Low') continue;
      
      const dLat = point[0] - risk.lat;
      const dLon = point[1] - risk.lon;
      const distance = Math.sqrt(dLat*dLat + dLon*dLon);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestRisk = risk;
      }
    }
  }

  if (nearestRisk && minDistance < 0.15) { // roughly 15km
    if (nearestRisk.risk_level === 'Critical') {
      status = "Likely Blocked";
      color = "#dc2626"; // Red
    } else if (nearestRisk.risk_level === 'High' || nearestRisk.risk_level === 'Medium') {
      status = "At Risk";
      color = "#ea580c"; // Orange
    }
  }

  return { status, color, nearestRisk, minDistance };
}
