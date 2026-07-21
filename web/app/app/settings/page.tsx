"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, ErrorState, LoadingState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateProfile,
} from "@/hooks/use-finance";
import { useAuth } from "@/providers/auth-provider";
import { useTheme, type Theme } from "@/providers/theme-provider";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];
const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const categories = useCategories();
  const updateProfile = useUpdateProfile();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState(user?.name ?? "");
  const [currency, setCurrency] = useState(user?.baseCurrency ?? "INR");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [newKind, setNewKind] = useState<"expense" | "income">("expense");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const custom = (categories.data ?? []).filter((category) => !category.isSystem);
  const currencyChanged = currency !== user?.baseCurrency;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setProfileSaved(false);

    try {
      await updateProfile.mutateAsync({ name, baseCurrency: currency });
      setProfileSaved(true);
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    setCategoryError(null);

    try {
      await createCategory.mutateAsync({ name: newCategory, kind: newKind });
      setNewCategory("");
    } catch (caught) {
      setCategoryError(
        caught instanceof Error ? caught.message : "Could not add category",
      );
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your profile, categories and appearance.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Profile</h2>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="set-name">
            <Input
              id="set-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field
            label="Reporting currency"
            htmlFor="set-currency"
            hint="Everything on your dashboard is shown in this currency."
          >
            <Select
              id="set-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>

          {currencyChanged && (
            <p className="text-xs text-[var(--warning)] sm:col-span-2">
              ⚠ Changing this recalculates every past transaction&rsquo;s reported
              value and your budget limits. The original amounts you actually spent
              are not modified.
            </p>
          )}

          {profileError && (
            <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
              {profileError}
            </p>
          )}
          {profileSaved && (
            <p role="status" className="text-sm text-[var(--positive)] sm:col-span-2">
              Saved.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-medium">Appearance</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          &ldquo;System&rdquo; follows your device setting.
        </p>
        <div
          role="radiogroup"
          aria-label="Colour theme"
          className="inline-flex rounded-[var(--radius)] border border-[var(--border)] p-1"
        >
          {THEMES.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors ${
                theme === option.value
                  ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Your categories" />
        <div className="border-b border-[var(--border)] p-5">
          <form onSubmit={addCategory} className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" htmlFor="cat-name">
              <Input
                id="cat-name"
                required
                placeholder="Pet care"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              />
            </Field>
            <Field label="Kind" htmlFor="cat-kind">
              <Select
                id="cat-kind"
                value={newKind}
                onChange={(event) =>
                  setNewKind(event.target.value as "expense" | "income")
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Adding…" : "Add"}
              </Button>
            </div>
            {categoryError && (
              <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-3">
                {categoryError}
              </p>
            )}
          </form>
        </div>

        {categories.isLoading && <LoadingState />}

        {/* Distinct from the empty state below. Rendering "no categories yet"
            when the request actually FAILED tells the user their data is gone
            when it is merely unreachable — the worst lie a finance app can tell. */}
        {categories.isError && (
          <ErrorState message="Could not load your categories. Check your connection and try again." />
        )}

        {!categories.isLoading && !categories.isError && custom.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
            No custom categories yet. The {(categories.data ?? []).length} built-in
            ones are always available.
          </p>
        )}
        {custom.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {custom.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span>
                  {category.name}
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {category.kind}
                  </span>
                </span>
                <Button
                  variant="danger"
                  className="px-0 text-xs"
                  onClick={() => deleteCategory.mutate(category.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
