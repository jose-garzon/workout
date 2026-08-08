import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import type { InstallStatus } from "@/shared/ui/install/useInstallPrompt";
import { InstallBanner } from "./InstallBanner";

/**
 * `InstallBanner` against a mocked `useInstallPrompt` (tasks.md 2.7) — one
 * case per status. Detection itself belongs to `useInstallPrompt.test.tsx`;
 * this file only proves the component renders the right thing for each value
 * of the seam.
 */

const useInstallPromptMock =
  vi.fn<() => { status: InstallStatus; promptInstall: () => Promise<void> }>();

vi.mock("@/shared/ui/install/useInstallPrompt", () => ({
  useInstallPrompt: () => useInstallPromptMock(),
}));

afterEach(cleanup);

describe("InstallBanner", () => {
  it("renders nothing when hidden", () => {
    useInstallPromptMock.mockReturnValue({
      status: "hidden",
      promptInstall: vi.fn(),
    });
    const { container } = render(<InstallBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title, native description, and an install button when native", () => {
    const promptInstall = vi.fn();
    useInstallPromptMock.mockReturnValue({ status: "native", promptInstall });
    render(<InstallBanner />);

    expect(
      screen.getByRole("region", { name: t("install.title") }),
    ).toHaveTextContent(t("install.description.native"));
    expect(
      screen.getByRole("button", { name: t("install.cta") }),
    ).toBeInTheDocument();
  });

  it("renders the ios description with no button", () => {
    useInstallPromptMock.mockReturnValue({
      status: "ios",
      promptInstall: vi.fn(),
    });
    render(<InstallBanner />);

    expect(
      screen.getByRole("region", { name: t("install.title") }),
    ).toHaveTextContent(t("install.description.ios"));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the manual description with no button", () => {
    useInstallPromptMock.mockReturnValue({
      status: "manual",
      promptInstall: vi.fn(),
    });
    render(<InstallBanner />);

    expect(
      screen.getByRole("region", { name: t("install.title") }),
    ).toHaveTextContent(t("install.description.manual"));
    expect(screen.queryByRole("button")).toBeNull();
  });
});
