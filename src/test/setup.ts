import "@testing-library/jest-dom/vitest";
// Real Dexie against an in-memory IndexedDB — a broken migration/index fails a
// test instead of shipping (design.md §6). Must load before any db import.
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
