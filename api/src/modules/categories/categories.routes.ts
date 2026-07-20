import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { categoriesRepository } from "./categories.repository";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const categories = await categoriesRepository.listForUser(req.userId!);
    res.json({ data: categories });
  }),
);
