import { createServer } from "node:http";
import { serviceArea } from "./areas.js";
import { createRideBook } from "./rides.js";

const clientScript = `
const labels = {
  finding: "Finding",
  arriving: "Arriving",
  "on trip": "On trip",
  done: "Done",
};

const form = document.querySelector("#ride-form");
const pickup = document.querySelector("#pickup");
const dropoff = document.querySelector("#dropoff");
const requestButton = document.querySelector("#request");
const error = document.querySelector("#error");
const route = document.querySelector("#route");
const fare = document.querySelector("#fare");
const driver = document.querySelector("#driver");
const status = document.querySelector("#status");
const steps = document.querySelectorAll("#statuses li");

let generation = 0;

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function show(ride) {
  route.textContent = ride.pickup.name + " → " + ride.dropoff.name;
  fare.textContent = "₹" + ride.fareInr;
  driver.textContent = ride.driver.name + " · " + ride.driver.vehicle;
  status.textContent = labels[ride.status];
  for (const step of steps) {
    if (step.dataset.status === ride.status) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  }
  requestButton.disabled = ride.status !== "done";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = ++generation;
  requestButton.disabled = true;
  error.textContent = "";

  try {
  const response = await fetch("/rides", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pickupId: pickup.value,
      dropoffId: dropoff.value,
    }),
  });
  const body = await response.json();
  if (token !== generation) return;

  if (!response.ok) {
    requestButton.disabled = false;
    route.textContent = "";
    fare.textContent = "";
    driver.textContent = "";
    status.textContent = "";
    for (const step of steps) step.removeAttribute("aria-current");
    error.textContent = body.error || "Could not request a ride";
    return;
  }

  show(body);

  while (token === generation && body.status !== "done") {
    await delay(1200);
    if (token !== generation) return;
    const next = await fetch("/rides/" + body.id + "/advance", { method: "POST" });
    const ride = await next.json();
    if (token !== generation) return;
    if (!next.ok) {
      requestButton.disabled = false;
      error.textContent = ride.error || "Could not update the ride";
      return;
    }
    show(ride);
    body.status = ride.status;
  }
  } catch (err) {
    if (token !== generation) return;
    requestButton.disabled = false;
    error.textContent = "Could not request a ride";
  }
});
`;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function neighbourhoodOptions(selectedId) {
  return serviceArea.neighbourhoods
    .map((neighbourhood) => {
      const selected = neighbourhood.id === selectedId ? " selected" : "";
      return `<option value="${escapeHtml(neighbourhood.id)}"${selected}>${escapeHtml(neighbourhood.name)}</option>`;
    })
    .join("");
}

function renderHome() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(serviceArea.product)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; color: #1c1917; background: #f6f3ee; }
    main { max-width: 36rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    h1 { font-size: 2rem; margin: 0 0 0.25rem; }
    .lede { margin: 0 0 1.5rem; color: #44403c; }
    form { display: grid; gap: 0.75rem; }
    label { display: grid; gap: 0.25rem; font-weight: 600; }
    select, button { font: inherit; }
    select { padding: 0.55rem 0.6rem; border: 1px solid #d6d3d1; border-radius: 0.5rem; background: #fff; }
    button { padding: 0.7rem 1rem; border: 0; border-radius: 0.5rem; background: #9a3412; color: #fff; font-weight: 700; }
    button:disabled { opacity: 0.55; }
    #error { min-height: 1.25rem; margin: 0.75rem 0 0; color: #9f1239; }
    #ride { margin-top: 1.25rem; padding: 1rem; background: #fff; border-radius: 0.75rem; }
    #statuses { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
    #statuses li { padding: 0.15rem 0.6rem; border-radius: 999px; background: #f5f5f4; color: #78716c; }
    #statuses li[aria-current="step"] { background: #9a3412; color: #fff; }
    #route, #driver, #status { margin: 0.35rem 0; }
    #fare { margin: 0.35rem 0; font-size: 1.5rem; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(serviceArea.product)}</h1>
    <p class="lede">Neighbourhood rides in ${escapeHtml(serviceArea.city)}. Serving Kothrud, Karve Nagar, and FC Road.</p>
    <form id="ride-form">
      <label>Pickup
        <select id="pickup" name="pickup">${neighbourhoodOptions("kothrud")}</select>
      </label>
      <label>Dropoff
        <select id="dropoff" name="dropoff">${neighbourhoodOptions("karve-nagar")}</select>
      </label>
      <button id="request" type="submit">Request ride</button>
    </form>
    <p id="error" role="alert"></p>
    <section id="ride" aria-live="polite">
      <h2>Trip</h2>
      <p id="route"></p>
      <p id="fare"></p>
      <p id="driver"></p>
      <p id="status"></p>
      <ol id="statuses">
        <li data-status="finding">Finding</li>
        <li data-status="arriving">Arriving</li>
        <li data-status="on trip">On trip</li>
        <li data-status="done">Done</li>
      </ol>
    </section>
  </main>
  <script>${clientScript}</script>
</body>
</html>`;
}

function send(res, status, body, type) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

function methodNotAllowed(res, allow = "GET") {
  res.writeHead(405, {
    allow,
    "content-type": "text/plain; charset=utf-8",
  });
  res.end("Method not allowed");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export function createApp() {
  const book = createRideBook();

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const { pathname } = url;

      if (pathname === "/") {
        if (req.method !== "GET") {
          methodNotAllowed(res);
          return;
        }
        send(res, 200, renderHome(), "text/html; charset=utf-8");
        return;
      }

      if (pathname === "/areas") {
        if (req.method !== "GET") {
          methodNotAllowed(res);
          return;
        }
        sendJson(res, 200, serviceArea);
        return;
      }

      const advance = pathname.match(/^\/rides\/([^/]+)\/advance$/);
      if (advance) {
        if (req.method !== "POST") {
          methodNotAllowed(res, "POST");
          return;
        }
        sendJson(res, 200, book.advance(decodeURIComponent(advance[1])));
        return;
      }

      if (pathname === "/rides" && req.method === "POST") {
        const body = await readBody(req);
        sendJson(res, 201, book.request({
          pickupId: body.pickupId,
          dropoffId: body.dropoffId,
        }));
        return;
      }

      send(res, 404, "Not found", "text/plain; charset=utf-8");
    } catch (error) {
      if (res.headersSent) return;
      const status = error.message === "Unknown ride" ? 404 : 400;
      sendJson(res, status, { error: error.message || "Request failed" });
    }
  });
}
