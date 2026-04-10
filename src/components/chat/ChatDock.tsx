// 플로팅 채팅: socket.io-client, 방 전환·히스토리·apiOrigin 연결
import { LogOut, MessageCircle, Send, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafeImage } from "@/components/ui/safe-image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiOrigin } from "@/lib/api";
import { getAccessToken } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import {
  floatingDockChatInsetEndClass,
  floatingDockFabButtonClass,
  floatingDockFabIconClass,
  floatingDockVerticalInsetClass,
} from "@/lib/floating-dock-chrome";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

type ChatMessageEvt = {
  id: string;
  roomId: string;
  userId: number;
  userName: string;
  userImageUrl?: string | null;
  text: string;
  createdAt: string;
};

type SystemNoticeEvt = {
  type: "join";
  roomId: string;
  userId: number;
  userName: string;
  userImageUrl?: string | null;
  at: string;
};

type RoomListEntry = {
  id: string;
  members: number;
  ownerId?: number;
  ownerName?: string;
};

type FeedItem =
  | { kind: "msg"; key: string; data: ChatMessageEvt }
  | {
      kind: "sys";
      key: string;
      text: string;
      at: string;
      userName: string;
      userImageUrl?: string | null;
    };

function roomLabel(roomId: string): string {
  return roomId === "lobby" ? "로비 (전체)" : roomId;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function chatInitial(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

/** 채팅 말풍선 옆 원형 프로필 */
function ChatAvatar({
  name,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  imageUrl: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "size-5" : "size-8";
  const initialsCls = size === "sm" ? "text-[9px]" : "text-[11px]";
  return (
    <SafeImage
      src={imageUrl}
      alt=""
      className={cn(
        box,
        "shrink-0 rounded-full object-cover ring-1 ring-border",
        className,
      )}
      placeholderLabel={`${name} 프로필`}
      fallback={
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border",
            box,
            initialsCls,
            className,
          )}
          aria-hidden
        >
          {chatInitial(name)}
        </span>
      }
    />
  );
}

/** 카카오톡 스타일: 내 말풍선(노란색)·상대(흰색)·프로필·시간 */
function ChatMessageBubble({
  msg,
  isMine,
}: {
  msg: ChatMessageEvt;
  isMine: boolean;
}) {
  const avatarUrl = msg.userImageUrl ?? null;
  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isMine ? "flex-row-reverse" : "flex-row",
      )}
    >
      <ChatAvatar name={msg.userName} imageUrl={avatarUrl} />
      <div
        className={cn(
          "flex min-w-0 max-w-[min(17.5rem,calc(100%-2.5rem))] flex-col gap-0.5",
          isMine ? "items-end" : "items-start",
        )}
      >
        {!isMine ? (
          <span className="max-w-full pl-0.5 text-[11px] font-medium text-foreground/80">
            {msg.userName}
          </span>
        ) : (
          <span className="sr-only">내 메시지</span>
        )}
        <div
          className={cn(
            "flex max-w-full items-end gap-1.5",
            isMine ? "flex-row-reverse" : "flex-row",
          )}
        >
          <div
            className={cn(
              "max-w-full px-3 py-2 text-[15px] leading-snug wrap-break-word shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
              "rounded-[18px]",
              isMine
                ? "rounded-br-[4px] bg-[#FEE500] text-[#191919] dark:bg-[#ECD93B] dark:text-[#191919]"
                : "rounded-bl-[4px] border border-black/[0.07] bg-white text-foreground dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100",
            )}
          >
            {msg.text}
          </div>
          <time
            className="mb-0.5 shrink-0 text-[10px] tabular-nums leading-none text-muted-foreground"
            dateTime={msg.createdAt}
          >
            {formatTime(msg.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}

/**
 * 로그인 시 항상 소켓 연결 · 방 목록 표시.
 * 패널을 닫아도 현재 방 기준 새 메시지·입장 알림은 플로팅 버튼 배지로 표시.
 */
export function ChatDock() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeRoom, setActiveRoom] = useState("lobby");
  const [rooms, setRooms] = useState<RoomListEntry[]>([
    { id: "lobby", members: 0 },
  ]);
  const [roomDraft, setRoomDraft] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(false);
  const activeRoomRef = useRef("lobby");
  const userSubRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    openRef.current = open;
    activeRoomRef.current = activeRoom;
    userSubRef.current = user?.sub;
  }, [open, activeRoom, user?.sub]);

  /** 패널이 열리고 소켓이 연결된 뒤 하단 메시지 입력으로 포커스 */
  useLayoutEffect(() => {
    if (!open || !connected) return;
    const t = window.setTimeout(() => {
      const el = messageInputRef.current;
      if (el && !el.disabled) el.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, connected]);

  const appendFeed = useCallback((item: FeedItem) => {
    setFeed((prev) => [...prev, item]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed, open]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      queueMicrotask(() => {
        setConnected(false);
        setUnread(0);
        setRooms([{ id: "lobby", members: 0 }]);
      });
      return;
    }

    const token = getAccessToken();
    if (!token) {
      queueMicrotask(() => {
        setBanner("액세스 토큰이 없습니다. 다시 로그인해 주세요.");
      });
      return;
    }
    queueMicrotask(() => {
      setBanner(null);
    });

    const socket = io(`${apiOrigin()}/chat`, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      withCredentials: true,
    });
    socketRef.current = socket;

    const bumpUnreadIfBackground = (roomId: string, fromUserId: number) => {
      if (openRef.current) return;
      if (fromUserId === userSubRef.current) return;
      if (roomId !== activeRoomRef.current) return;
      setUnread((n) => Math.min(99, n + 1));
    };

    socket.on("connect", () => {
      setConnected(true);
      setBanner(null);
      socket.emit("joinRoom", { roomId: activeRoomRef.current });
      appLog("chat", "socket 연결");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      appLog("chat", "socket 끊김");
    });

    socket.on("connect_error", () => {
      setBanner("채팅 서버에 연결하지 못했습니다.");
    });

    socket.on("roomList", (p: { rooms?: RoomListEntry[] }) => {
      if (Array.isArray(p?.rooms)) setRooms(p.rooms);
    });

    socket.on("joinedRoom", ({ roomId }: { roomId: string }) => {
      activeRoomRef.current = roomId;
      setActiveRoom(roomId);
      setFeed([]);
      appLog("chat", "방 입장", { roomId });
    });

    socket.on("leftRoom", ({ roomId }: { roomId: string }) => {
      appLog("chat", "방 나감", { roomId });
      socket.emit("joinRoom", { roomId: "lobby" });
    });

    socket.on("roomDeleted", ({ roomId }: { roomId: string }) => {
      appLog("chat", "방 삭제됨", { roomId });
      if (roomId === activeRoomRef.current) {
        socket.emit("joinRoom", { roomId: "lobby" });
      }
    });

    socket.on(
      "messageHistory",
      (p: { roomId?: string; messages?: ChatMessageEvt[] }) => {
        if (p?.roomId !== activeRoomRef.current) return;
        const list = Array.isArray(p.messages) ? p.messages : [];
        setFeed(
          list.map((msg) => ({
            kind: "msg" as const,
            key: msg.id,
            data: msg,
          })),
        );
      },
    );

    socket.on("chatMessage", (msg: ChatMessageEvt) => {
      if (msg.roomId !== activeRoomRef.current) return;
      appendFeed({
        kind: "msg",
        key: msg.id,
        data: msg,
      });
      bumpUnreadIfBackground(msg.roomId, msg.userId);
    });

    socket.on("systemNotice", (n: SystemNoticeEvt) => {
      if (n.type !== "join") return;
      if (n.roomId !== activeRoomRef.current) return;
      appendFeed({
        kind: "sys",
        key: `join-${n.userId}-${n.at}`,
        text: `${n.userName}님이 들어왔습니다.`,
        at: n.at,
        userName: n.userName,
        userImageUrl: n.userImageUrl ?? null,
      });
      bumpUnreadIfBackground(n.roomId, n.userId);
    });

    socket.on("chatError", (p: { message?: string }) => {
      setBanner(p?.message ?? "오류가 발생했습니다.");
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      queueMicrotask(() => {
        setConnected(false);
      });
    };
  }, [user, appendFeed]);

  function sendText() {
    const text = draft.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit("sendMessage", {
      roomId: activeRoom,
      text,
    });
    setDraft("");
  }

  function goRoom() {
    const raw = roomDraft.trim().toLowerCase().replace(/\s+/g, "-");
    const next = raw.replace(/[^a-z0-9가-힣._-]/g, "") || "lobby";
    socketRef.current?.emit("joinRoom", { roomId: next });
    setRoomDraft("");
  }

  function joinListedRoom(roomId: string) {
    socketRef.current?.emit("joinRoom", { roomId });
  }

  function leaveCurrentRoom() {
    if (!socketRef.current?.connected || activeRoom === "lobby") return;
    socketRef.current.emit("leaveRoom");
  }

  function deleteListedRoom(roomId: string) {
    if (roomId === "lobby" || !socketRef.current?.connected) return;
    const label = roomLabel(roomId);
    if (!window.confirm(`「${label}」방과 저장된 대화를 삭제할까요?`)) return;
    socketRef.current.emit("deleteRoom", { roomId });
  }

  if (!user) return null;

  const activeRoomMeta = rooms.find((r) => r.id === activeRoom);
  const badgeText = unread > 9 ? "9+" : String(unread);

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[240] flex min-h-0 flex-col",
        floatingDockVerticalInsetClass,
        floatingDockChatInsetEndClass,
      )}
    >
      {/*
        래퍼에 pointer-events-auto + flex-1을 두면 오른쪽 가늘 띠 전체(뷰포트 세로)가 히트 영역이 되어
        북 속성 패널 등 그 아래 UI가 클릭되지 않는다. 실제 대화상자·FAB만 pointer-events-auto.
      */}
      <div className="pointer-events-none flex min-h-0 flex-1 flex-col items-end justify-end gap-3">
        {open ? (
          <div
            className="pointer-events-auto flex h-full max-h-[min(90dvh,48rem)] min-h-0 w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl sm:w-[24rem]"
            role="dialog"
            aria-label="채팅"
          >
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  채팅
                </p>
                <p className="truncate text-sm font-semibold">
                  {roomLabel(activeRoom)}
                </p>
                {activeRoom !== "lobby" && activeRoomMeta?.ownerName ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    방장 {activeRoomMeta.ownerName}
                  </p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2">
                  <ChatAvatar
                    name={user.name || user.email}
                    imageUrl={user.imageUrl}
                    size="sm"
                  />
                  <p className="min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {user.name?.trim() || user.email}
                    </span>
                    <span className="block text-[10px]">로그인 중</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    connected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                  title={connected ? "연결됨" : "연결 끊김"}
                >
                  {connected ? "●" : "○"}
                </span>
                {activeRoom !== "lobby" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="방 나가기 · 로비로 이동"
                    aria-label="방 나가기, 로비로 이동"
                    disabled={!connected}
                    onClick={leaveCurrentRoom}
                  >
                    <LogOut className="size-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="채팅 닫기"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </header>

            {banner ? (
              <p className="shrink-0 border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {banner}
              </p>
            ) : null}

            <div className="shrink-0 border-b border-border bg-muted/15 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                열린 방
              </p>
              <ScrollArea className="max-h-28">
                <ul className="space-y-1 pr-2 pb-1">
                  {rooms.map((r) => (
                    <li key={r.id} className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => joinListedRoom(r.id)}
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-stretch gap-0.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          r.id === activeRoom
                            ? "bg-primary/15 font-medium text-foreground"
                            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">
                            {roomLabel(r.id)}
                          </span>
                          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                            {r.members}명
                          </span>
                        </span>
                        {r.id !== "lobby" && r.ownerName ? (
                          <span className="truncate text-[10px] text-muted-foreground">
                            방장 {r.ownerName}
                          </span>
                        ) : null}
                      </button>
                      {r.id !== "lobby" && r.ownerId === user.sub ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`${roomLabel(r.id)} 방 삭제`}
                          title="방장만 삭제 가능"
                          disabled={!connected}
                          onClick={() => deleteListedRoom(r.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                새 방
              </p>
              <div className="flex gap-1.5">
                <Input
                  value={roomDraft}
                  onChange={(e) => setRoomDraft(e.target.value)}
                  placeholder="방 이름 (예: study)"
                  className="h-8 flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      goRoom();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={goRoom}
                >
                  만들기/입장
                </Button>
              </div>
            </div>

            <div
              className="min-h-0 min-w-0 flex-1 flex-basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#B2C7D9]/25 dark:bg-background"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="space-y-3 px-3 py-3">
                {feed.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    메시지를 보내 대화를 시작해 보세요.
                  </p>
                ) : null}
                {feed.map((item) =>
                  item.kind === "sys" ? (
                    <div key={item.key} className="flex justify-center py-0.5">
                      <div className="flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full bg-black/6 px-2 py-1 pe-2.5 dark:bg-white/10">
                        <ChatAvatar
                          name={item.userName}
                          imageUrl={item.userImageUrl}
                          size="sm"
                        />
                        <p className="min-w-0 text-[11px] text-muted-foreground">
                          {item.text}
                          <span className="ml-1 tabular-nums opacity-70">
                            {formatTime(item.at)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ChatMessageBubble
                      key={item.key}
                      msg={item.data}
                      isMine={item.data.userId === user.sub}
                    />
                  ),
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="shrink-0 border-t border-border p-2">
              <div className="flex gap-1.5">
                <Input
                  ref={messageInputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="메시지 입력…"
                  className="h-9 flex-1 text-sm"
                  disabled={!connected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-9 shrink-0"
                  disabled={!connected || !draft.trim()}
                  aria-label="보내기"
                  onClick={() => sendText()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </footer>
          </div>
        ) : null}

        {!open ? (
          <div className="pointer-events-auto relative">
            <Button
              type="button"
              size="icon"
              className={cn(
                floatingDockFabButtonClass,
                "shadow-lg",
                unread > 0 &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              aria-label={
                unread > 0 ? `채팅 열기 (읽지 않음 ${unread})` : "채팅 열기"
              }
              aria-expanded={false}
              onClick={() => {
                setUnread(0);
                setOpen(true);
              }}
            >
              <MessageCircle
                className={floatingDockFabIconClass}
                strokeWidth={1.75}
              />
            </Button>
            {unread > 0 ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm"
                aria-hidden
              >
                {badgeText}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
