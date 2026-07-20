import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import { captureService } from "./capture.service";

const ParseSchema = z.object({ text: z.string().min(1).max(200) });
const AcceptSchema = z.object({ text: z.string().min(1).max(200) });

export const captureRouter = Router();

captureRouter.use(requireAuth);

// Even a free parser gets a limiter: it guards CPU, and the day an LLM sits
// behind this route the limiter is already the thing guarding spend (Ch 9).
captureRouter.use(
  rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }),
);

captureRouter.post(
  "/parse",
  validate({ body: ParseSchema }),
  asyncHandler(async (req, res) => {
    const draft = await captureService.parse(req.userId!, req.body.text);
    res.json({ data: draft });
  }),
);

captureRouter.post(
  "/accepted",
  validate({ body: AcceptSchema }),
  asyncHandler(async (req, res) => {
    await captureService.markAccepted(req.userId!, req.body.text);
    res.status(204).send();
  }),
);
