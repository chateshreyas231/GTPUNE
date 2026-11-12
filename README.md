# GTPUNE

A small browser game on FC Road in Pune. You are new on the road, with one bag and an old scooter. Kothrud and Karve Nagar are on the board and locked. This chapter is FC Road.

Walk or ride between the college strip, a chai stall, a bookshop, and a signal. Two deliveries and two street stories make the chapter. Rain pays extra on a delivery. Between jobs you can stop for chai, play a short gully-cricket moment, or pet the street dog. An auto sits by the signal. The Scene meter fills if the road gets loud; settle it with a chappal, a newspaper, or a dabba.

## Run

Node 20+.

```bash
PORT=3001 npm start
```

Open http://localhost:3001.

WASD or arrow keys move. E interacts. H honks. `/` opens a word: `pavsa` for rain, `unhala` to clear it, `paise` for cash. A cheat marks the save. Progress stays in the browser.

## Check

```bash
npm test
```

## Layout

- `src/missions.js` — the four FC Road missions
- `src/save.js` — browser save shape
- `src/cheats.js` — weather and cash words
- `src/client.js` — the top-down chapter
- `src/server.js` — the page
- `src/index.js` — `npm start`
