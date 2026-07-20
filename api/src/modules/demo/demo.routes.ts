import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { demoService } from "./demo.service";

export const demoRouter = Router();

demoRouter.use(requireAuth);

demoRouter.post(
  "/seed",
  asyncHandler(async (req, res) => {
    const result = await demoService.seedForUser(req.userId!);
    res.status(201).json({ data: result });
  }),
);
