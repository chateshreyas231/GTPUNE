import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serviceArea } from "./areas.js";

const root = dirname(fileURLToPath(import.meta.url));
const scripts = new Map([
  ["/client.js", "client.js"],
  ["/areas.js", "areas.js"],
  ["/missions.js", "missions.js"],
  ["/save.js", "save.js"],
  ["/cheats.js", "cheats.js"],
  ["/tips.js", "tips.js"],
  ["/scene.js", "scene.js"],
]);

function renderHome() {
  const areas = serviceArea.neighbourhoods.map((area) => {
    const locked = area.id !== "fc-road";
    return `<li><button type="button" data-area="${area.id}">${area.name}${locked ? " — Locked" : " — Chapter 1"}</button></li>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GTPUNE</title>
  <style>
    :root { color-scheme: light; }
    html, body { height: 100%; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #1c1917; background: #efe6d6; }
    #layout { display: grid; grid-template-columns: 16rem 1fr; height: 100%; }
    aside { padding: 1rem 1rem 2rem; }
    h1 { font-size: 1.8rem; margin: 0 0 0.2rem; }
    p { margin: 0.35rem 0; line-height: 1.4; }
    button { font: inherit; }
    #areas { list-style: none; padding: 0; margin: 0.5rem 0; }
    #areas button { width: 100%; text-align: left; margin: 0.2rem 0; padding: 0.35rem 0.5rem; border-radius: 0.4rem; border: 1px solid #d6d3d1; background: #fff; }
    #missions { padding-left: 1.1rem; }
    meter { width: 100%; }
    #stage { position: relative; min-height: 0; height: 100%; }
    canvas { width: 100%; height: 100%; display: block; background: #d7c4a3; }
    #line { min-height: 3rem; }
    #cheat { width: 100%; margin-top: 0.4rem; font: inherit; padding: 0.35rem; }
    #loader { position: fixed; inset: 0; display: grid; place-items: center; background: #1c1917; color: #f5f0e8; text-align: center; padding: 1.5rem; }
    #loader[hidden] { display: none; }
    #loader h2 { font-size: 2.4rem; margin-bottom: 0.25rem; }
    @media (max-width: 800px) {
      #layout { grid-template-columns: 1fr; grid-template-rows: auto minmax(70vh, 1fr); height: auto; }
      #stage { height: 70vh; }
    }
  </style>
</head>
<body>
  <div id="layout">
    <aside>
      <h1>GTPUNE</h1>
      <p>Chapter 1 is FC Road, Pune. You are new here, with one bag and an old scooter.</p>
      <ul id="areas">${areas}</ul>
      <p id="vehicle">On foot</p>
      <p id="bag">Bag: one bag</p>
      <p id="cash">₹0</p>
      <p id="weather">Clear</p>
      <label>Scene <meter id="scene" min="0" max="100" value="0"></meter></label>
      <p id="cheated" hidden>Save marked cheated</p>
      <h2>Missions</h2>
      <ul id="missions"></ul>
      <p id="line" aria-live="polite"></p>
      <p>WASD or arrows move. E interact. H honk.</p>
      <input id="cheat" hidden placeholder="A word for the road" autocomplete="off">
    </aside>
    <div id="stage">
      <canvas id="game" width="960" height="640"></canvas>
    </div>
  </div>
  <div id="loader">
    <div>
      <h2>GTPUNE</h2>
      <p>Chapter 1 · FC Road, Pune</p>
      <p id="tip"></p>
      <p>Press Enter</p>
    </div>
  </div>
  <script type="module" src="/client.js"></script>
</body>
</html>`;
}

function send(res, status, body, type) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

export function createApp() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (pathname === "/") {
      if (req.method !== "GET") {
        res.writeHead(405, { allow: "GET", "content-type": "text/plain; charset=utf-8" });
        res.end("Method not allowed");
        return;
      }
      send(res, 200, renderHome(), "text/html; charset=utf-8");
      return;
    }

    if (pathname === "/areas") {
      if (req.method !== "GET") {
        res.writeHead(405, { allow: "GET", "content-type": "text/plain; charset=utf-8" });
        res.end("Method not allowed");
        return;
      }
      send(res, 200, JSON.stringify(serviceArea), "application/json; charset=utf-8");
      return;
    }

    const script = scripts.get(pathname);
    if (script && req.method === "GET") {
      send(res, 200, readFileSync(join(root, script)), "text/javascript; charset=utf-8");
      return;
    }

    send(res, 404, "Not found", "text/plain; charset=utf-8");
  });
}
