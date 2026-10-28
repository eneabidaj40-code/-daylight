import { emptyState, stateSchema, type AppState } from "./model";

export const DATABASE_NAME = "daylight-private-planner";
export const DATABASE_VERSION = 2;
export const LEGACY_BACKUP_KEY = "migration-backup-v1";
export const migrateWorkspace = (value: unknown): AppState =>
  stateSchema.parse(value);

/** Same database, workspace store and state key. No delete, clear or reset paths. */
export class WorkspaceRepository {
  private connection?: Promise<IDBDatabase>;
  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  private database(): Promise<IDBDatabase> {
    if (!this.connection)
      this.connection = new Promise((resolve, reject) => {
        const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
        let blocked = false;
        request.onblocked = () => {
          blocked = true;
          this.connection = undefined;
          reject(
            new Error(
              "Close other Daylight tabs or old installed-app windows, then retry. Your data has not been changed.",
            ),
          );
        };
        request.onupgradeneeded = (event) => {
          if (blocked) {
            request.transaction?.abort();
            return;
          }
          if ((event as IDBVersionChangeEvent).oldVersion === 0)
            request.result.createObjectStore("workspace");
          else if (!request.result.objectStoreNames.contains("workspace"))
            request.transaction?.abort();
        };
        request.onsuccess = () => {
          if (blocked) {
            request.result.close();
            return;
          }
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.connection = undefined;
          };
          resolve(db);
        };
        request.onerror = () => {
          this.connection = undefined;
          reject(request.error ?? new Error("IndexedDB could not be opened."));
        };
      });
    return this.connection;
  }

  async readRaw(key = "state"): Promise<unknown> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readonly");
      const request = tx.objectStore("workspace").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("Storage read was interrupted."));
    });
  }

  async load(): Promise<AppState> {
    const raw = await this.readRaw();
    if (raw === undefined || (raw as { version?: number }).version === 1)
      return this.transact((state) => state);
    return migrateWorkspace(raw);
  }

  /** Read/validate/write in ONE transaction; concurrent tabs serialize here. */
  async transact(mutate: (state: AppState) => AppState): Promise<AppState> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      const store = tx.objectStore("workspace");
      const request = store.get("state");
      let result: AppState;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const raw = request.result;
          const state =
            raw === undefined ? emptyState() : migrateWorkspace(raw);
          result = migrateWorkspace(mutate(state));
          if (raw?.version === 1) {
            const backup = store.get(LEGACY_BACKUP_KEY);
            backup.onsuccess = () => {
              try {
                if (backup.result === undefined)
                  store.put(raw, LEGACY_BACKUP_KEY);
              } catch (error) {
                failure = error;
                tx.abort();
              }
            };
          }
          store.put(result, "state");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () =>
        reject(
          failure ?? tx.error ?? new Error("Could not save to IndexedDB."),
        );
      tx.onabort = () =>
        reject(
          failure ??
            tx.error ??
            new Error(
              "Storage transaction was interrupted. No changes were saved.",
            ),
        );
    });
  }

  async close() {
    const db = await this.connection;
    db?.close();
    this.connection = undefined;
  }
}
