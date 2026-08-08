import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import type { DayCard, Routine } from "../types";
import { RoutineSummary } from "./RoutineSummary";

// next/link needs an app-router context we don't mount in unit tests — render a
// plain anchor so href/navigation intent is still assertable (same convention
// as routineHome.integration.test.tsx).
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

afterEach(cleanup);

const ROUTINE: Routine = {
  id: "active",
  name: "My Split",
  createdAt: Date.now(),
  active: true,
  days: [],
};

// Fixture `DayCard[]` per design.md §"The logic↔UI seam" — pre-ordered by the
// caller (`next` first), out of routine-position order on purpose so the
// component-doesn't-sort and numbers-follow-position assertions mean something.
const DAYS: DayCard[] = [
  { id: "day-4", name: "Upper", position: 4, exerciseCount: 3, state: "next" },
  {
    id: "day-1",
    name: "Push",
    position: 1,
    exerciseCount: 4,
    state: "finished",
  },
  {
    id: "day-2",
    name: "Pull",
    position: 2,
    exerciseCount: 4,
    state: "finished",
  },
  {
    id: "day-3",
    name: "Legs",
    position: 3,
    exerciseCount: 5,
    state: "finished",
  },
  { id: "day-5", name: "Core", position: 5, exerciseCount: 2, state: "idle" },
];

function renderSummary(days: DayCard[]) {
  return render(
    <RoutineSummary
      routine={ROUTINE}
      days={days}
      onEdit={() => {}}
      editButtonRef={{ current: null }}
    />,
  );
}

describe("RoutineSummary", () => {
  it("renders every card in the given order, doing no sorting itself", () => {
    renderSummary(DAYS);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/workout/day-4",
      "/workout/day-1",
      "/workout/day-2",
      "/workout/day-3",
      "/workout/day-5",
    ]);
  });

  it("numbers each card by its routine position, never the list index", () => {
    renderSummary(DAYS);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("04");
    expect(links[1]).toHaveTextContent("01");
    expect(links[2]).toHaveTextContent("02");
    expect(links[3]).toHaveTextContent("03");
    expect(links[4]).toHaveTextContent("05");
  });

  it("gives the next card an accessible name identifying it as next", () => {
    renderSummary(DAYS);
    expect(screen.getAllByRole("link")[0]).toHaveAccessibleName(/next/i);
  });

  it("gives every finished card an accessible name identifying it as completed", () => {
    renderSummary(DAYS);
    for (const link of screen.getAllByRole("link").slice(1, 4)) {
      expect(link).toHaveAccessibleName(/completed/i);
    }
  });

  it("gives idle cards neither word", () => {
    renderSummary(DAYS);
    expect(screen.getAllByRole("link")[4]).not.toHaveAccessibleName(
      /next|completed/i,
    );
  });

  it("links every state — idle, next, and finished alike — to its own day's workout screen", () => {
    renderSummary(DAYS);
    for (const card of DAYS) {
      expect(
        screen.getByRole("link", { name: new RegExp(card.name) }),
      ).toHaveAttribute("href", `/workout/${card.id}`);
    }
  });

  it("separator 1 (border) — next carries the accent border, finished carries none", () => {
    renderSummary(DAYS);
    const links = screen.getAllByRole("link");
    expect(links[0].className).toMatch(/border-accent-text/);
    expect(links[1].className).not.toMatch(/border-accent-text/);
    expect(links[1].className).toMatch(/border-border/);
  });

  it("separator 2 (size) — next steps up a full size increment, idle and finished match", () => {
    renderSummary(DAYS);
    const links = screen.getAllByRole("link");
    expect(links[0].className).toMatch(/space-11/);
    expect(links[1].className).toMatch(/control-height-lg/);
    expect(links[4].className).toMatch(/control-height-lg/);
  });

  it("separator 3 (eyebrow) — only next renders a visible eyebrow label", () => {
    renderSummary(DAYS);
    expect(screen.getByText(t("routine.summary.state.next"))).toBeVisible();
  });

  it("renders no list when there are no days, but keeps the heading and edit button", () => {
    renderSummary([]);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: ROUTINE.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t("routine.summary.edit") }),
    ).toBeInTheDocument();
  });
});
