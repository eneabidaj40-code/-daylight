import { describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  DATABASE_NAME,
  LEGACY_BACKUP_KEY,
  WorkspaceRepository,
} from "./persistence";
import { acceptProposal } from "./proposals";
import { generatePlan } from "./schedule";
import { migrateWorkspace } from "./persistence";
import { emptyState } from "./model";
import { date, now, fixture, legacyFixture } from "./test/fixtures";

async function seed(factory: IDBFactory, raw: unknown) {
  await new Promise<void>((resolve, reject) => {
    const open = factory.open(DATABASE_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("workspace");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put(raw, "state");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
describe("backward compatible durable IndexedDB", () => {
  it("rolls back a migration if writing its original-data backup hits quota", async () => {
    const factory = new IDBFactory(),
      raw = legacyFixture();
    await seed(factory, raw);
    const repository = new WorkspaceRepository(factory);
    const original = IDBObjectStore.prototype.put;
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        if (key === LEGACY_BACKUP_KEY)
          throw new DOMException(
            "Migration backup quota fixture",
            "QuotaExceededError",
          );
        return original.call(this, value, key);
      });
    try {
      await expect(repository.load()).rejects.toThrow("Migration backup quota");
    } finally {
      failure.mockRestore();
    }
    expect(await repository.readRaw()).toEqual(raw);
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toBeUndefined();
    expect((await repository.load()).version).toBe(2);
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toEqual(raw);
    await repository.close();
  });
  it("migrates v1 in the same database and backs up all original records exactly once", async () => {
    const factory = new IDBFactory(),
      raw = legacyFixture();
    await seed(factory, raw);
    const repository = new WorkspaceRepository(factory);
    const migrated = await repository.load();
    expect(migrated.version).toBe(2);
    expect(migrated.settings.suspendClassesDuringExamPeriods).toBe(true);
    expect(migrated.examPeriods).toEqual([]);
    expect(migrated.commuteRules).toEqual([]);
    expect(migrated.acceptedSuggestionIds).toEqual([]);
    for (const key of [
      "subjects",
      "exams",
      "classes",
      "activities",
      "workouts",
      "completions",
      "previousSemesters",
      "rejectedDays",
    ] as const)
      expect(migrated[key]).toEqual(raw[key]);
    expect(migrated.settings).toEqual({
      ...raw.settings,
      suspendClassesDuringExamPeriods: true,
    });
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toEqual(raw);
    expect(await repository.load()).toEqual(migrated);
    await repository.transact((s) => ({
      ...s,
      settings: { ...s.settings, name: "Personal" },
    }));
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toEqual(raw);
    await repository.close();
    const reopened = new WorkspaceRepository(factory);
    expect((await reopened.load()).settings.name).toBe("Personal");
    await reopened.close();
  });
  it("loads v1 JSON backups and v2 without dropping user settings", () => {
    expect(migrateWorkspace(legacyFixture()).version).toBe(2);
    const s = fixture();
    s.settings.suspendClassesDuringExamPeriods = false;
    expect(migrateWorkspace(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("preserves unsupported or corrupt state rather than resetting it", async () => {
    const factory = new IDBFactory(),
      raw = { ...legacyFixture(), version: 99 };
    await seed(factory, raw);
    const repository = new WorkspaceRepository(factory);
    await expect(repository.load()).rejects.toThrow();
    expect(await repository.readRaw()).toEqual(raw);
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toBeUndefined();
    await repository.close();
  });
  it("aborts a failed migration/mutation atomically and permits retry", async () => {
    const factory = new IDBFactory(),
      raw = legacyFixture();
    await seed(factory, raw);
    const repository = new WorkspaceRepository(factory);
    await expect(
      repository.transact(() => {
        throw new Error("Storage failure fixture");
      }),
    ).rejects.toThrow("Storage failure");
    expect(await repository.readRaw()).toEqual(raw);
    expect(await repository.readRaw(LEGACY_BACKUP_KEY)).toBeUndefined();
    expect((await repository.load()).version).toBe(2);
    await repository.close();
  });
  it("saves accepted sessions and receipts across page/PWA repository restarts", async () => {
    const factory = new IDBFactory(),
      s = fixture();
    s.classes = [];
    s.exams = [];
    const repository = new WorkspaceRepository(factory);
    await repository.transact(() => s);
    const plan = generatePlan(s, date, 1, now);
    await repository.transact((current) =>
      acceptProposal(current, plan, [plan.activities[0].id], now),
    );
    await repository.close();
    const restarted = new WorkspaceRepository(factory),
      loaded = await restarted.load();
    expect(loaded.activities).toHaveLength(1);
    expect(loaded.acceptedSuggestionIds).toHaveLength(1);
    expect(
      (
        await restarted.transact((current) =>
          acceptProposal(current, plan, [plan.activities[0].id], now),
        )
      ).activities,
    ).toHaveLength(1);
    await restarted.close();
  });
  it("serializes simultaneous repeated clicks and independent tabs without duplicates", async () => {
    const factory = new IDBFactory(),
      s = fixture();
    s.classes = [];
    s.exams = [];
    const a = new WorkspaceRepository(factory),
      b = new WorkspaceRepository(factory);
    await a.transact(() => s);
    const plan = generatePlan(s, date, 1, now);
    await Promise.all([
      a.transact((current) => acceptProposal(current, plan, undefined, now)),
      b.transact((current) => acceptProposal(current, plan, undefined, now)),
      a.transact((current) => acceptProposal(current, plan, undefined, now)),
    ]);
    const saved = await b.load();
    expect(saved.activities).toHaveLength(plan.activities.length);
    expect(new Set(saved.activities.map((x) => x.id)).size).toBe(
      saved.activities.length,
    );
    await a.close();
    await b.close();
  });
  it("rolls back validation failures without saving partial activities or receipts", async () => {
    const factory = new IDBFactory(),
      s = fixture();
    s.classes = [];
    s.exams = [];
    const repository = new WorkspaceRepository(factory);
    await repository.transact(() => s);
    const plan = generatePlan(s, date, 1, now);
    await repository.transact((current) => ({
      ...current,
      activities: [{ ...plan.activities[0], id: "intervening" }],
    }));
    const before = await repository.load();
    await expect(
      repository.transact((current) =>
        acceptProposal(current, plan, undefined, now),
      ),
    ).rejects.toThrow("overlaps");
    expect(await repository.load()).toEqual(before);
    expect(before.acceptedSuggestionIds).toEqual([]);
    await repository.close();
  });
  it("starts an actually new database empty, never with sample records", async () => {
    const repository = new WorkspaceRepository(new IDBFactory());
    expect(await repository.load()).toEqual(emptyState());
    await repository.close();
  });
  it("reports an old tab blocking upgrade without replacing the v1 records", async () => {
    const factory = new IDBFactory(),
      raw = legacyFixture();
    await seed(factory, raw);
    const old = await new Promise<IDBDatabase>((resolve) => {
      const r = factory.open(DATABASE_NAME, 1);
      r.onsuccess = () => resolve(r.result);
    });
    const repository = new WorkspaceRepository(factory);
    await expect(repository.load()).rejects.toThrow(
      "Close other Daylight tabs",
    );
    const original = await new Promise((resolve) => {
      const r = old
        .transaction("workspace")
        .objectStore("workspace")
        .get("state");
      r.onsuccess = () => resolve(r.result);
    });
    expect(original).toEqual(raw);
    old.close();
  });
});
