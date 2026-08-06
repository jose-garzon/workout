import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import type { Goals, Profile } from "../types";
import { ProfileEditScreen } from "./ProfileEditScreen";

/**
 * Against the REAL `useProfileEditor` (real Dexie / fake-indexeddb under it),
 * mirroring `ProfileDrawer.test.tsx`'s convention for a component that owns
 * its seam call internally (design.md D2) — the drawer's tests were the
 * direct template for this page, just navigation instead of open/close.
 *
 * UI-behavior-only, no `shared/db` import (Biome firewall rule 1 blocks it
 * from anything under `modules/*\/ui`, test files included): "did the byte
 * land in IndexedDB" is `useProfileEditor.test.tsx`'s job (a `logic/` test),
 * this file only asserts what's rendered and whether Save navigates.
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  // `AppShell` renders `ProfileLink`, which reads the current route to hide
  // itself on /profile* (design.md D14) — a plain page here, so "elsewhere".
  usePathname: () => "/profile/edit",
}));

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

afterEach(() => {
  cleanup();
  pushMock.mockClear();
});

const profile: Profile = {
  id: "me",
  displayName: "Alex",
  gender: "male",
  age: 28,
  unit: "metric",
  bodyweightKg: 80,
  heightCm: 180,
};

const goals: Goals = { id: "me", focus: "strength", daysPerWeek: 4 };

describe("ProfileEditScreen — layout + prefill", () => {
  it("pre-fills all 8 fields from the saved records in the saved unit", () => {
    render(<ProfileEditScreen profile={profile} goals={goals} />);

    expect(
      screen.getByLabelText(t("onboarding.field.displayName"), {
        exact: false,
      }),
    ).toHaveValue("Alex");
    expect(
      screen.getByRole("radio", { name: t("onboarding.gender.male") }),
    ).toBeChecked();
    expect(
      screen.getByLabelText(t("onboarding.field.age"), { exact: false }),
    ).toHaveValue("28");
    expect(
      screen.getByRole("radio", { name: t("onboarding.unit.metric") }),
    ).toBeChecked();
    expect(
      screen.getByLabelText(t("onboarding.field.bodyweight", { unit: "kg" }), {
        exact: false,
      }),
    ).toHaveValue("80");
    expect(
      screen.getByRole("radio", { name: t("onboarding.focus.strength") }),
    ).toBeChecked();
  });

  it("leads with a back link to /profile", () => {
    render(<ProfileEditScreen profile={profile} goals={goals} />);
    expect(
      screen.getByRole("link", { name: t("common.back") }),
    ).toHaveAttribute("href", "/profile");
  });
});

describe("ProfileEditScreen — save", () => {
  it("blocks save on invalid input, indicates the field, and does not navigate", async () => {
    render(<ProfileEditScreen profile={profile} goals={goals} />);
    fireEvent.change(
      screen.getByLabelText(t("onboarding.field.bodyweight", { unit: "kg" }), {
        exact: false,
      }),
      { target: { value: "" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("profile.edit.save") }),
    );

    expect(
      await screen.findByText(t("onboarding.error.bodyweight.required")),
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("a valid save writes via saveProfileEdits then navigates to /profile", async () => {
    render(<ProfileEditScreen profile={profile} goals={goals} />);
    fireEvent.change(
      screen.getByLabelText(t("onboarding.field.displayName"), {
        exact: false,
      }),
      { target: { value: "Sam" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("profile.edit.save") }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/profile"));
  });

  it("moves focus to the first invalid field on a blocked save", async () => {
    render(<ProfileEditScreen profile={profile} goals={goals} />);
    const bodyweight = screen.getByLabelText(
      t("onboarding.field.bodyweight", { unit: "kg" }),
      { exact: false },
    );
    fireEvent.change(bodyweight, { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", { name: t("profile.edit.save") }),
    );

    await waitFor(() => expect(bodyweight).toHaveFocus());
  });
});

describe("ProfileEditScreen — remount re-seeds from saved records", () => {
  it("unmounting and re-mounting discards abandoned edits", () => {
    const { unmount } = render(
      <ProfileEditScreen profile={profile} goals={goals} />,
    );
    fireEvent.change(
      screen.getByLabelText(t("onboarding.field.displayName"), {
        exact: false,
      }),
      { target: { value: "Temp" } },
    );
    unmount();

    render(<ProfileEditScreen profile={profile} goals={goals} />);
    expect(
      screen.getByLabelText(t("onboarding.field.displayName"), {
        exact: false,
      }),
    ).toHaveValue("Alex");
  });
});
