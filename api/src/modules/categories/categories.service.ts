import type { Category as CategoryRow } from "@prisma/client";
import type { Category, CategoryKind } from "@wealth-os/types";
import { AppError } from "../../lib/app-error";
import { categoriesRepository } from "./categories.repository";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./categories.schema";

function toDto(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as CategoryKind,
    icon: row.icon,
    color: row.color,
    isSystem: row.isSystem,
  };
}

export const categoriesService = {
  async list(userId: string): Promise<Category[]> {
    return (await categoriesRepository.listForUser(userId)).map(toDto);
  },

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    // Colliding with a system category would produce two identically-named
    // options in every picker — confusing, and the capture parser would have to
    // guess between them.
    const duplicate = await categoriesRepository.findDuplicate(
      userId,
      input.name,
      input.kind,
    );
    if (duplicate) {
      throw AppError.conflict(`A "${input.name}" ${input.kind} category already exists`);
    }

    const category = await categoriesRepository.create({
      userId,
      name: input.name,
      kind: input.kind,
      color: input.color ?? null,
      icon: input.icon ?? null,
      isSystem: false,
    });

    return toDto(category);
  },

  async update(
    id: string,
    userId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    // updateMany scoped to userId means a system category (userId null) or
    // someone else's simply matches nothing → 404, with no special-casing.
    const { count } = await categoriesRepository.updateOwned(id, userId, input);
    if (count === 0) {
      throw AppError.notFound("Category not found, or it's a built-in category");
    }

    const updated = await categoriesRepository.findOwnedById(id, userId);
    if (!updated) throw AppError.notFound("Category not found");
    return toDto(updated);
  },

  async remove(id: string, userId: string): Promise<void> {
    const category = await categoriesRepository.findOwnedById(id, userId);
    if (!category) {
      throw AppError.notFound("Category not found, or it's a built-in category");
    }

    // Refuse rather than orphan. Silently nulling the category on historical
    // transactions would quietly rewrite the user's past.
    const [inUse, budgeted] = await Promise.all([
      categoriesRepository.countUsage(id, userId),
      categoriesRepository.countBudgets(id, userId),
    ]);

    if (inUse > 0) {
      throw AppError.conflict(
        `This category is used by ${inUse} transaction${inUse === 1 ? "" : "s"} — recategorize them first`,
      );
    }
    if (budgeted > 0) {
      throw AppError.conflict("Remove the budget on this category first");
    }

    await categoriesRepository.deleteOwned(id, userId);
  },
};
