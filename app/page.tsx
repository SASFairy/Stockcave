import { redirect } from "next/navigation";

/**
 * Main entry point: /
 * Redirects immediately to /dashboard.
 * Next.js Middleware (middleware.ts) will intercept this and redirect to /login if the PIN session is invalid.
 */
export default function Home() {
  redirect("/dashboard");
}
