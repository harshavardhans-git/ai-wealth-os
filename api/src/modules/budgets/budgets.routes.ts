import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import {
  CreateBudgetSchema,
  IdParamSchema,
  UpdateBudgetSchema,
} from "./budgets.schema";
import { budgetsService } from "./budgets.service";

export const budgetsRouter = Router();

budgetsRouter.use(requireAuth);

budgetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await budgetsService.list(req.userId!) });
  }),
);

budgetsRouter.post(
  "/",
  validate({ body: CreateBudgetSchema }),
  asyncHandler(async (req, res) => {
    const budget = await budgetsService.create(req.userId!, req.body);
    res.status(201).json({ data: budget });
  }),
);

budgetsRouter.patch(
  "/:id",
  validate({ params: IdParamSchema, body: UpdateBudgetSchema }),
  asyncHandler(async (req, res) => {
    const budget = await budgetsService.update(
      req.params.id!,
      req.userId!,
      req.body,
    );
    res.json({ data: budget });
  }),
);

budgetsRouter.delete(
  "/:id",
  validate({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    await budgetsService.remove(req.params.id!, req.userId!);
    res.status(204).send();
  }),
);
