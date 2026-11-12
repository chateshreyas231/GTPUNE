import { serviceArea } from "./areas.js";
import { quoteFare } from "./fare.js";

const DRIVERS = [
  { name: "Asha Kulkarni", vehicle: "White Swift" },
  { name: "Rohan Patil", vehicle: "Silver Activa" },
  { name: "Meera Joshi", vehicle: "Blue WagonR" },
];

const STATUSES = ["finding", "arriving", "on trip", "done"];

function neighbourhood(id) {
  const match = serviceArea.neighbourhoods.find((item) => item.id === id);
  if (!match) {
    throw new Error("Unknown neighbourhood");
  }
  return { id: match.id, name: match.name };
}

export function createRideBook() {
  const rides = new Map();
  let sequence = 0;

  return {
    request({ pickupId, dropoffId }) {
      const quote = quoteFare(pickupId, dropoffId);
      const id = `ride-${rides.size + 1}`;
      const ride = {
        id,
        pickup: neighbourhood(pickupId),
        dropoff: neighbourhood(dropoffId),
        fareInr: quote.fareInr,
        kilometres: quote.kilometres,
        driver: DRIVERS[sequence % DRIVERS.length],
        status: STATUSES[0],
      };
      sequence += 1;
      rides.set(id, ride);
      return ride;
    },

    advance(id) {
      const ride = rides.get(id);
      if (!ride) {
        throw new Error("Unknown ride");
      }
      const index = STATUSES.indexOf(ride.status);
      if (index < STATUSES.length - 1) {
        ride.status = STATUSES[index + 1];
      }
      return ride;
    },

    get(id) {
      return rides.get(id) ?? null;
    },
  };
}
