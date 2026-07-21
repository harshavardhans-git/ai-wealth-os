import type { ParsedTransactionDraft } from "@wealth-os/types";
import { AppError } from "../../lib/app-error";
import { toMinor } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { parseTransactionText } from "./capture.parser";

const MAX_INPUT_LENGTH = 200;

/**
 * Natural-language capture (A1).
 *
 * The Ch 9 guardrails hold even though the parser is deterministic rather than a
 * model — because they were never really about the model:
 *
 *  1. PROPOSE, NEVER PERSIST. This returns a draft. Saving is a separate,
 *     explicit call the user makes after confirming, so a wrong parse is a
 *     one-tap edit rather than corrupted data.
 *  2. RE-AUTHORIZE EVERY ID. Ids are re-checked against this user's own rows
 *     before they leave the service. Defence in depth: today the parser can only
 *     return ids we handed it, but the day an LLM sits here instead, this check
 *     is what stops a hallucinated or foreign id reaching the database.
 *  3. BOUND THE INPUT. Long input is rejected, not truncated.
 *  4. LOG THE ATTEMPT. Input, output and confidence are recorded so the feature's
 *     real accuracy is measurable rather than assumed.
 */
export const captureService = {
  async parse(userId: string, input: string): Promise<ParsedTransactionDraft> {
    const text = input.trim();

    if (!text) throw AppError.validation("Say what you spent");
    if (text.length > MAX_INPUT_LENGTH) {
      throw AppError.validation(
        `Keep it under ${MAX_INPUT_LENGTH} characters — try "coffee 250 yesterday"`,
      );
    }

    const [user, categories, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { baseCurrency: true },
      }),
      prisma.category.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        select: { id: true, name: true, kind: true },
      }),
      prisma.account.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true, type: true, currency: true },
      }),
    ]);

    if (!user) throw AppError.unauthorized();

    const draft = parseTransactionText(text, {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind as "income" | "expense",
      })),
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      today: new Date(),
    });

    if (!draft) {
      throw AppError.validation(
        'No amount found — try something like "coffee 250 yesterday"',
      );
    }

    // Guardrail 2: nothing leaves here that isn't demonstrably the user's.
    const ownedCategory = draft.categoryId
      ? categories.find((c) => c.id === draft.categoryId)
      : null;
    const ownedAccount = draft.accountId
      ? accounts.find((a) => a.id === draft.accountId)
      : null;

    const account = ownedAccount ?? accounts[0] ?? null;
    const amountMinor = toMinor(draft.amountMajor);

    const result: ParsedTransactionDraft = {
      type: draft.type,
      amountMinor,
      currency: account?.currency ?? user.baseCurrency,
      categoryId: ownedCategory?.id ?? null,
      accountId: account?.id ?? null,
      occurredAt: draft.occurredAt,
      note: draft.note,
      confidence: draft.confidence,
      matched: draft.matched,
    };

    // Guardrail 4: measure the wedge instead of assuming it works.
    await prisma.captureLog.create({
      data: {
        userId,
        inputText: text,
        parsedJson: result as unknown as object,
        parser: "rule-based-v1",
        confidence: draft.confidence,
        accepted: null, // set when the user saves the draft
      },
    });

    return result;
  },

  /**
   * Records that a draft was actually saved — the acceptance-rate metric — and
   * stamps the resulting row's provenance.
   *
   * `source` is set HERE rather than accepted in the create payload: provenance
   * is a fact about how a row came to exist, so only the server should be able to
   * assert it. The update is scoped by userId, so it can never reach another
   * user's transaction even with a valid-looking id.
   */
  async markAccepted(
    userId: string,
    inputText: string,
    transactionId: string,
  ): Promise<void> {
    const latest = await prisma.captureLog.findFirst({
      where: { userId, inputText },
      orderBy: { createdAt: "desc" },
    });

    await prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.captureLog.update({
          where: { id: latest.id },
          data: { accepted: true },
        });
      }

      await tx.transaction.updateMany({
        where: { id: transactionId, userId, deletedAt: null },
        data: { source: "capture" },
      });
    });
  },
};
