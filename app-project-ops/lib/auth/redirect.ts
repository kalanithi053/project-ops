const DEFAULT_AUTH_DESTINATION = "/workspaces";

export function safeAuthDestination(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : DEFAULT_AUTH_DESTINATION;
}

export function loginPath(destination: string): string {
  return `/login?next=${encodeURIComponent(safeAuthDestination(destination))}`;
}
