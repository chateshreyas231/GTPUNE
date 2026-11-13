# GTPUNE

Neighbourhood rides in Pune. The service area is Pune only:

- Kothrud
- Karve Nagar
- FC Road

## Run

Node.js 20+.

```bash
npm start
```

Open http://localhost:3000.

Pick a pickup and a dropoff, then request a ride. The page shows the fare, a driver, and the status as it moves through finding, arriving, on trip, and done. Set `PORT` to listen somewhere else.

Fare is ₹30 plus ₹10 per kilometre: Kothrud–Karve Nagar 2 km (₹50), Karve Nagar–FC Road 5 km (₹80), Kothrud–FC Road 6 km (₹90).

## Check

```bash
npm test
```

## Layout

- `src/areas.js` — GTPUNE's Pune service area
- `src/fare.js` — fare for a route between two neighbourhoods
- `src/rides.js` — in-memory ride, driver, and status
- `src/server.js` — browser page and HTTP API
- `src/index.js` — process entry for `npm start`
- `test/` — fare, states, and routes
