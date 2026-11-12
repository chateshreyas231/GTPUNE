import { createApp } from "./server.js";

const port = Number(process.env.PORT) || 3000;
const server = createApp();

server.listen(port, () => {
  console.log(`City Rider listening on http://localhost:${port}`);
});
