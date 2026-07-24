import { redirect } from "next/navigation";

/**
 * Entry point. Unauthenticated visitors always start at the sign-in
 * screen; from there the flow is: login → choose/create workspace →
 * dashboard. Swap this for a real session check once auth is wired up.
 */
export default function RootPage() {
  redirect("/login");
}
