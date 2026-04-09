export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureUserBootstraps } =
      await import("@/server/services/bootstrap");
    await ensureUserBootstraps().catch((e) => console.error("[bootstrap]", e));
  }
}
