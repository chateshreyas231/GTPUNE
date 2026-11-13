import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { serviceArea } from "./areas.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const files = new Map([
  ["/index.html", "public/index.html"],
  ["/game.js", "src/game.js"],
  ["/missions.js", "src/missions.js"],
  ["/save.js", "src/save.js"],
  ["/areas.js", "src/areas.js"],
  ["/street.js", "src/street.js"],
  ["/vendor/three/three.module.js", "vendor/three/three.module.js"],
  ["/vendor/rapier/rapier.es.js", "vendor/rapier/rapier.es.js"],
  [
    "/vendor/rapier/rapier_wasm3d_bg.wasm",
    "vendor/rapier/rapier_wasm3d_bg.wasm",
  ],
]);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".jpg", "image/jpeg"],
  [".glb", "model/gltf-binary"],
]);

function contentType(filePath) {
  const dot = filePath.lastIndexOf(".");
  return types.get(filePath.slice(dot)) ?? "application/octet-stream";
}

function send(res, status, body, type) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function readPublic(pathname) {
  const relative = files.get(pathname);
  if (!relative) return null;
  const filePath = normalize(join(root, relative));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return null;
  return { filePath, body: readFileSync(filePath) };
}

function readPrototype(pathname) {
  const dist = resolve(root, "dist");
  const filePath = resolve(
    dist,
    pathname === "/" ? "index.html" : `.${pathname}`,
  );
  if (!filePath.startsWith(dist + sep) || !existsSync(filePath)) return null;
  try {
    return { filePath, body: readFileSync(filePath) };
  } catch {
    return null;
  }
}

export function createApp({ prototype = false } = {}) {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (
      prototype &&
      (pathname === "/" ||
        pathname === "/index.html" ||
        pathname.startsWith("/assets/") ||
        pathname.startsWith("/data/") ||
        pathname.startsWith("/audio/"))
    ) {
      if (req.method !== "GET") {
        res.writeHead(405, { allow: "GET" });
        res.end("Method not allowed");
        return;
      }
      const file = readPrototype(pathname);
      if (!file) {
        send(
          res,
          pathname === "/" ? 503 : 404,
          pathname === "/"
            ? "Build the prototype with npm run build before starting."
            : "Not found",
          "text/plain; charset=utf-8",
        );
        return;
      }
      send(res, 200, file.body, contentType(file.filePath));
      return;
    }

    if (
      pathname === "/" ||
      pathname === "/classic" ||
      pathname === "/classic/"
    ) {
      if (req.method !== "GET") {
        res.writeHead(405, {
          allow: "GET",
          "content-type": "text/plain; charset=utf-8",
        });
        res.end("Method not allowed");
        return;
      }
      const page = readPublic("/index.html");
      send(res, 200, page.body, contentType(page.filePath));
      return;
    }

    if (pathname === "/areas") {
      if (req.method !== "GET") {
        res.writeHead(405, {
          allow: "GET",
          "content-type": "text/plain; charset=utf-8",
        });
        res.end("Method not allowed");
        return;
      }
      send(
        res,
        200,
        JSON.stringify(serviceArea),
        "application/json; charset=utf-8",
      );
      return;
    }

    if (req.method !== "GET") {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const file = readPublic(pathname);
    if (!file) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, file.body, contentType(file.filePath));
  });
}
