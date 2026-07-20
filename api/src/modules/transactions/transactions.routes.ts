import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import {
  BatchIdParamSchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  IdParamSchema,
  ImportTransactionsSchema,
  ListTransactionsQuerySchema,
  UpdateTransactionSchema,
} from "./transactions.schema";
import { transactionsService } from "./transactions.service";

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

transactionsRouter.get(
  "/",
  validate({ query: ListTransactionsQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await transactionsService.list(
      req.userId!,
      req.query as never,
    );
    res.json({ data: result });
  }),
);

transactionsRouter.post(
  "/",
  validate({ body: CreateTransactionSchema }),
  asyncHandler(async (req, res) => {
    const transaction = await transactionsService.create(req.userId!, req.body);
    res.status(201).json({ data: transaction });
  }),
);

transactionsRouter.post(
  "/transfer",
  validate({ body: CreateTransferSchema }),
  asyncHandler(async (req, res) => {
    const legs = await transactionsService.createTransfer(req.userId!, req.body);
    res.status(201).json({ data: legs });
  }),
);

// Registered BEFORE the "/:id" routes so "import" is never captured as an id.
transactionsRouter.post(
  "/import",
  validate({ body: ImportTransactionsSchema }),
  asyncHandler(async (req, res) => {
    const result = await transactionsService.importTransactions(
      req.userId!,
      req.body,
    );
    res.status(201).json({ data: result });
  }),
);

transactionsRouter.post(
  "/import/:batchId/revert",
  validate({ params: BatchIdParamSchema }),
  asyncHandler(async (req, res) => {
    const reverted = await transactionsService.revertImport(
      req.userId!,
      req.params.batchId!,
    );
    res.json({ data: { reverted } });
  }),
);

transactionsRouter.get(
  "/:id",
  validate({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json({ data: await transactionsService.getById(req.params.id!, req.userId!) });
  }),
);

transactionsRouter.patch(
  "/:id",
  validate({ params: IdParamSchema, body: UpdateTransactionSchema }),
  asyncHandler(async (req, res) => {
    const transaction = await transactionsService.update(
      req.params.id!,
      req.userId!,
      req.body,
    );
    res.json({ data: transaction });
  }),
);

transactionsRouter.delete(
  "/:id",
  validate({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    await transactionsService.remove(req.params.id!, req.userId!);
    res.status(204).send();
  }),
);
