import type { ReactNode } from "react";

/**
 * Table primitives (Ch 11 §11.3).
 *
 * A real `<table>`, not a styled list. The transactions ledger is the densest
 * tabular data in the app, and rendering it as `<ul><li>` cost screen-reader
 * users every row/column relationship — they heard a run-on sentence per row
 * instead of "Date: 4 July, Amount: −₹250". Semantics here are not decoration.
 *
 * The wrapper scrolls horizontally on its own so a wide table never forces the
 * whole page sideways on a phone.
 */
export function Table({
  children,
  caption,
}: {
  children: ReactNode;
  /** Describes the table to assistive tech; visually hidden. */
  caption: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-5 py-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}
