import { createApp } from "./server.js";

const port = Number(process.env.PORT) || 3000;
const server = createApp({ prototype: true });

server.listen(port, () => {
  console.log(`GTPUNE listening on http://localhost:${port}`);
});
