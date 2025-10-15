import { Router } from "express";
import { authRequired, requireRole } from "../middlewares/auth.middleware.js";
import {
  getUserCreditBalance,
  listUserCreditTransactions,
  adjustUserCredits
} from "../services/credits.service.js";

const router = Router();

/** GET /users/:id/credits → saldo actual */
router.get("/users/:id/credits", authRequired, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "INVALID_USER_ID" });

  // si no eres admin, solo puedes ver tu propio saldo
  const isAdmin = req.user.role_name === "admin";
  if (!isAdmin && req.user.sub !== userId) return res.status(403).json({ error: "FORBIDDEN" });

  try {
    const balance = await getUserCreditBalance(userId);
    if (balance === null) return res.status(404).json({ error: "USER_NOT_FOUND" });
    res.json({ user_id: userId, credit_balance: balance });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** GET /users/:id/credits/transactions?limit=&offset= → historial */
router.get("/users/:id/credits/transactions", authRequired, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "INVALID_USER_ID" });

  const isAdmin = req.user.role_name === "admin";
  if (!isAdmin && req.user.sub !== userId) return res.status(403).json({ error: "FORBIDDEN" });

  const limit  = req.query.limit;
  const offset = req.query.offset;

  try {
    const result = await listUserCreditTransactions(userId, { limit, offset });
    res.json({ user_id: userId, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * POST /users/:id/credits/adjust
 * Body: { "delta": 5, "reason": "admin_adjust", "reference_type": "manual", "reference_id": 123, "metadata": {...}, "allowNegative": false }
 * Solo admin. Suma o descuenta créditos (delta != 0). Protege saldo negativo salvo que se permita.
 */
router.post("/users/:id/credits/adjust", authRequired, requireRole("admin"), async (req, res) => {
  const targetUserId = Number(req.params.id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).json({ error: "INVALID_USER_ID" });

  const { delta, reason, reference_type, reference_id, metadata, allowNegative } = req.body || {};
  if (!Number.isInteger(Number(delta)) || Number(delta) === 0) return res.status(400).json({ error: "INVALID_DELTA" });

  try {
    const result = await adjustUserCredits({
      actorUserId: req.user.sub,
      targetUserId,
      delta: Number(delta),
      reason,
      reference_type,
      reference_id: reference_id == null ? null : Number(reference_id),
      metadata,
      allowNegative: !!allowNegative
    });

    res.status(201).json({
      user_id: targetUserId,
      new_balance: result.balance,
      transaction_id: result.txId
    });
  } catch (e) {
    if (e.code === "USER_NOT_FOUND")       return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (e.code === "INVALID_DELTA")        return res.status(400).json({ error: "INVALID_DELTA" });
    if (e.code === "INSUFFICIENT_CREDITS") return res.status(409).json({ error: "INSUFFICIENT_CREDITS" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;