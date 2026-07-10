import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** The MSW server for Node-based (Vitest) tests. Started in `src/test/setup.ts`. */
export const server = setupServer(...handlers);
