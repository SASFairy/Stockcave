export async function register() {
  // node-cron should only initialize in Node.js server runtime, not the edge or client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("🚀 [System] Next.js Node.js runtime detected. Registering background services...");
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
