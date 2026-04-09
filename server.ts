import http from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { attachChatNamespace } from "@/server/chat/attach-chat-namespace";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });
  attachChatNamespace(io.of("/chat"));

  httpServer.listen(port, hostname, () => {
    // eslint-disable-next-line no-console -- bootstrap log
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
