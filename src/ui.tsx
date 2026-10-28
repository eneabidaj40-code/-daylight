import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Plus, X, type LucideIcon } from "lucide-react";

export function Button({
  children,
  icon: Icon,
  variant = "",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  variant?: string;
}) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} strokeWidth={1.8} />}
      {children}
    </button>
  );
}
export function IconButton({
  icon: Icon,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button className="icon-btn" title={label} aria-label={label} {...props}>
      <Icon size={18} strokeWidth={1.7} />
    </button>
  );
}
export function Field({
  label,
  children,
  help,
  className = "",
}: {
  label: string;
  children: ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  close,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    node?.querySelector<HTMLElement>("input, select, button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const elements = Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={close} />
        </header>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <Button icon={Plus} onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
export function Progress({
  value,
  color,
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label ?? "Progress"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function CardHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-btn" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon: Icon,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
export function FormError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
