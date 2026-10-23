import { describe, expect, it } from "vitest";
import swSource from "../../static/pwa/sw.js?raw";
import { shouldCacheShell } from "../../logic/client/pwa/shellCache";
import { registerServiceWorker } from "../../logic/client/pwa/registerServiceWorker";

describe("shouldCacheShell", () => {
  it("caches the manifest, icons, and built assets only", () => {
    expect(shouldCacheShell("/manifest.webmanifest")).toBe(true);
    expect(shouldCacheShell("/icons/icon-192.png")).toBe(true);
    expect(shouldCacheShell("/assets/app-abc123.js")).toBe(true);
  });

  it("leaves the network for pages, the API, and the socket path", () => {
    expect(shouldCacheShell("/")).toBe(false);
    expect(shouldCacheShell("/register")).toBe(false);
    expect(shouldCacheShell("/game/42")).toBe(false);
    expect(shouldCacheShell("/api")).toBe(false);
    expect(shouldCacheShell("/api/games")).toBe(false);
    expect(shouldCacheShell("/socket.io/")).toBe(false);
    expect(shouldCacheShell("/sw.js")).toBe(false);
  });
});

describe("service worker", () => {
  it("uses the shell cache and skips other origins", () => {
    expect(swSource).toContain("shouldCacheShell");
    expect(swSource).toContain('pathname.startsWith("/api/")');
    expect(swSource).toContain("url.origin !== self.location.origin");
    expect(swSource).not.toContain("/api/* cache");
  });
});

describe("registerServiceWorker", () => {
  it("registers the root worker when the browser provides one", () => {
    const urls: string[] = [];
    registerServiceWorker({
      register(scriptUrl) {
        urls.push(scriptUrl);
        return Promise.resolve();
      },
    });
    expect(urls).toEqual(["/sw.js"]);
  });

  it("does nothing when the browser has no service worker", () => {
    expect(() => registerServiceWorker(null)).not.toThrow();
  });
});
