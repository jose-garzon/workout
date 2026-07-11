import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentExerciseView,
  SeriesView,
  TimerView,
  WorkoutSessionApi,
} from "../logic/useWorkoutSession";
import { ExerciseView } from "./ExerciseView";
import { SessionOverview } from "./SessionOverview";
import { Stopwatch } from "./Stopwatch";
import { SuccessView } from "./SuccessView";
import { WorkoutModeBody } from "./WorkoutModeBody";

/**
 * Component tests (design.md tasks §8.3). Every test drives a controllable
 * fake `WorkoutSessionApi` — either via a mocked `../logic/useWorkoutSession`
 * (for `WorkoutModeBody`'s status routing) or as a direct prop (for the
 * leaf components, which are pure renderers of the seam and never call the
 * hook themselves). Deterministic, independent of the software-engineer's
 * real `logic/` engine.
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { mockUseWorkoutSession } = vi.hoisted(() => ({
  mockUseWorkoutSession: vi.fn(),
}));
vi.mock("../logic/useWorkoutSession", () => ({
  useWorkoutSession: mockUseWorkoutSession,
}));

afterEach(cleanup);
afterEach(() => {
  pushMock.mockClear();
  mockUseWorkoutSession.mockReset();
});

const READY_TIMER: TimerView = {
  phase: "ready",
  displaySeconds: 0,
  restTotalSeconds: 120,
  overtimeSeconds: 0,
  currentSeries: 2,
  plannedSeries: 4,
};

const WORK_TIMER: TimerView = {
  phase: "work",
  displaySeconds: 45,
  restTotalSeconds: 120,
  overtimeSeconds: 0,
  currentSeries: 2,
  plannedSeries: 4,
};

const REST_TIMER: TimerView = {
  phase: "rest",
  displaySeconds: 90,
  restTotalSeconds: 120,
  overtimeSeconds: 0,
  currentSeries: 2,
  plannedSeries: 4,
};

const OVERTIME_TIMER: TimerView = {
  phase: "overtime",
  displaySeconds: 0,
  restTotalSeconds: 120,
  overtimeSeconds: 12,
  currentSeries: 2,
  plannedSeries: 4,
};

const COMPLETE_TIMER: TimerView = {
  phase: "exercise-complete",
  displaySeconds: 0,
  restTotalSeconds: 120,
  overtimeSeconds: 0,
  currentSeries: 4,
  plannedSeries: 4,
};

const SAMPLE_COMPLETED_SETS: SeriesView[] = [
  { reps: 8, weight: 80, workSeconds: 42, volume: 640 },
  { reps: 8, weight: 82.5, workSeconds: 39, volume: 660 },
];

const CURRENT_EXERCISE: CurrentExerciseView = {
  id: "e1",
  name: "Bench Press",
  index: 0,
  total: 3,
  plannedSeries: 4,
  plannedReps: 8,
  repsPerSet: [8, 8, 10, 12],
  isLast: false,
};

function fakeApi(
  overrides: Partial<WorkoutSessionApi> = {},
): WorkoutSessionApi {
  return {
    status: "overview",
    dayName: "Push Day",
    exercises: [
      { id: "e1", name: "Bench Press", plannedSeries: 4, plannedReps: 8 },
      { id: "e2", name: "Overhead Press", plannedSeries: 3, plannedReps: 10 },
    ],
    defaultRestSeconds: 120,
    setDefaultRestSeconds: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    currentExercise: null,
    unit: "metric",
    weight: null,
    setWeight: vi.fn(),
    previousWeight: null,
    canStartSet: true,
    timer: WORK_TIMER,
    completedSets: [],
    tap: vi.fn().mockResolvedValue(undefined),
    nextExercise: vi.fn().mockResolvedValue(undefined),
    submitRatings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("WorkoutModeBody — status routing (mocked seam)", () => {
  it("shows the empty state and returns home when the day has no routine", () => {
    mockUseWorkoutSession.mockReturnValue(fakeApi({ status: "no-routine" }));
    render(<WorkoutModeBody dayId="day-1" />);

    expect(screen.getByText("No workout to start here")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("renders the overview and lets Start begin the session", () => {
    const start = vi.fn().mockResolvedValue(undefined);
    mockUseWorkoutSession.mockReturnValue(
      fakeApi({ status: "overview", start }),
    );
    render(<WorkoutModeBody dayId="day-1" />);

    expect(
      screen.getByRole("heading", { name: "Push Day" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("renders the current exercise while in progress", () => {
    mockUseWorkoutSession.mockReturnValue(
      fakeApi({ status: "in-progress", currentExercise: CURRENT_EXERCISE }),
    );
    render(<WorkoutModeBody dayId="day-1" />);

    expect(
      screen.getByRole("heading", { name: "Bench Press" }),
    ).toBeInTheDocument();
  });

  it("renders the success view once the session finishes", () => {
    mockUseWorkoutSession.mockReturnValue(fakeApi({ status: "success" }));
    render(<WorkoutModeBody dayId="day-1" />);

    expect(
      screen.getByRole("heading", { name: "Workout complete" }),
    ).toBeInTheDocument();
  });

  it("shows a real error state (not a dead-end placeholder) if the seam throws", () => {
    mockUseWorkoutSession.mockImplementation(() => {
      throw new Error("boom");
    });
    render(<WorkoutModeBody dayId="day-1" />);

    expect(
      screen.getByText("This workout couldn't be loaded"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});

describe("SessionOverview", () => {
  it("lists every exercise and calls start", () => {
    const start = vi.fn().mockResolvedValue(undefined);
    render(<SessionOverview session={fakeApi({ start })} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Overhead Press")).toBeInTheDocument();
    expect(screen.getByText("4 series · 8 reps")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("prefills the rest field and writes edits through setDefaultRestSeconds", () => {
    const setDefaultRestSeconds = vi.fn();
    render(
      <SessionOverview
        session={fakeApi({ defaultRestSeconds: 90, setDefaultRestSeconds })}
      />,
    );

    const field = screen.getByLabelText(
      "Rest between sets",
    ) as HTMLInputElement;
    expect(field.value).toBe("90");

    fireEvent.change(field, { target: { value: "150" } });
    expect(setDefaultRestSeconds).toHaveBeenCalledWith(150);
  });
});

describe("ExerciseView — weight field + previous weight", () => {
  it("writes typed weight through setWeight while the set is ready (not yet running)", () => {
    const setWeight = vi.fn();
    render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: READY_TIMER,
          setWeight,
        })}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Weight for this set", { exact: false }),
      {
        target: { value: "62.5" },
      },
    );
    expect(setWeight).toHaveBeenCalledWith(62.5);
  });

  it("locks the weight field while the set is running (work/rest/overtime), unlocks at ready", () => {
    const { rerender } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: READY_TIMER,
        })}
      />,
    );
    expect(
      screen.getByLabelText("Weight for this set", { exact: false }),
    ).not.toBeDisabled();

    for (const timer of [WORK_TIMER, REST_TIMER, OVERTIME_TIMER]) {
      rerender(
        <ExerciseView
          session={fakeApi({
            status: "in-progress",
            currentExercise: CURRENT_EXERCISE,
            timer,
          })}
        />,
      );
      expect(
        screen.getByLabelText("Weight for this set", { exact: false }),
      ).toBeDisabled();
    }

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: READY_TIMER,
        })}
      />,
    );
    expect(
      screen.getByLabelText("Weight for this set", { exact: false }),
    ).not.toBeDisabled();
  });

  it("shows a previous-weight reference only when it is not null", () => {
    const { rerender } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          previousWeight: null,
        })}
      />,
    );
    expect(screen.queryByText(/Last time/)).not.toBeInTheDocument();

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          previousWeight: 60,
          unit: "metric",
        })}
      />,
    );
    expect(screen.getByText("Last time: 60 kg")).toBeInTheDocument();
  });

  it("renders the unit label from the seam, never converting itself", () => {
    render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          unit: "imperial",
        })}
      />,
    );
    expect(screen.getByText("lb")).toBeInTheDocument();
  });
});

describe("ExerciseView — Next exercise control", () => {
  it("appears only once the exercise is complete, and calls nextExercise", () => {
    const nextExercise = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER,
          nextExercise,
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Next exercise" }),
    ).not.toBeInTheDocument();

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: COMPLETE_TIMER,
          nextExercise,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next exercise" }));
    expect(nextExercise).toHaveBeenCalledTimes(1);
  });

  it("reserves the Next-exercise slot's height even when the button isn't showing, so the stopwatch above never reflows", () => {
    const { rerender, container } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER,
        })}
      />,
    );
    const slotWithoutButton = screen.getByTestId("next-exercise-slot");
    expect(slotWithoutButton.className).toContain("min-h-");
    expect(
      within(slotWithoutButton).queryByRole("button"),
    ).not.toBeInTheDocument();

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: COMPLETE_TIMER,
        })}
      />,
    );
    const slotWithButton = screen.getByTestId("next-exercise-slot");
    // Same element, same reserved-height class, whether or not the button is
    // inside it — the slot's box never changes shape around its content.
    expect(slotWithButton.className).toBe(slotWithoutButton.className);
    expect(
      container.querySelectorAll('[data-testid="next-exercise-slot"]'),
    ).toHaveLength(1);
  });
});

describe("ExerciseView — per-set progress grid (revised D1: §9.7 redesign)", () => {
  it("shows the 'Set N of M' counter and one placeholder cell per planned set before any set is done", () => {
    render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: READY_TIMER, // currentSeries: 2, plannedSeries: 4
          completedSets: [],
        })}
      />,
    );

    expect(screen.getByTestId("sets-progress-counter")).toHaveTextContent(
      "Set 2 of 4",
    );
    const row = screen.getByTestId("sets-progress-row");
    const cells = within(row).getAllByRole("listitem");
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.className).not.toContain("bg-accent");
    }
    expect(
      screen.getByLabelText("Set 1: not completed yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Set 4: not completed yet"),
    ).toBeInTheDocument();
  });

  it("fills a cell accent + dark on-accent text with its data once that set completes, leaving the rest as placeholders", () => {
    render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER, // plannedSeries: 4
          completedSets: SAMPLE_COMPLETED_SETS, // 2 done
        })}
      />,
    );

    const set1 = screen.getByLabelText(
      "Set 1: 8 reps at 80 kg, 0:42, 640 kg volume",
    );
    expect(set1.className).toContain("bg-accent");
    expect(set1.className).toContain("text-on-accent");
    expect(within(set1).getByText("8×80kg")).toBeInTheDocument();
    // Visible cell content is reps×weight + volume (kept to a 48px row, per
    // the design-critique-driven vertical-fit pass); work time still rides
    // along in the cell's `aria-label` (asserted above), just not rendered.
    expect(within(set1).getByText("640kg")).toBeInTheDocument();

    const set2 = screen.getByLabelText(
      "Set 2: 8 reps at 82.5 kg, 0:39, 660 kg volume",
    );
    expect(set2.className).toContain("bg-accent");

    // Not reached yet — still a placeholder, not accidentally filled.
    const set3 = screen.getByLabelText("Set 3: not completed yet");
    expect(set3.className).not.toContain("bg-accent");
  });

  it("renders completed-cell weight/volume in whatever unit the seam already converted to (imperial passes through unchanged)", () => {
    render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          unit: "imperial",
          timer: WORK_TIMER,
          completedSets: [
            { reps: 5, weight: 135, workSeconds: 30, volume: 675 },
          ],
        })}
      />,
    );

    const set1 = screen.getByLabelText(
      "Set 1: 5 reps at 135 lb, 0:30, 675 lb volume",
    );
    expect(within(set1).getByText("5×135lb")).toBeInTheDocument();
    expect(within(set1).getByText("675lb")).toBeInTheDocument();
  });

  it("scrolls horizontally with fixed-width cells above 4 planned sets; divides evenly with no scroll at 4 or fewer", () => {
    const { rerender } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER, // plannedSeries: 4 — fits, no scroll
          completedSets: [],
        })}
      />,
    );
    const rowAt4 = screen.getByTestId("sets-progress-row");
    expect(rowAt4.className).toContain("overflow-hidden");
    expect(rowAt4.className).not.toContain("overflow-x-auto");
    expect(within(rowAt4).getAllByRole("listitem")[0].className).toContain(
      "flex-1",
    );

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: { ...WORK_TIMER, currentSeries: 3, plannedSeries: 6 },
          completedSets: [],
        })}
      />,
    );
    const rowAt6 = screen.getByTestId("sets-progress-row");
    expect(rowAt6.className).toContain("overflow-x-auto");
    expect(rowAt6.className).not.toContain("overflow-hidden");
    const scrollableCells = within(rowAt6).getAllByRole("listitem");
    expect(scrollableCells).toHaveLength(6);
    expect(scrollableCells[0].className).toContain("flex-[0_0_25%]");
  });

  it("keeps a stable box height regardless of fill state or scroll state, so the stopwatch above never reflows", () => {
    const heightClass = (row: HTMLElement) =>
      row.className.split(" ").find((cls) => cls.startsWith("h-["));

    const { rerender } = render(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER,
          completedSets: [],
        })}
      />,
    );
    const emptyHeight = heightClass(screen.getByTestId("sets-progress-row"));
    expect(emptyHeight).toBeTruthy();

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: WORK_TIMER,
          completedSets: SAMPLE_COMPLETED_SETS,
        })}
      />,
    );
    expect(heightClass(screen.getByTestId("sets-progress-row"))).toBe(
      emptyHeight,
    );

    rerender(
      <ExerciseView
        session={fakeApi({
          status: "in-progress",
          currentExercise: CURRENT_EXERCISE,
          timer: { ...WORK_TIMER, currentSeries: 3, plannedSeries: 6 },
          completedSets: SAMPLE_COMPLETED_SETS,
        })}
      />,
    );
    // Same height even once scrolling kicks in above 4 planned sets.
    expect(heightClass(screen.getByTestId("sets-progress-row"))).toBe(
      emptyHeight,
    );
  });
});

describe("Stopwatch — renders each timer.phase and drives tap", () => {
  it("work: counts elapsed time up and taps end the set", () => {
    const tap = vi.fn().mockResolvedValue(undefined);
    render(<Stopwatch timer={WORK_TIMER} tap={tap} canStartSet={true} />);

    expect(screen.getByText("0:45")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("rest: counts remaining time down", () => {
    render(<Stopwatch timer={REST_TIMER} tap={vi.fn()} canStartSet={true} />);
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByText("Rest")).toBeInTheDocument();
    expect(screen.queryByText(/Time's up/)).not.toBeInTheDocument();
  });

  it("overtime: shows the climbing overtime value and the encouraging prompt", () => {
    render(
      <Stopwatch timer={OVERTIME_TIMER} tap={vi.fn()} canStartSet={true} />,
    );
    expect(screen.getByText("+0:12")).toBeInTheDocument();
    expect(screen.getByText("Overtime")).toBeInTheDocument();
    expect(screen.getByText(/Time's up/)).toBeInTheDocument();
  });

  it("exercise-complete: renders a static, non-interactive state", () => {
    render(
      <Stopwatch timer={COMPLETE_TIMER} tap={vi.fn()} canStartSet={true} />,
    );
    // Appears twice on mount: the visible label and the sr-only phase-change
    // announcement (design-system.md §2 "Accessibility" — transitions only).
    expect(screen.getAllByText("Exercise complete").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("SuccessView — ratings + back home", () => {
  it("captures difficulty and fatigue via submitRatings as they're picked", () => {
    const submitRatings = vi.fn().mockResolvedValue(undefined);
    render(<SuccessView session={fakeApi({ submitRatings })} />);

    const difficultyGroup = screen.getByRole("radiogroup", {
      name: "Difficulty (1–5)",
    });
    fireEvent.click(within(difficultyGroup).getByRole("radio", { name: "3" }));
    expect(submitRatings).toHaveBeenLastCalledWith({
      difficulty: 3,
      fatigue: undefined,
    });

    const fatigueGroup = screen.getByRole("radiogroup", {
      name: "Fatigue (1–5)",
    });
    fireEvent.click(within(fatigueGroup).getByRole("radio", { name: "4" }));
    expect(submitRatings).toHaveBeenLastCalledWith({
      difficulty: 3,
      fatigue: 4,
    });
  });

  it("the back-home control is always enabled and navigates home", () => {
    render(<SuccessView session={fakeApi()} />);

    const backButton = screen.getByRole("button", { name: "Back to home" });
    expect(backButton).toBeEnabled();
    fireEvent.click(backButton);
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
