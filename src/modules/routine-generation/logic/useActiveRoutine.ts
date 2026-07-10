"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getActive } from "../api/routineRepo";
import type { Routine } from "../types";

/**
 * The single active routine (design.md §D6). Read-only + reactive: a Dexie live
 * query over the singleton row, so it re-emits automatically after
 * `useRoutineGeneration.confirmSave()` writes — home swaps to the summary with
 * no manual refresh.
 */
export interface ActiveRoutineApi {
  routine: Routine | null;
  loading: boolean;
  error: Error | null;
}

export function useActiveRoutine(): ActiveRoutineApi {
  // useLiveQuery returns `undefined` until its first emit → that IS 'loading'.
  const result = useLiveQuery(async () => {
    try {
      return { routine: await getActive(), error: null as Error | null };
    } catch (e) {
      return { routine: null, error: e as Error };
    }
  });

  if (result === undefined) {
    return { routine: null, loading: true, error: null };
  }
  return { routine: result.routine, loading: false, error: result.error };
}
