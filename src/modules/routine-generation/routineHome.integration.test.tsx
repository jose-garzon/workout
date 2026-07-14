import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
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
  useEditStore.getState().reset();
  await db.routines.clear();
});

describe("Composer", () => {
  it("blocks submitting an empty / whitespace-only prompt", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} busy={false} />);

    const button = screen.getByRole("button", { name: "Build my routine" });
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
    fireEvent.click(screen.getByRole("button", { name: "Build my routine" }));
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

  // AC1.1/1.2 (edit-routine) — once a routine exists, editing (not the build
  // composer) is the single post-creation path.
  it("shows the edit button and hides the build composer once a routine exists", async () => {
    await saveActive(routine());
    render(<RoutineHomeScreen {...PROPS} />);

    await screen.findByRole("link", { name: /Push/ });
    expect(
      screen.getByRole("button", { name: "Edit routine" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Describe the routine you want"),
    ).not.toBeInTheDocument();
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
