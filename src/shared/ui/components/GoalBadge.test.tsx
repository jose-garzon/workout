import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "@/shared/i18n";
import { GoalBadge } from "./GoalBadge";

afterEach(cleanup);

describe("GoalBadge", () => {
  it("shows the label for a known training focus", () => {
    render(<GoalBadge focus="hypertrophy" />);
    expect(screen.getByText(t("home.goal.hypertrophy"))).toBeVisible();
  });

  it("falls back to the raw value for an unknown focus", () => {
    render(<GoalBadge focus="mystery" />);
    expect(screen.getByText("mystery")).toBeVisible();
  });
});
