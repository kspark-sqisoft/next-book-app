// Socket.IO 네임스페이스: JWT 검증 후 방·히스토리·브로드캐스트
import { desc, eq } from "drizzle-orm";
import type { Namespace, Socket } from "socket.io";

import { verifyAccessToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { getDb } from "@/server/db";
import { chatMessage, chatRoom, user } from "@/server/db/schema";
import { AVATARS_SUBDIR } from "@/server/env";

const MAX_BODY = 2000;
const HISTORY = 120;

type ChatMessageEvt = {
  id: string;
  roomId: string;
  userId: number;
  userName: string;
  userImageUrl?: string | null;
  text: string;
  createdAt: string;
};

function avatarPublicUrl(profileImageFilename: string | null): string | null {
  if (!profileImageFilename) return null;
  return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
}

function normalizeRoomId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
  const slug = t.replace(/[^a-z0-9가-힣._-]/g, "");
  const id = slug || "lobby";
  if (id.length > 64) return null;
  return id;
}

async function loadUserProfile(db: ReturnType<typeof getDb>, userId: number) {
  const rows = await db
    .select({
      name: user.name,
      profileImageFilename: user.profileImageFilename,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return { name: "", imageUrl: null as string | null };
  return {
    name: row.name?.trim() || "",
    imageUrl: avatarPublicUrl(row.profileImageFilename ?? null),
  };
}

async function buildRoomList(nsp: Namespace) {
  const db = getDb();
  const lobbyKey = "room:lobby";
  const lobbySize = nsp.adapter.rooms.get(lobbyKey)?.size ?? 0;

  const rows = await db.select().from(chatRoom);
  const list: {
    id: string;
    members: number;
    ownerId?: number;
    ownerName?: string;
  }[] = [{ id: "lobby", members: lobbySize }];

  for (const r of rows) {
    const key = `room:${r.roomId}`;
    const members = nsp.adapter.rooms.get(key)?.size ?? 0;
    list.push({
      id: r.roomId,
      members,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
    });
  }
  return list;
}

// 접속·해제가 몰릴 때 방 전체 스캔+전역 emit이 이벤트마다 반복되지 않게 짧게 디바운스
let roomListTimer: NodeJS.Timeout | null = null;

function broadcastRoomList(nsp: Namespace) {
  if (roomListTimer) return;
  roomListTimer = setTimeout(() => {
    roomListTimer = null;
    // DB 순단 시 unhandled rejection으로 프로세스가 죽지 않도록 반드시 catch
    void buildRoomList(nsp)
      .then((rooms) => {
        nsp.emit("roomList", { rooms });
      })
      .catch((err) => {
        console.error("[chat] roomList 브로드캐스트 실패:", err);
      });
  }, 300);
}

async function messageHistoryPayload(
  db: ReturnType<typeof getDb>,
  roomId: string,
): Promise<ChatMessageEvt[]> {
  const rows = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.roomId, roomId))
    .orderBy(desc(chatMessage.createdAt))
    .limit(HISTORY);
  const chronological = rows.slice().reverse();
  return chronological.map((m) => ({
    id: String(m.id),
    roomId: m.roomId,
    userId: m.authorId,
    userName: m.authorName,
    userImageUrl: m.authorImageUrl ?? null,
    text: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
}

export function attachChatNamespace(nsp: Namespace) {
  const currentRoomBySocket = new Map<string, string>();

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token.trim()) {
        next(new Error("Unauthorized"));
        return;
      }
      const payload = await verifyAccessToken(token.trim());
      (socket.data as { user?: JwtPayload }).user = payload;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  nsp.on("connection", (socket: Socket) => {
    const userPayload = (socket.data as { user: JwtPayload }).user;
    if (!userPayload) {
      socket.disconnect(true);
      return;
    }

    const db = getDb();

    // 메시지마다 프로필 SELECT가 반복되지 않게 소켓 단위 캐시(60초)
    let profileCache: {
      at: number;
      profile: Awaited<ReturnType<typeof loadUserProfile>>;
    } | null = null;
    async function getProfileCached() {
      const now = Date.now();
      if (profileCache && now - profileCache.at < 60_000) {
        return profileCache.profile;
      }
      const profile = await loadUserProfile(db, userPayload.sub);
      profileCache = { at: now, profile };
      return profile;
    }

    async function joinRoom(roomId: string) {
      const prev = currentRoomBySocket.get(socket.id);
      if (prev === roomId) {
        const messages = await messageHistoryPayload(db, roomId);
        socket.emit("messageHistory", { roomId, messages });
        return;
      }

      if (prev) {
        socket.leave(`room:${prev}`);
      }

      socket.join(`room:${roomId}`);
      currentRoomBySocket.set(socket.id, roomId);

      if (roomId !== "lobby") {
        const existing = await db
          .select()
          .from(chatRoom)
          .where(eq(chatRoom.roomId, roomId))
          .limit(1);
        if (existing.length === 0) {
          const ownerName =
            userPayload.name.trim().slice(0, 80) ||
            userPayload.email.slice(0, 80);
          await db.insert(chatRoom).values({
            roomId,
            ownerId: userPayload.sub,
            ownerName,
          });
        }
      }

      socket.emit("joinedRoom", { roomId });
      const messages = await messageHistoryPayload(db, roomId);
      socket.emit("messageHistory", { roomId, messages });

      const profile = await getProfileCached();
      socket.to(`room:${roomId}`).emit("systemNotice", {
        type: "join",
        roomId,
        userId: userPayload.sub,
        userName: profile.name || userPayload.email,
        userImageUrl: profile.imageUrl,
        at: new Date().toISOString(),
      });

      broadcastRoomList(nsp);
    }

    socket.on("joinRoom", async (p: { roomId?: string }) => {
      try {
        const roomId = normalizeRoomId(p?.roomId);
        if (!roomId) {
          socket.emit("chatError", { message: "유효하지 않은 방 이름입니다." });
          return;
        }
        await joinRoom(roomId);
      } catch {
        socket.emit("chatError", { message: "방 입장에 실패했습니다." });
      }
    });

    socket.on("sendMessage", async (p: { roomId?: string; text?: string }) => {
      try {
        const roomId = normalizeRoomId(p?.roomId);
        const text = typeof p?.text === "string" ? p.text.trim() : "";
        if (!roomId || !text) return;
        if (text.length > MAX_BODY) {
          socket.emit("chatError", {
            message: `메시지는 ${MAX_BODY}자 이하로 보내 주세요.`,
          });
          return;
        }
        const active = currentRoomBySocket.get(socket.id);
        if (active !== roomId) {
          socket.emit("chatError", {
            message: "현재 방에서만 메시지를 보낼 수 있습니다.",
          });
          return;
        }

        const profile = await getProfileCached();
        const authorName = (
          profile.name ||
          userPayload.name ||
          userPayload.email
        ).slice(0, 80);

        const inserted = await db
          .insert(chatMessage)
          .values({
            roomId,
            authorId: userPayload.sub,
            authorName,
            authorImageUrl: profile.imageUrl,
            body: text,
          })
          .returning({
            id: chatMessage.id,
            createdAt: chatMessage.createdAt,
          });

        const row = inserted[0];
        if (!row) return;

        const evt: ChatMessageEvt = {
          id: String(row.id),
          roomId,
          userId: userPayload.sub,
          userName: authorName,
          userImageUrl: profile.imageUrl,
          text,
          createdAt: row.createdAt.toISOString(),
        };
        nsp.to(`room:${roomId}`).emit("chatMessage", evt);
      } catch {
        socket.emit("chatError", { message: "메시지 전송에 실패했습니다." });
      }
    });

    socket.on("leaveRoom", async () => {
      try {
        const room = currentRoomBySocket.get(socket.id);
        if (!room || room === "lobby") {
          socket.emit("chatError", { message: "로비에서는 나갈 수 없습니다." });
          return;
        }
        socket.leave(`room:${room}`);
        socket.emit("leftRoom", { roomId: room });
        await joinRoom("lobby");
      } catch {
        socket.emit("chatError", { message: "방 나가기에 실패했습니다." });
      }
    });

    socket.on("deleteRoom", async (p: { roomId?: string }) => {
      try {
        const roomId = normalizeRoomId(p?.roomId);
        if (!roomId || roomId === "lobby") return;

        const rows = await db
          .select()
          .from(chatRoom)
          .where(eq(chatRoom.roomId, roomId))
          .limit(1);
        const meta = rows[0];
        if (!meta || meta.ownerId !== userPayload.sub) {
          socket.emit("chatError", { message: "방장만 삭제할 수 있습니다." });
          return;
        }

        const roomKey = `room:${roomId}`;
        const sids = nsp.adapter.rooms.get(roomKey);
        if (sids && sids.size > 0) {
          // 로비 히스토리는 전원 동일 — 인원수만큼 반복 조회하지 않게 1회만
          const lobbyMessages = await messageHistoryPayload(db, "lobby");
          for (const sid of [...sids]) {
            const peer = nsp.sockets.get(sid);
            if (!peer) continue;
            peer.leave(roomKey);
            peer.emit("roomDeleted", { roomId });
            peer.join("room:lobby");
            currentRoomBySocket.set(sid, "lobby");
            peer.emit("joinedRoom", { roomId: "lobby" });
            peer.emit("messageHistory", {
              roomId: "lobby",
              messages: lobbyMessages,
            });
          }
        }

        await db.delete(chatMessage).where(eq(chatMessage.roomId, roomId));
        await db.delete(chatRoom).where(eq(chatRoom.roomId, roomId));

        broadcastRoomList(nsp);
      } catch {
        socket.emit("chatError", { message: "방 삭제에 실패했습니다." });
      }
    });

    socket.on("disconnect", () => {
      currentRoomBySocket.delete(socket.id);
      broadcastRoomList(nsp);
    });

    void joinRoom("lobby").catch(() => {
      socket.emit("chatError", { message: "채팅 초기화에 실패했습니다." });
    });
  });
}
