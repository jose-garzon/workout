import { expect, type Page, test } from "@playwright/test";

/**
 * Feature edit-routine end-to-end (tasks.md group 7): once a routine exists the
 * standing composer is replaced by an edit button; tapping it floats a
 * bottom-docked editor over the still-visible routine; submitting sends the
 * CURRENT routine + a targeted instruction to the SAME AI proxy (discriminated
 * by `mode: "edit"`), applies only the requested change directly (no confirm),
 * and keeps the routine + editor on failure/offline.
 *
 * The proxy is intercepted deterministically. Both build and edit hit
 * `/api/generate-routine`; the handler branches on the request body's `mode`.
 *
 * Written RED-first — the edit surface is not built yet, so every test here is
 * expected to FAIL until the feature lands.
 *
 * Accessible names coined here for the builders to converge on (designer:
 * match these):
 *   - edit button:       role button "Edit"
 *   - editor field:      label "Improve your routine"
 *   - editor submit:     role button "Apply edit"
 *   - loading verb:      first stable verb "Improving" (edit counterpart to the
 *                        build indicator's "Building")
 *   - dismiss:           Esc key (design §F)
 */

const ROUTINE = {
  name: "Push / Pull / Legs",
  subtitle: "Five days, no excuses.",
  days: [
    {
      name: "Push",
      exercises: [
        { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
      ],
    },
    {
      name: "Pull",
      exercises: [{ name: "Row", sets: [{ reps: 10, restSeconds: 90 }] }],
    },
  ],
};

/** A targeted edit: adds a Legs day, leaving Push + Pull byte-for-byte unchanged. */
const EDITED_ROUTINE = {
  ...ROUTINE,
  days: [
    ...ROUTINE.days,
    {
      name: "Legs",
      exercises: [{ name: "Squat", sets: [{ reps: 5, restSeconds: 180 }] }],
    },
  ],
};

function sse(routine: object) {
  const event = (delta: object) =>
    `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
  return {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    body: event({ content: JSON.stringify(routine) }) + "data: [DONE]\n\n",
  };
}

interface EditBody {
  mode?: string;
  instruction?: string;
  routine?: unknown;
}

interface RouteOpts {
  edited?: object;
  editDelayMs?: number;
  editStatus?: number;
  onEdit?: (body: EditBody) => void;
}

/**
 * One handler for both flows: a build body responds with ROUTINE; an
 * `{ mode: "edit" }` body responds with the edited routine (optionally delayed
 * or failed) and reports the request via `onEdit`.
 */
async function routeAi(page: Page, opts: RouteOpts = {}) {
  const {
    edited = EDITED_ROUTINE,
    editDelayMs = 0,
    editStatus = 200,
    onEdit,
  } = opts;
  await page.route("**/api/generate-routine", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as EditBody;
    if (body.mode === "edit") {
      onEdit?.(body);
      if (editStatus !== 200) {
        await route.fulfill({ status: editStatus, body: "boom" });
        return;
      }
      if (editDelayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, editDelayMs));
      await route.fulfill(sse(edited));
      return;
    }
    await route.fulfill(sse(ROUTINE));
  });
}

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByLabel("Your name", { exact: false }).fill("Alex");
  // exact:true — a substring match on "Male" also hits "Female".
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Age", { exact: false }).fill("28");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Bodyweight (kg)", { exact: false }).fill("80");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "Strength" }).click();
  const increase = page.getByRole("button", {
    name: "Increase Training days per week",
  });
  for (let i = 0; i < 4; i++) await increase.click();
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page.getByRole("heading", { name: /Hey, Alex/ })).toBeVisible();
}

/** Onboard + build the initial routine so home shows the summary. */
async function seedRoutine(page: Page) {
  await completeOnboarding(page);
  await page.getByLabel("Describe the routine you want").fill("push pull legs");
  await page.getByRole("button", { name: "Build my routine" }).click();
  await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Improve your routine")).toBeVisible();
}

test.describe("edit-routine", () => {
  test("edit button replaces the composer once a routine exists (AC1.1/1.2/1.3)", async ({
    page,
  }) => {
    await routeAi(page);
    await completeOnboarding(page);

    // AC1.3: no routine yet → build composer present, no edit button.
    await expect(
      page.getByLabel("Describe the routine you want"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

    await page
      .getByLabel("Describe the routine you want")
      .fill("push pull legs");
    await page.getByRole("button", { name: "Build my routine" }).click();
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();

    // AC1.1: edit button next to the routine title.
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    // AC1.2: the standing build composer is gone.
    await expect(page.getByLabel("Describe the routine you want")).toHaveCount(
      0,
    );
  });

  test("editor floats over the visible, non-modal routine (AC2.1/2.2)", async ({
    page,
  }) => {
    await routeAi(page);
    await seedRoutine(page);
    await openEditor(page);

    // AC2.2: the routine content is still visible behind the editor…
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pull/ })).toBeVisible();
    // …and it is NOT a dimming modal dialog (contrast the removed
    // "Replace your routine?" scrim, which was aria-modal).
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("empty submit is blocked; dismissing leaves the routine unchanged (AC2.3/2.4)", async ({
    page,
  }) => {
    let edited = false;
    await routeAi(page, {
      onEdit: () => {
        edited = true;
      },
    });
    await seedRoutine(page);
    await openEditor(page);

    // AC2.3: empty and whitespace-only cannot submit.
    const apply = page.getByRole("button", { name: "Apply edit" });
    await expect(apply).toBeDisabled();
    await page.getByLabel("Improve your routine").fill("   ");
    await expect(apply).toBeDisabled();

    // AC2.4: dismiss (Esc) closes the editor, routine unchanged.
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Improve your routine")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(edited).toBe(false);
  });

  test("submitting sends current routine + instruction and applies only the change (AC3.1/3.2/3.3)", async ({
    page,
  }) => {
    let editBody: EditBody | null = null;
    await routeAi(page, {
      onEdit: (body) => {
        editBody = body;
      },
    });
    await seedRoutine(page);
    await openEditor(page);

    const instruction = "add a legs day with squats";
    await page.getByLabel("Improve your routine").fill(instruction);
    await page.getByRole("button", { name: "Apply edit" }).click();

    // AC3.2: the requested change is applied; untouched parts remain.
    await expect(page.getByRole("link", { name: /Legs/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pull/ })).toBeVisible();

    // AC3.1: the request carried mode:"edit", the instruction, and the
    // current routine's content.
    const sent = editBody as EditBody | null;
    expect(sent).not.toBeNull();
    expect(sent?.mode).toBe("edit");
    expect(sent?.instruction).toBe(instruction);
    expect(JSON.stringify(sent?.routine)).toContain("Push");

    // AC3.3: applied directly — no confirmation dialog.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Replace your routine?")).toHaveCount(0);
  });

  test("edit verbs show while loading, then the editor closes on success (AC3.4/3.5)", async ({
    page,
  }) => {
    await routeAi(page, { editDelayMs: 600 });
    await seedRoutine(page);
    await openEditor(page);

    await page.getByLabel("Improve your routine").fill("add a legs day");
    await page.getByRole("button", { name: "Apply edit" }).click();

    // AC3.4: an edit-specific verb (distinct from build's "Building") is shown.
    // designer: make the first, stable edit verb "Improving".
    await expect(page.getByText(/Improving/i)).toBeVisible();

    // AC3.5: on success the editor closes and home returns to the routine
    // view + edit button.
    await expect(page.getByRole("link", { name: /Legs/ })).toBeVisible();
    await expect(page.getByLabel("Improve your routine")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  test("a backend error keeps the editor open and the routine unchanged (AC4.1)", async ({
    page,
  }) => {
    await routeAi(page, { editStatus: 500 });
    await seedRoutine(page);
    await openEditor(page);

    await page.getByLabel("Improve your routine").fill("add a legs day");
    await page.getByRole("button", { name: "Apply edit" }).click();

    // A specific, human-readable message; editor stays open; routine unchanged.
    // designer: edit-flavored copy, e.g. "Couldn't apply your edit — try again."
    await expect(page.getByText(/couldn't apply|try again/i)).toBeVisible();
    await expect(page.getByLabel("Improve your routine")).toBeVisible();
    await expect(page.getByRole("link", { name: /Legs/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
  });

  test("offline submission makes no network call and keeps the editor open (AC4.2)", async ({
    page,
    context,
  }) => {
    // Kept in the chromium project (not a *.offline.spec): the routine is built
    // ONLINE first, then we drop the network for the edit only — no SW-cached
    // reload is needed, so context.setOffline within the test suffices.
    let edited = false;
    await routeAi(page, {
      onEdit: () => {
        edited = true;
      },
    });
    await seedRoutine(page);
    await openEditor(page);

    await context.setOffline(true);
    await page.getByLabel("Improve your routine").fill("add a legs day");
    await page.getByRole("button", { name: "Apply edit" }).click();

    // Indicates a connection is required; no network call fired; routine
    // unchanged; editor stays open.
    await expect(page.getByText(/offline|connection/i)).toBeVisible();
    await expect(page.getByLabel("Improve your routine")).toBeVisible();
    await expect(page.getByRole("link", { name: /Legs/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
    expect(edited).toBe(false);

    await context.setOffline(false);
  });

  // ID preservation (tasks.md 7.7). Verifying "previous logged weight survives
  // an unrelated edit" end-to-end requires seeding real workout history — a full
  // log-a-set flow through workout mode, then an edit, then re-reading the
  // previous weight. That is heavy and brittle in e2e; id preservation is
  // covered directly and thoroughly by the engineer's assembleEditedRoutine
  // unit test (tasks.md 2.5), which asserts unchanged day/exercise keep ids,
  // renamed/new get fresh ids, duplicate names don't collide, and createdAt is
  // preserved. Left as fixme by design.
  test.fixme("an unrelated edit preserves logged-weight history for untouched exercises (ID preservation)", async () => {});
});
