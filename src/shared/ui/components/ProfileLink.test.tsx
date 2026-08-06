import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import { ProfileLink } from "./ProfileLink";

const usePathnameMock = vi.fn<() => string | null>();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

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

describe("ProfileLink", () => {
  it("renders a link to /profile on a normal route", () => {
    usePathnameMock.mockReturnValue("/");
    render(<ProfileLink />);

    const link = screen.getByRole("link", { name: t("common.profile.open") });
    expect(link).toHaveAttribute("href", "/profile");
  });

  it("renders nothing on /profile", () => {
    usePathnameMock.mockReturnValue("/profile");
    render(<ProfileLink />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing on /profile/edit", () => {
    usePathnameMock.mockReturnValue("/profile/edit");
    render(<ProfileLink />);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
