"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Button, cx } from "./primitives";

/* ---------- Textarea / Select ---------- */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const textareaId = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={textareaId} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${textareaId}-help` : undefined}
        className={cx(
          "block w-full rounded-lg border bg-surface px-3 py-2 text-sm placeholder:text-muted",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...rest}
      />
      {(hint || error) && (
        <p id={`${textareaId}-help`} className={cx("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
}

export function Select({ label, hideLabel, id, className, children, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className={hideLabel ? "sr-only" : "block text-sm font-medium"}>
        {label}
      </label>
      <select
        id={selectId}
        className={cx("block min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm", className)}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

/* ---------- Modal (formulários) ---------- */

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Janela modal nativa (<dialog>): foco preso, Esc fecha, fundo bloqueado. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(94vw,32rem)] rounded-xl border border-line bg-surface p-0 text-fg backdrop:bg-black/50"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="mb-4 text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Paginação ---------- */

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 pt-2 text-sm">
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Anterior
      </Button>
      <span className="text-muted" aria-live="polite">
        Página {page} de {pages}
      </span>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Próxima
      </Button>
    </nav>
  );
}

/* ---------- Pequenos elementos ---------- */

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "primary" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    warning: "bg-warning-soft text-fg",
    primary: "bg-primary-soft text-fg",
  };
  return <span className={cx("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function SubjectDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
