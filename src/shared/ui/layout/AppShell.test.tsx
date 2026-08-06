import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import { AppShell } from "./AppShell";

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

describe("AppShell header", () => {
  it("shows a profile navigation link and no theme toggle (profile-page design.md D6)", () => {
    render(<AppShell title="Home">content</AppShell>);

    const profileLink = screen.getByRole("link", {
      name: t("common.profile.open"),
    });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
