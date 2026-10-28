import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emptyState, stateSchema, type AppState } from "./model";

const DB_NAME = "daylight-private-planner";
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        dbPromise = undefined;
        reject(new Error("Close other Daylight tabs to open the database."));
      };
    });
  return dbPromise;
}
async function read() {
  const db = await database();
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const request = tx.objectStore("workspace").get("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(state: AppState) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(state, "state");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Storage transaction aborted"));
  });
}
type Store = {
  state: AppState;
  update: (fn: (state: AppState) => AppState) => void;
  replace: (state: AppState) => void;
  toast: (message: string) => void;
  saveStatus: "saved" | "saving" | "error";
  retrySave: () => void;
};
const Context = createContext<Store | null>(null);
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("Missing store");
  return store;
}
export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [raw, setRaw] = useState<unknown>();
  const [saveStatus, setSaveStatus] = useState<Store["saveStatus"]>("saved"),
    [message, setMessage] = useState("");
  const pending = useRef(Promise.resolve()),
    revision = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 5000);
  };
  useEffect(() => {
    let live = true;
    read()
      .then((value) => {
        if (!live) return;
        setRaw(value);
        setState(value === undefined ? emptyState() : stateSchema.parse(value));
      })
      .catch((e) => {
        if (live)
          setError(
            `Your local workspace could not be opened. ${e instanceof Error ? e.message : String(e)}`,
          );
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const n = ++revision.current;
    setSaveStatus("saving");
    pending.current = pending.current
      .catch(() => {})
      .then(() => write(state))
      .then(() => {
        if (revision.current === n) setSaveStatus("saved");
      })
      .catch(() => {
        if (revision.current === n) setSaveStatus("error");
      });
  }, [state]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);
  if (error)
    return (
      <div className="recovery">
        <h1>Your workspace needs attention</h1>
        <p>{error}</p>
        <p>
          No data has been overwritten. Enable browser storage and try again.
        </p>
        <button className="btn primary" onClick={() => location.reload()}>
          Try again
        </button>
        {raw !== undefined && (
          <>
            <button
              className="btn"
              onClick={() => downloadJSON(raw, "daylight-recovery.json")}
            >
              Download recovery copy
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (
                  confirm(
                    "Download a recovery copy first. Replace this unreadable local workspace with an empty one?",
                  )
                ) {
                  setError("");
                  setState(emptyState());
                }
              }}
            >
              Start empty
            </button>
          </>
        )}
      </div>
    );
  if (!state)
    return (
      <div className="loading">
        <div className="loader" />
        <p>Making room for your day…</p>
      </div>
    );
  return (
    <Context.Provider
      value={{
        state,
        update: (fn) => setState((current) => fn(current!)),
        replace: (value) => setState(stateSchema.parse(value)),
        toast,
        saveStatus,
        retrySave: () => setState({ ...state }),
      }}
    >
      {saveStatus === "error" && (
        <div className="storage-alert" role="alert">
          Changes are not saved. Storage may be full or blocked.{" "}
          <button
            onClick={() => downloadJSON(state, "daylight-unsaved-backup.json")}
          >
            Export a backup
          </button>
          <button onClick={() => setState({ ...state })}>Retry saving</button>
        </div>
      )}
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </Context.Provider>
  );
}
