export function resolveOAuthRedirectUri(origin: string, configuredRedirectUri?: string) {
  const fallback = new URL("/api/oauth/callback", origin).toString();
  if (!configuredRedirectUri) return fallback;

  const configured = new URL(configuredRedirectUri);
  if (configured.protocol !== "https:" && configured.hostname !== "localhost" && configured.hostname !== "127.0.0.1") {
    throw new Error("OAuth redirect URI must use HTTPS outside local development");
  }
  if (configured.pathname !== "/api/oauth/callback" || configured.search || configured.hash) {
    throw new Error("OAuth redirect URI must be exactly /api/oauth/callback");
  }
  return configured.toString();
}
