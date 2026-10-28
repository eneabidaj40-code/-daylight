import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { stateSchema, type AppState } from "./model";
import { WorkspaceRepository } from "./persistence";

export const workspaceRepository = new WorkspaceRepository();
type Mutation = (state: AppState) => AppState;
type Store = {
  state: AppState;
  update: (fn: Mutation) => void;
  commit: (fn: Mutation) => Promise<AppState>;
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
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState<unknown>();
  const [saveStatus, setSaveStatus] = useState<Store["saveStatus"]>("saved");
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const failed = useRef<Mutation[]>([]);
  const lastFailure = useRef<Mutation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 5000);
  };
  const commit = useCallback((mutate: Mutation): Promise<AppState> => {
    const n = ++revision.current;
    setSaveStatus("saving");
    const operation = pending.current
      .catch(() => {})
      .then(() => workspaceRepository.transact(mutate));
    pending.current = operation;
    return operation.then(
      (saved) => {
        setState(saved);
        failed.current = failed.current.filter((fn) => fn !== mutate);
        if (n === revision.current) {
          if (failed.current.length) setSaveStatus("error");
          else {
            lastFailure.current = null;
            setSaveError("");
            setSaveStatus("saved");
          }
        }
        return saved;
      },
      (cause) => {
        lastFailure.current = mutate;
        setSaveError(cause instanceof Error ? cause.message : String(cause));
        setSaveStatus("error");
        throw cause;
      },
    );
  }, []);
  const update = (fn: Mutation) => {
    void commit(fn).catch(() => {
      if (!failed.current.includes(fn)) failed.current.push(fn);
      setSaveStatus("error");
    });
  };
  const retrySave = () => {
    const retries = failed.current.length
      ? [...failed.current]
      : lastFailure.current
        ? [lastFailure.current]
        : [];
    retries.forEach(update);
  };
  useEffect(() => {
    let live = true;
    workspaceRepository
      .readRaw()
      .then((value) => {
        if (live) setRaw(value);
        return workspaceRepository.load();
      })
      .then((value) => {
        if (live) setState(value);
      })
      .catch((cause) => {
        if (live)
          setError(
            `Your local workspace could not be opened. ${cause instanceof Error ? cause.message : String(cause)}`,
          );
      });
    return () => {
      live = false;
    };
  }, []);
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
        <p role="alert">{error}</p>
        <p>
          Your stored records have been retained. Enable browser storage, close
          old Daylight windows, and try again.
        </p>
        <button className="btn primary" onClick={() => location.reload()}>
          Try again
        </button>
        {raw !== undefined && (
          <button
            className="btn"
            onClick={() => downloadJSON(raw, "daylight-recovery.json")}
          >
            Download recovery copy
          </button>
        )}
      </div>
    );
  if (!state)
    return (
      <div className="loading">
        <div className="loader" />
        <p>Opening your local workspace…</p>
      </div>
    );
  return (
    <Context.Provider
      value={{
        state,
        update,
        commit,
        replace: (value) => update(() => stateSchema.parse(value)),
        toast,
        saveStatus,
        retrySave,
      }}
    >
      {saveStatus === "error" && (
        <div className="storage-alert" role="alert">
          Changes were not saved. {saveError}{" "}
          <button onClick={() => downloadJSON(state, "daylight-backup.json")}>
            Export saved workspace
          </button>
          <button onClick={retrySave}>Retry saving</button>
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
