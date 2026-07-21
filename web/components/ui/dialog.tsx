"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal dialog (Ch 11 §11.3).
 *
 * EXTRACTED from QuickCapture rather than invented: that component had already
 * grown a focus trap, focus restoration and an Esc handler, and the moment a
 * second modal appeared that logic would have been copied — and the copy would
 * have drifted. Accessibility bugs are exactly the kind that survive a copy.
 *
 * What this guarantees, which hand-rolled overlays usually miss:
 *  - focus moves in on open and returns to the opener on close
 *  - Tab cannot escape while open, and skips disabled/hidden controls
 *  - Esc closes, but only while open
 *  - the background is inert to assistive tech, not merely visually covered
 *  - the scrim is a token, so it adapts to the theme
 */
export function Dialog({
  isOpen,
  onClose,
  label,
  children,
  className = "max-w-lg",
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Announced to screen readers — what this dialog is for. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember where focus came from — without this, closing dumps a keyboard
    // user at the top of the document with no idea where they were.
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    firstField?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /** Keeps Tab inside the panel — a modal that leaks focus is not modal. */
  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
          ' textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-24"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        onKeyDown={trapFocus}
        className={`w-full ${className} max-h-[80vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]`}
      >
        {children}
      </div>
    </div>
  );
}
