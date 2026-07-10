/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

/**
 * Service worker source (compiled by @serwist/next into public/sw.js).
 *
 * Because ALL data flows are already client + IndexedDB, offline data access
 * "just works" once the shell + static assets are cached — the SW only needs to
 * precache the app shell (build output), the self-hosted fonts, and other public
 * assets, then serve navigations from cache. Only routine generation needs the
 * network; every other screen is fully usable offline (design.md §1 PWA).
 *
 * `self.__SW_MANIFEST` is injected at build time with the precache manifest
 * (shell + `globPublicPatterns` from next.config.ts, incl. the fonts).
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
