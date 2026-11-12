import { serviceArea } from "./areas.js";

const KILOMETRES = {
  "fc-road|karve-nagar": 5,
  "fc-road|kothrud": 6,
  "karve-nagar|kothrud": 2,
};

const BASE_INR = 30;
const PER_KM_INR = 10;

function knownIds() {
  return new Set(serviceArea.neighbourhoods.map((neighbourhood) => neighbourhood.id));
}

export function quoteFare(pickupId, dropoffId) {
  const ids = knownIds();
  if (!ids.has(pickupId) || !ids.has(dropoffId)) {
    throw new Error("Unknown neighbourhood");
  }
  if (pickupId === dropoffId) {
    throw new Error("Pickup and dropoff must be different neighbourhoods");
  }

  const kilometres = KILOMETRES[[pickupId, dropoffId].sort().join("|")];
  return {
    kilometres,
    fareInr: BASE_INR + PER_KM_INR * kilometres,
  };
}
