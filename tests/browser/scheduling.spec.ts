import { test, expect, type Page } from "@playwright/test";
import { legacyFixture, date } from "../../src/test/fixtures";

const frozenNow = new Date("2026-11-02T05:00:00Z");
async function readWorkspace(page: Page, key = "state") {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("daylight-private-planner");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<any>((resolve, reject) => {
        const r = db.transaction("workspace").objectStore("workspace").get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }, key);
}
async function openFixture(
  page: Page,
  baseURL: string,
  modify?: (raw: ReturnType<typeof legacyFixture>) => void,
) {
  await page.clock.install({ time: frozenNow });
  // A new Playwright context per test; this URL has no application scripts.
  await page.goto(new URL("/scheduling-test-fixture", baseURL).href);
  const raw = legacyFixture();
  raw.activities = [];
  raw.workouts = [];
  raw.completions = {};
  modify?.(raw);
  await page.evaluate(async (raw) => {
    if (
      (await indexedDB.databases()).some(
        (d) => d.name === "daylight-private-planner",
      )
    )
      throw new Error("Refusing to seed an existing workspace");
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("daylight-private-planner", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("workspace");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("workspace", "readwrite");
        tx.objectStore("workspace").put(raw, "state");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, raw);
  await page.goto(`${baseURL}#calendar`);
  await expect(
    page.getByRole("button", { name: "Academic calendar", exact: true }),
  ).toBeVisible();
  return raw;
}
async function addPeriod(page: Page) {
  await page
    .getByRole("button", { name: "Academic calendar", exact: true })
    .click();
  await page
    .getByLabel("Exam period name", { exact: true })
    .fill("Midterm Week");
  await page.getByLabel("Period start date", { exact: true }).fill(date);
  await page.getByLabel("Period end date", { exact: true }).fill("2026-11-08");
  await page
    .getByRole("button", { name: "Save exam period", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Midterm Week", exact: true }),
  ).toBeVisible();
}
async function generateOneDay(page: Page) {
  await page
    .getByRole("button", { name: "Generate Study Plan", exact: true })
    .click();
  await page.getByLabel("Plan length", { exact: true }).selectOption("1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Generate Study Plan", exact: true })
    .click();
}

test("migrates v1, suspends lectures, restores timetable and calculates weekday/date commutes", async ({
  page,
  baseURL,
}) => {
  const original = await openFixture(page, baseURL!);
  expect((await readWorkspace(page)).version).toBe(2);
  expect(await readWorkspace(page, "migration-backup-v1")).toEqual(original);
  expect((await readWorkspace(page)).subjects).toEqual(original.subjects);
  await addPeriod(page);
  await page
    .getByRole("combobox", { name: /Departure rule/ })
    .selectOption("departure");
  await page.getByLabel("Bus departure time", { exact: true }).fill("15:30");
  await page.getByLabel(/Expected arrival home/).fill("16:45");
  await page
    .getByRole("button", { name: "Save return rule", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit return rule", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Preview commute date", { exact: true })
    .fill("2026-11-09");
  await expect(page.locator(".notice")).toContainText(
    "depart 15:30 · arrive home 16:45 · recovery ends 17:45",
  );
  await page
    .getByRole("combobox", { name: /Rule applies to/ })
    .selectOption("date");
  await page.getByLabel("Override date", { exact: true }).fill("2026-11-09");
  await page
    .getByLabel("Waiting after final class (minutes)", { exact: true })
    .fill("20");
  await page
    .getByLabel("Return travel duration (minutes)", { exact: true })
    .fill("40");
  await page
    .getByRole("button", { name: "Save return rule", exact: true })
    .click();
  await expect(page.locator(".notice")).toContainText(
    "depart 14:20 · arrive home 15:00 · recovery ends 16:00",
  );
  await page.getByLabel("Preview commute date", { exact: true }).fill(date);
  await expect(page.locator(".notice")).toContainText("No university trip");
  await page
    .locator(".page-tabs")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.locator(".fc-event")).toHaveCount(1);
  await expect(page.locator(".fc-event")).toContainText("Programming midterm");
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(
    page.locator(".fc-event").filter({ hasText: "09:00 - 14:00Programming" }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".fc-event")
      .filter({ hasText: "14:00 - 14:20Wait for the bus" }),
  ).toHaveCount(1);
  expect((await readWorkspace(page)).classes).toEqual(original.classes);
});

test("proposal modify/reject/regenerate, quota error, double acceptance, reload and offline restart", async ({
  page,
  context,
  baseURL,
}) => {
  await openFixture(page, baseURL!);
  await addPeriod(page);
  await generateOneDay(page);
  await expect(
    page.getByRole("button", { name: "Accept session", exact: true }).first(),
  ).toBeVisible();
  const beforeReject = await readWorkspace(page);
  await page
    .getByRole("button", { name: "Reject suggestions", exact: true })
    .click();
  await expect(
    page.getByText("Suggestions rejected. Your schedule is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await readWorkspace(page)).toEqual(beforeReject);
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await page
    .getByRole("button", { name: "Modify suggestions", exact: true })
    .click();
  const row = page.locator("[data-proposal-id]").first();
  await row
    .getByLabel("Programming · Core concepts start", { exact: true })
    .fill(`${date}T10:00`);
  await row
    .getByLabel("Programming · Core concepts end", { exact: true })
    .fill(`${date}T11:00`);
  await row
    .getByRole("button", { name: "Accept session", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "overlaps",
  );
  expect(await readWorkspace(page)).toEqual(beforeReject);
  await row
    .getByLabel("Programming · Core concepts start", { exact: true })
    .fill(`${date}T07:00`);
  await row
    .getByLabel("Programming · Core concepts end", { exact: true })
    .fill(`${date}T07:50`);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "state") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Simulated quota failure", "QuotaExceededError");
      }
      return original.call(this, value, key);
    };
  });
  await row
    .getByRole("button", { name: "Accept session", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Simulated quota failure",
  );
  expect(await readWorkspace(page)).toEqual(beforeReject);
  await row
    .getByRole("button", { name: "Accept session", exact: true })
    .evaluate((node) => {
      (node as HTMLButtonElement).click();
      (node as HTMLButtonElement).click();
    });
  await expect(
    row.getByText("Accepted and saved", { exact: true }),
  ).toBeVisible();
  const saved = await readWorkspace(page);
  expect(
    saved.activities.filter(
      (a: { category: string }) => a.category === "study",
    ),
  ).toHaveLength(1);
  expect(saved.activities).toHaveLength(2);
  expect(saved.acceptedSuggestionIds).toHaveLength(2);
  await page
    .getByRole("button", { name: "View calendar", exact: true })
    .click();
  await expect(
    page
      .locator(".fc-event")
      .filter({ hasText: "Programming · Core concepts" }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page
      .locator(".fc-event")
      .filter({ hasText: "Programming · Core concepts" }),
  ).toHaveCount(1);
  expect(await readWorkspace(page)).toEqual(saved);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.install({ time: frozenNow });
  await reopened.goto(`${baseURL}#calendar`);
  await expect(
    reopened
      .locator(".fc-event")
      .filter({ hasText: "Programming · Core concepts" }),
  ).toHaveCount(1);
  expect(await readWorkspace(reopened)).toEqual(saved);
});

test("blocked time and malformed planning inputs explain why no study can be generated", async ({
  page,
  baseURL,
}) => {
  await openFixture(page, baseURL!, (raw) => {
    raw.activities = [
      {
        id: "all-day",
        title: "All day shift",
        start: "2026-11-02T06:00:00.000Z",
        end: "2026-11-02T22:00:00.000Z",
        category: "personal",
        color: "#4b886d",
        description: "",
        fixed: true,
        completed: false,
        completedMinutes: 0,
      },
    ];
  });
  await addPeriod(page);
  await generateOneDay(page);
  await expect(
    page.getByRole("heading", {
      name: "No study sessions could be generated",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "all available hours are blocked by All day shift",
  );
  await expect(
    page.getByRole("button", { name: "Accept plan", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Plan start date", { exact: true }).fill("");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Generate Study Plan", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Choose a valid planning start date",
  );
});

test("generating, closing, and rejecting never approve sessions implicitly", async ({
  page,
  baseURL,
}) => {
  await openFixture(page, baseURL!);
  await addPeriod(page);
  const before = await readWorkspace(page);
  await page
    .getByRole("button", { name: "Generate Study Plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept session", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(await readWorkspace(page)).toEqual(before);
  await page.reload();
  expect(await readWorkspace(page)).toEqual(before);
});
