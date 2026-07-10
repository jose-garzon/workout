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
import { saveActive } from "./api/routineRepo";
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
  bodyweightKg: 80,
  unit: "metric" as const,
};

function routine(name = "PPL"): Routine {
  return {
    id: crypto.randomUUID(),
    name,
    subtitle: `${name} — let's go`,
    createdAt: Date.now(),
    active: true,
    days: [
      {
        id: "day-push",
        name: "Push",
        exercises: [
          {
            id: crypto.randomUUID(),
            name: "Bench",
            sets: [{ reps: 8, restSeconds: 120 }],
          },
        ],
      },
    ],
  };
}

afterEach(cleanup);

beforeEach(async () => {
  useGenerationStore.getState().reset();
  await db.routines.clear();
});

describe("Composer", () => {
  it("blocks submitting an empty / whitespace-only prompt", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} busy={false} />);

    const button = screen.getByRole("button", { name: "Build routine" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Describe the routine you want"), {
      target: { value: "   " },
    });
    expect(button).toBeDisabled();
  });

  it("submits the trimmed prompt when text is present", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} busy={false} />);

    fireEvent.change(screen.getByLabelText("Describe the routine you want"), {
      target: { value: "  push pull legs  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build routine" }));
    expect(onSubmit).toHaveBeenCalledWith("push pull legs");
  });
});

describe("RoutineHomeScreen — identity + empty state", () => {
  it("greets by name, shows the goal badge, and invites when no routine exists", async () => {
    render(<RoutineHomeScreen {...PROPS} />);

    expect(
      await screen.findByRole("heading", { name: /Hey, Alex/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hypertrophy")).toBeInTheDocument();
    expect(
      screen.getByText(/describe your training below/i),
    ).toBeInTheDocument();
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

    expect(screen.getByText("Building your routine…")).toBeInTheDocument();
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
});

describe("RoutineHomeScreen — replace confirmation (design.md §D5)", () => {
  it("declining a replacement keeps the current routine", async () => {
    await saveActive(routine("Current"));
    render(<RoutineHomeScreen {...PROPS} />);
    // Wait for the active routine to load before staging a held result, so the
    // auto-adopt effect (which only fires when NO routine exists) does not run.
    await screen.findByRole("link", { name: /Push/ });

    act(() => {
      useGenerationStore.setState({ status: "ready", result: routine("New") });
    });

    expect(
      screen.getByRole("dialog", { name: /Replace your routine/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep current" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // The new routine was never persisted.
    const { getActive } = await import("./api/routineRepo");
    expect((await getActive())?.name).toBe("Current");
  });
});
