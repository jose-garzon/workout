import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import { ProfileScreen } from "./ProfileScreen";

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

describe("ProfileScreen", () => {
  it("orders title, name, goal badge, and edit-profile card from the top", () => {
    render(<ProfileScreen displayName="Alex" focus="hypertrophy" />);

    // AppShell's sr-only <h1> and this screen's visible eyebrow <h2> both
    // carry "Profile" — the two-match case is intentional (design.md D11).
    expect(
      screen.getAllByRole("heading", { name: t("profile.title") }).length,
    ).toBeGreaterThanOrEqual(1);

    const name = screen.getByText("Alex");
    const badge = screen.getByText(t("home.goal.hypertrophy"));
    const editLink = screen.getByRole("link", { name: t("profile.edit.cta") });
    expect(editLink).toHaveAttribute("href", "/profile/edit");

    // DOM order: name -> badge -> edit card.
    expect(
      name.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      badge.compareDocumentPosition(editLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the name more prominently than the title", () => {
    const { container } = render(<ProfileScreen displayName="Alex" />);
    const title = container.querySelector("h2");
    expect(title).toHaveClass("text-micro");
    expect(screen.getByText("Alex")).toHaveClass("text-display");
  });

  it("renders the goal badge for the given focus, defaulting to general", () => {
    render(<ProfileScreen displayName="Alex" />);
    expect(screen.getByText(t("home.goal.general"))).toBeVisible();
  });

  it("leads with a back link to home", () => {
    render(<ProfileScreen displayName="Alex" />);
    const back = screen.getByRole("link", { name: t("common.back") });
    expect(back).toHaveAttribute("href", "/");
  });

  it("renders exactly two controls in the bottom settings row: theme + language", () => {
    render(<ProfileScreen displayName="Alex" />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /switch to/i })).toHaveLength(
      1,
    );
  });

  it("falls back to a generic name when none is saved", () => {
    render(<ProfileScreen />);
    expect(screen.getByText(t("home.greeting.fallbackName"))).toBeVisible();
  });
});
