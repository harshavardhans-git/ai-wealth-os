import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import {
  CreateAccountSchema,
  IdParamSchema,
  UpdateAccountSchema,
} from "./accounts.schema";
import { accountsService } from "./accounts.service";

export const accountsRouter = Router();

accountsRouter.use(requireAuth); // every account route requires a verified user

accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await accountsService.list(req.userId!) });
  }),
);

accountsRouter.post(
  "/",
  validate({ body: CreateAccountSchema }),
  asyncHandler(async (req, res) => {
    const account = await accountsService.create(req.userId!, req.body);
    res.status(201).json({ data: account });
  }),
);

accountsRouter.patch(
  "/:id",
  validate({ params: IdParamSchema, body: UpdateAccountSchema }),
  asyncHandler(async (req, res) => {
    const account = await accountsService.update(
      req.params.id!,
      req.userId!,
      req.body,
    );
    res.json({ data: account });
  }),
);

accountsRouter.delete(
  "/:id",
  validate({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    await accountsService.remove(req.params.id!, req.userId!);
    res.status(204).send();
  }),
);
