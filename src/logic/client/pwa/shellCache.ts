export function shouldCacheShell(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return false;
  }
  if (pathname === "/socket.io" || pathname.startsWith("/socket.io/")) {
    return false;
  }
  if (pathname === "/manifest.webmanifest") {
    return true;
  }
  if (pathname.startsWith("/icons/")) {
    return true;
  }
  if (pathname.startsWith("/assets/")) {
    return true;
  }
  return false;
}
