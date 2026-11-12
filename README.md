# GTPUNE

A third-person chapter on FC Road in Pune. You are new on the road, with one bag. Kothrud and Karve Nagar are listed and locked. FC Road is a textured stretch: lanes, a junction, the college strip, a chai stall, and a bookshop. The drawings are made in the page, not imported.

Two deliveries start at the chai stall. An old scooter and an auto are parked on the road. The libraries are Three.js and Rapier, loaded in the browser with no build step.

## Run

Node 20+.

```bash
PORT=3001 npm start
```

Open http://localhost:3001.

Click the street to look with the mouse. WASD moves. Shift sprints. Space jumps. E interacts. F enters or leaves the scooter or the auto. H honks. N toggles night. R toggles rain. Progress stays in the browser.

## Check

```bash
npm test
```

## Layout

- `src/game.js` — the player, vehicles, camera, and weather
- `src/street.js` — the road, facades, and street props
- `src/missions.js` — the two deliveries
- `src/save.js` — the browser save
- `public/index.html` — the page
- `vendor/` — Three.js and Rapier, served as-is
- `src/index.js` — `npm start`
