"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ParsedTransactionDraft, Transaction } from "@wealth-os/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyText } from "@/components/patterns/money-text";
import { apiFetch } from "@/lib/api-client";
import { useAccounts, useCategories } from "@/hooks/use-finance";

/** Below this, we don't pretend it's a confident draft — we open the plain form. */
const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Quick Capture — the flagship interaction (Ch 4 §4.2).
 *
 * Deliberately a GLOBAL overlay rather than a page: the headline feature should
 * never be more than one keystroke away from any screen. Burying it inside a
 * page would bury the differentiator.
 *
 * The parse NEVER saves. It produces an editable draft the user confirms, which
 * is what makes a wrong parse a one-tap fix instead of bad data (Ch 9 §9.2).
 */
export function QuickCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ParsedTransactionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();
  const accounts = useAccounts(isOpen);
  const categories = useCategories(isOpen);

  // ⌘K / Ctrl-K from anywhere; Esc closes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      // Guarded on isOpen: an unconditional Esc handler also ran while the
      // dialog was CLOSED, and close() calls returnFocusRef.current?.focus() —
      // so pressing Esc anywhere in the app yanked focus to whatever element
      // last opened the overlay.
      if (event.key === "Escape" && isOpen) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Remember where focus came from so we can put it back on close —
      // without this, closing the dialog dumps a keyboard user at the top of
      // the document with no idea where they are.
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    }
  }, [isOpen]);

  /** Keeps Tab inside the dialog while it's open (a modal must not leak focus). */
  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || !dialogRef.current) return;

    // `:not([disabled])` matters: the Save button is disabled until a draft
    // exists, and without this Tab parked on a control that does nothing.
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
          ' textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null); // skip anything hidden
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

  function close() {
    setIsOpen(false);
    setText("");
    setDraft(null);
    setError(null);
    returnFocusRef.current?.focus();
  }

  async function handleParse(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);

    try {
      const parsed = await apiFetch<ParsedTransactionDraft>("/capture/parse", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setDraft(parsed);
    } catch (caught) {
      // The fallback path: a failed parse opens an empty draft rather than a
      // dead end, so the feature can never hard-fail (Ch 9 §9.6).
      setError(caught instanceof Error ? caught.message : "Could not read that");
      setDraft({
        type: "expense",
        amountMinor: 0,
        currency: "INR",
        categoryId: null,
        accountId: accounts.data?.[0]?.id ?? null,
        occurredAt: new Date().toISOString(),
        note: text,
        confidence: 0,
        matched: { amount: false, date: false, category: false, account: false },
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave() {
    if (!draft?.accountId || draft.amountMinor <= 0) {
      setError("Pick an account and an amount above zero");
      return;
    }

    setIsBusy(true);
    try {
      const created = await apiFetch<Transaction>("/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: draft.accountId,
          type: draft.type,
          amount: (draft.amountMinor / 100).toFixed(2),
          categoryId: draft.categoryId,
          occurredAt: draft.occurredAt,
          note: draft.note,
        }),
      });

      // Records that this parse was good enough to keep — and stamps the row's
      // provenance server-side. `source` is deliberately NOT sent above: a
      // client that can name its own source can lie about how a row was made.
      // Fire-and-forget, because a failed metric must not fail a saved expense.
      apiFetch("/capture/accepted", {
        method: "POST",
        body: JSON.stringify({ text, transactionId: created.id }),
      }).catch(() => {});

      queryClient.invalidateQueries();
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setIsBusy(false);
    }
  }

  const visibleCategories = (categories.data ?? []).filter(
    (category) => category.kind === draft?.type,
  );
  const isLowConfidence = draft !== null && draft.confidence < CONFIDENCE_THRESHOLD;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--primary-contrast)] shadow-lg sm:bottom-auto sm:right-6 sm:top-5 sm:py-2"
      >
        ＋ Capture
        <kbd className="ml-2 hidden text-xs opacity-70 sm:inline">⌘K</kbd>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick capture"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div
            ref={dialogRef}
            onKeyDown={trapFocus}
            className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
          >
            <form onSubmit={handleParse}>
              <label htmlFor="capture-input" className="text-sm font-medium">
                Type what you spent
              </label>
              <Input
                id="capture-input"
                ref={inputRef}
                className="mt-2"
                placeholder="coffee 250 yesterday with card"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setDraft(null);
                }}
              />
              {!draft && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--text-muted)]">
                    Try &ldquo;swiggy 480 yesterday&rdquo; or &ldquo;salary 85000&rdquo;
                  </p>
                  <Button type="submit" disabled={isBusy || !text.trim()}>
                    {isBusy ? "Reading…" : "Read it ↵"}
                  </Button>
                </div>
              )}
            </form>

            {draft && (
              <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--text-muted)]">
                    {isLowConfidence
                      ? "Couldn't read much — fill it in below"
                      : "Here's what I understood"}
                  </p>
                  <span
                    className="text-xs text-[var(--text-muted)]"
                    title={`Confidence ${Math.round(draft.confidence * 100)}%`}
                  >
                    {["amount", "date", "category", "account"]
                      .map((key) =>
                        draft.matched[key as keyof typeof draft.matched] ? "●" : "○",
                      )
                      .join(" ")}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount" htmlFor="cap-amount">
                    <Input
                      id="cap-amount"
                      inputMode="decimal"
                      value={(draft.amountMinor / 100).toFixed(2)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          amountMinor: Math.round(
                            (Number(event.target.value) || 0) * 100,
                          ),
                        })
                      }
                    />
                  </Field>

                  <Field label="Type" htmlFor="cap-type">
                    <Select
                      id="cap-type"
                      value={draft.type}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          type: event.target.value as "income" | "expense",
                          categoryId: null,
                        })
                      }
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </Select>
                  </Field>

                  <Field label="Category" htmlFor="cap-category">
                    <Select
                      id="cap-category"
                      value={draft.categoryId ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, categoryId: event.target.value || null })
                      }
                    >
                      <option value="">Uncategorized</option>
                      {visibleCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Account" htmlFor="cap-account">
                    <Select
                      id="cap-account"
                      value={draft.accountId ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, accountId: event.target.value || null })
                      }
                    >
                      {(accounts.data ?? []).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Date" htmlFor="cap-date">
                    <Input
                      id="cap-date"
                      type="date"
                      value={draft.occurredAt.slice(0, 10)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          occurredAt: new Date(event.target.value).toISOString(),
                        })
                      }
                    />
                  </Field>

                  <div className="flex items-end">
                    <p className="text-sm">
                      <MoneyText
                        amountMinor={draft.amountMinor}
                        currency={draft.currency}
                        type={draft.type}
                      />
                    </p>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-[var(--negative)]">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={close}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isBusy}>
                    {isBusy ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
