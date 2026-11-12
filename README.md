# City Rider

Neighbourhood rides in Pune. The service area is Pune only:

- Kothrud
- Karve Nagar
- FC Road

## Run

Requires Node.js 20 or newer.

```bash
npm start
```

Open http://localhost:3000. Set `PORT` to listen somewhere else.

`GET /areas` returns the same service area as JSON.

## Check

```bash
npm test
```

## Layout

- `src/areas.js` — City Rider's Pune service area
- `src/server.js` — HTTP app
- `src/index.js` — process entry
- `test/` — service area and route checks
