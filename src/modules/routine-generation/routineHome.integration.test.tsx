import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { t } from "@/shared/i18n";
import { saveActive } from "./api/routineRepo";
import { useEditStore } from "./logic/editStore";
import { useGenerationStore } from "./logic/generationStore";
import type { Routine } from "./types";
import { Composer } from "./ui/Composer";
import { RoutineHomeScreen } from "./ui/RoutineHomeScreen";

// next/link needs an app-router context we don't mount in unit tests — render a
// plain anchor so href/navigation intent is still assertable.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PROPS = {
  displayName: "Alex",
  focus: "hypertrophy",
  daysPerWeek: 5,
  gender: "male",
  age: 29,
  bodyweightKg: 80,
  heightCm: 178,
  unit: "metric" as const,
};

const CREATED_AT = 1_000_000;

function day(id: string, name: string) {
  return {
    id,
    name,
    exercises: [
      {
        id: crypto.randomUUID(),
        name: "Bench",
        sets: [{ reps: 8, restSeconds: 120 }],
      },
    ],
  };
}

function routine(name = "PPL"): Routine {
  return {
    id: crypto.randomUUID(),
    name,
    subtitle: `${name} — let's go`,
    createdAt: CREATED_AT,
    active: true,
    days: [
      day("day-push", "Push"),
      day("day-pull", "Pull"),
      day("day-legs", "Legs"),
    ],
  };
}

afterEach(cleanup);

beforeEach(async () => {
  useGenerationStore.getState().reset();
  useEditStore.getState().reset();
  await Promise.all([db.routines.clear(), db.completedSessions.clear()]);
});

describe("Composer", () => {
  it("blocks submitting an empty / whitespace-only prompt", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} busy={false} />);

    const button = screen.getByRole("button", { name: t("composer.submit") });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(t("composer.label")), {
      target: { value: "   " },
    });
    expect(button).toBeDisabled();
  });

  it("submits the trimmed prompt when text is present", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} busy={false} />);

    fireEvent.change(screen.getByLabelText(t("composer.label")), {
      target: { value: "  push pull legs  " },
    });
    fireEvent.click(screen.getByRole("button", { name: t("composer.submit") }));
    expect(onSubmit).toHaveBeenCalledWith("push pull legs");
  });
});

describe("RoutineHomeScreen — identity + empty state", () => {
  it("greets by name, shows the goal badge, and invites when no routine exists", async () => {
    render(<RoutineHomeScreen {...PROPS} />);

    expect(
      await screen.findByRole("heading", {
        name: t("home.greeting", { name: "Alex" }),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("home.goal.hypertrophy"))).toBeInTheDocument();
    expect(screen.getByText(t("home.empty.hint"))).toBeInTheDocument();
  });
});

describe("RoutineHomeScreen — in-flight", () => {
  it("shows the building indicator and the streamed thinking while generating", () => {
    act(() => {
      useGenerationStore.setState({
        status: "generating",
        progressMessage: "Choosing your split",
      });
    });
    render(<RoutineHomeScreen {...PROPS} />);

    expect(
      screen.getByText(
        t("routine.indicator.template", {
          verb: t("routine.building.verb.building"),
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Choosing your split")).toBeInTheDocument();
  });
});

describe("RoutineHomeScreen — routine summary", () => {
  it("lists each day and links it to workout mode", async () => {
    await saveActive(routine());
    render(<RoutineHomeScreen {...PROPS} />);

    const link = await screen.findByRole("link", { name: /Push/ });
    expect(link).toHaveAttribute("href", "/workout/day-push");
    // The routine's subtitle drives the motivational line.
    expect(screen.getByText("PPL — let's go")).toBeInTheDocument();
  });

  // AC1.1/1.2 (edit-routine) — once a routine exists, editing (not the build
  // composer) is the single post-creation path.
  it("shows the edit button and hides the build composer once a routine exists", async () => {
    await saveActive(routine());
    render(<RoutineHomeScreen {...PROPS} />);

    await screen.findByRole("link", { name: /Push/ });
    const editButton = screen.getByRole("button", {
      name: t("routine.summary.edit"),
    });
    expect(editButton).toBeInTheDocument();
    // profile-page (tasks.md group 7): icon-only, no visible text — the
    // accessible name comes from aria-label, not button text.
    expect(editButton).toHaveTextContent("");
    expect(
      screen.queryByLabelText(t("composer.label")),
    ).not.toBeInTheDocument();
  });
});

describe("RoutineHomeScreen — day cycle order", () => {
  /** The day list in render order, by href. The `next` card is first (design.md
   *  §D3); each card's STATE copy is asserted in the `RoutineSummary` component
   *  test, which owns it — here the seam's contribution is the order. */
  const dayHrefs = () =>
    screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .filter((href) => href?.startsWith("/workout/"));

  it("puts day 1 first on a fresh routine", async () => {
    await saveActive(routine());
    render(<RoutineHomeScreen {...PROPS} />);

    await screen.findByRole("link", { name: /Push/ });
    expect(dayHrefs()).toEqual([
      "/workout/day-push",
      "/workout/day-pull",
      "/workout/day-legs",
    ]);
  });

  it("re-emits with day 2 first once day 1 is completed", async () => {
    await saveActive(routine());
    render(<RoutineHomeScreen {...PROPS} />);
    await screen.findByRole("link", { name: /Push/ });

    await db.completedSessions.put({
      id: "s1",
      routineId: "active",
      dayId: "day-push",
      completedAt: CREATED_AT + 1,
      exerciseLogs: [],
    });

    await waitFor(() =>
      expect(dayHrefs()).toEqual([
        "/workout/day-pull",
        "/workout/day-push",
        "/workout/day-legs",
      ]),
    );
  });
});

describe("RoutineHomeScreen — background blocked during an in-flight edit", () => {
  it("marks the shell inert only while status is 'editing', restoring on error", async () => {
    await saveActive(routine());
    const { container } = render(<RoutineHomeScreen {...PROPS} />);
    await screen.findByRole("link", { name: /Push/ });

    expect(container.querySelector("[inert]")).not.toBeInTheDocument();

    act(() => {
      useEditStore.setState({ status: "editing" });
    });
    expect(container.querySelector("[inert]")).toBeInTheDocument();

    // An error must restore interactivity (only the in-flight state blocks —
    // the user needs to retry or dismiss).
    act(() => {
      useEditStore.setState({ status: "error", error: { kind: "provider" } });
    });
    expect(container.querySelector("[inert]")).not.toBeInTheDocument();
  });
});
