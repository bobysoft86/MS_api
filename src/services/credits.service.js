import { pool } from "../db.js";

/** Leer saldo actual (cache en users) */
export async function getUserCreditBalance(userId) {
  const [[row]] = await pool.query(
    "SELECT credit_balance FROM users WHERE id = ?",
    [userId]
  );
  return row ? Number(row.credit_balance) : null;
}

/** Listar movimientos (paginado) */
export async function listUserCreditTransactions(userId, { limit = 50, offset = 0 } = {}) {
  limit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  offset = Math.max(Number(offset) || 0, 0);

  const [rows] = await pool.query(
    `SELECT id, delta, reason, reference_type, reference_id, created_by, metadata, created_at
       FROM credit_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const [[{ total } = { total: 0 }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM credit_transactions WHERE user_id = ?",
    [userId]
  );

  return { items: rows, total, limit, offset };
}


export async function adjustUserCredits({
  actorUserId,
  targetUserId,
  delta,
  reason,
  reference_type,
  reference_id,
  metadata,
  allowNegative = false
}) {
  if (!Number.isInteger(delta) || delta === 0) {
    const err = new Error("INVALID_DELTA");
    err.code = "INVALID_DELTA";
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Bloquea la fila del usuario para evitar carreras
    const [[user]] = await conn.query(
      "SELECT id, credit_balance FROM users WHERE id = ? FOR UPDATE",
      [targetUserId]
    );
    if (!user) {
      const err = new Error("USER_NOT_FOUND");
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    const current = Number(user.credit_balance);
    const next = current + delta;

    if (!allowNegative && next < 0) {
      const err = new Error("INSUFFICIENT_CREDITS");
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }

    // Inserta movimiento
    const [txRes] = await conn.query(
      `INSERT INTO credit_transactions
         (user_id, delta, reason, reference_type, reference_id, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        delta,
        reason || "admin_adjust",
        reference_type || null,
        reference_id || null,
        actorUserId || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    // Actualiza saldo cacheado
    await conn.query(
      "UPDATE users SET credit_balance = ? WHERE id = ?",
      [next, targetUserId]
    );

    await conn.commit();

    return { balance: next, txId: txRes.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}