// Routes of the phone. Pure types shared by the overlay, the home screen and the notifications.

/** The three phone apps that are not part of the shared device content. */
export type PhoneAppId = "messages" | "calls" | "voicemail" | "browser";

/** `device:<app>` routes open one of the shared device apps (mail, bank, map, calendar, housing, jobs, files). */
export type PhoneRoute = "home" | PhoneAppId | `device:${string}`;

/** The key of the app behind a route: `mail` for `device:mail`, `calls` for `calls`, null for home. */
export function routeApp(route: PhoneRoute): string | null {
  if (route === "home") return null;
  return route.startsWith("device:") ? route.slice("device:".length) : route;
}
