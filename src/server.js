import { createServer } from "node:http";
import { serviceArea } from "./areas.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderHome() {
  const items = serviceArea.neighbourhoods
    .map((neighbourhood) => `<li>${escapeHtml(neighbourhood.name)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(serviceArea.product)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #1a1a1a; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    p { margin-top: 0; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(serviceArea.product)}</h1>
    <p>Neighbourhood rides in ${escapeHtml(serviceArea.city)}.</p>
    <h2>Service area</h2>
    <ul>
      ${items}
    </ul>
  </main>
</body>
</html>`;
}

export function createApp() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname !== "/" && pathname !== "/areas") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, {
        allow: "GET",
        "content-type": "text/plain; charset=utf-8",
      });
      res.end("Method not allowed");
      return;
    }

    if (pathname === "/areas") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(serviceArea));
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderHome());
  });
}
