import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import {
  CreateCategorySchema,
  IdParamSchema,
  UpdateCategorySchema,
} from "./categories.schema";
import { categoriesService } from "./categories.service";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await categoriesService.list(req.userId!) });
  }),
);

categoriesRouter.post(
  "/",
  validate({ body: CreateCategorySchema }),
  asyncHandler(async (req, res) => {
    const category = await categoriesService.create(req.userId!, req.body);
    res.status(201).json({ data: category });
  }),
);

categoriesRouter.patch(
  "/:id",
  validate({ params: IdParamSchema, body: UpdateCategorySchema }),
  asyncHandler(async (req, res) => {
    const category = await categoriesService.update(
      req.params.id!,
      req.userId!,
      req.body,
    );
    res.json({ data: category });
  }),
);

categoriesRouter.delete(
  "/:id",
  validate({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    await categoriesService.remove(req.params.id!, req.userId!);
    res.status(204).send();
  }),
);
