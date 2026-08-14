import "./server-env-bootstrap";

import http from "node:http";
import { parse } from "node:url";

import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { attachChatNamespace } from "@/server/chat/attach-chat-namespace";
import { corsOrigin } from "@/server/env";

import {
  ensureDevRequiredServerFilesIfMissing,
  ensureDevRequiredServerFilesManifest,
} from "./server-dev-required-manifest";

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

app.prepare().then(async () => {
  await ensureDevRequiredServerFilesManifest();
  const handle = app.getRequestHandler();
  const handleUpgrade = app.getUpgradeHandler();

  const httpServer = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    const pathname = parsedUrl.pathname ?? "";
    // Socket.IO(폴링·long-polling)는 별도 request 리스너가 처리한다. Next에 넘기면 404로 res가 끝나 연결 실패.
    if (pathname.startsWith("/socket.io")) {
      return;
    }
    // 첫 컴파일이 `.next/dev` 를 비운 뒤 manifest 가 잠깐 없을 수 있음 → 요청마다 없으면 동기 보강.
    if (dev) {
      ensureDevRequiredServerFilesIfMissing();
    }
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
    // FRONTEND_ORIGIN 설정 시 해당 오리진만 허용(미설정이면 개발 편의상 전 허용)
    cors: { origin: corsOrigin(), credentials: true },
  });
  // 기본 네임스페이스는 쓰지 않음 — 인증 없는 연결 유지(커넥션 고갈)를 차단
  io.use((_socket, nextFn) => nextFn(new Error("Unauthorized")));
  attachChatNamespace(io.of("/chat"));

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // docker stop(SIGTERM) 시 진행 중 요청·소켓·리스너를 정리하고 종료. 미처리 시 강제 절단으로 저장 유실 가능.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`> ${signal} 수신 — 종료 절차 시작`);
    const force = setTimeout(() => {
      console.error("> 정리 시간 초과 — 강제 종료");
      process.exit(1);
    }, 10_000);
    force.unref();
    io.close(() => {
      httpServer.close(() => {
        console.log("> 정상 종료");
        process.exit(0);
      });
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}).catch((err) => {
  // prepare 실패가 무증상 종료로 끝나지 않게 명시적으로 남기고 실패 코드로 종료
  console.error("[server] Next prepare 실패:", err);
  process.exit(1);
});

// 미처리 예외/거부가 프로세스를 조용히 죽이지 않도록 로깅(치명 여부는 로그로 판단)
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
