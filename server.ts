import http from "node:http";
import { parse } from "node:url";

import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { attachChatNamespace } from "@/server/chat/attach-chat-namespace";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

// Docker(윈도우 bind mount 등)에서는 네이티브 파일 이벤트가 안 올 때가 많음. Turbopack은 WATCHPACK_POLLING을 쓰지 않아
// 저장해도 HMR이 안 되는 경우가 있음 → 폴링이 켜진 환경에서는 webpack dev로 맞춤.
const useWebpackDev =
  dev &&
  (process.env.WATCHPACK_POLLING === "true" ||
    process.env.NEXT_DEV_WEBPACK === "1");

const app = next({
  dev,
  hostname,
  port,
  ...(useWebpackDev ? { webpack: true } : {}),
});

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const handleUpgrade = app.getUpgradeHandler();

  const httpServer = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  // dev HMR(Turbopack/webpack)는 WebSocket upgrade 가 필요함. 미연결 시 저장해도 화면이 안 바뀜.
  // `/_next` 만 Next에 넘기고 `/socket.io` 는 아래 Socket.IO 리스너가 처리.
  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = parse(req.url ?? "", true).pathname ?? "";
    if (pathname.startsWith("/_next")) {
      void handleUpgrade(req, socket, head);
    }
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });
  attachChatNamespace(io.of("/chat"));

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
