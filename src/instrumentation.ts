// Next.js 서버 기동 시 1회: Node 런타임에서만 부트스트랩(관리자 시드 등)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureUserBootstraps } =
      await import("@/server/services/bootstrap");
    await ensureUserBootstraps().catch((e) => console.error("[bootstrap]", e));
  }
}
