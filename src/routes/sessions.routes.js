import { Router } from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import {
  createSession,
  listSessions,
  getSession,
  addExerciseToSession,
  updateSessionExercise,
  deleteSessionExercise,
  deleteSession,
  updateSession, // ⬅️ nuevo
  sessionTypeExists, // ⬅️ helper opcional
  reorderSessionExercises,
  compactSessionOrder,
  moveSessionExercise,
  reorderSessionExercisesByMap
} from "../services/sessions.service.js";

const router = Router();

/** Crear sesión */
router.post("/", authRequired, async (req, res) => {
  const { title, notes, type_id, restTime } = req.body || {};
  if (!title) return res.status(400).json({ error: "MISSING_TITLE" });

  try {
    // (Opcional) verificar que el type_id exista si viene informado
    if (type_id !== undefined && type_id !== null) {
      const okType = await sessionTypeExists(type_id);
      if (!okType) return res.status(400).json({ error: "INVALID_TYPE_ID" });
    }

    const s = await createSession({ title, notes, type_id, restTime });
    res.status(201).json(s);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Actualizar sesión (title/notes/type_id) */
router.put("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });

  const { title, notes, type_id,restTime } = req.body || {};
  if ([title, notes, type_id, restTime].every(v => v === undefined)) {
    return res.status(400).json({ error: "NO_FIELDS" });
  }

  try {
    if (type_id !== undefined && type_id !== null) {
      const okType = await sessionTypeExists(type_id);
      if (!okType) return res.status(400).json({ error: "INVALID_TYPE_ID" });
    }

    const updated = await updateSession(id, { title, notes, type_id, restTime });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Listar sesiones (con ejercicios si ?include=exercises) */
router.get("/", async (req, res) => {
  const include = (req.query.include || "").toString().toLowerCase();
  const includeExercises = include === "exercises" || include === "all";
  try {
    const list = await listSessions({ includeExercises });
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Obtener una sesión por id (siempre con ejercicios) */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });
  try {
    const s = await getSession(id);
    if (!s) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(s);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Añadir ejercicio a una sesión */
router.post("/:id/exercises", authRequired, async (req, res) => {
  const session_id = Number(req.params.id);
  const { exercise_id, weight, reps, order_index } = req.body || {};

  if (!Number.isInteger(session_id) || session_id <= 0) return res.status(400).json({ error: "INVALID_SESSION_ID" });

  if (!Number.isInteger(Number(exercise_id))) return res.status(400).json({ error: "INVALID_EXERCISE_ID" });

  if (weight !== undefined && weight !== null && Number.isNaN(Number(weight))) return res.status(400).json({ error: "INVALID_WEIGHT" });

  if (reps !== undefined && reps !== null && !Number.isInteger(Number(reps))) return res.status(400).json({ error: "INVALID_REPS" });

  if (order_index !== undefined && order_index !== null && !Number.isInteger(Number(order_index))) return res.status(400).json({ error: "INVALID_ORDER" });

  try {
    const link = await addExerciseToSession({
      session_id,
      exercise_id: Number(exercise_id),
      weight: weight === undefined ? undefined : Number(weight),
      reps: reps === undefined ? undefined : Number(reps),
      order_index: order_index === undefined ? undefined : Number(order_index),
    });
    res.status(201).json(link);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Actualizar peso/reps/orden de un ejercicio de la sesión */
router.put("/:sessionId/exercises/:sessionExerciseId", authRequired, async (req, res) => {
  const sessionExerciseId = Number(req.params.sessionExerciseId);
  const { weight, reps, order_index } = req.body || {};

  if (!Number.isInteger(sessionExerciseId) || sessionExerciseId <= 0) return res.status(400).json({ error: "INVALID_ID" });

  if (weight !== undefined && weight !== null && Number.isNaN(Number(weight))) return res.status(400).json({ error: "INVALID_WEIGHT" });

  if (reps !== undefined && reps !== null && !Number.isInteger(Number(reps))) return res.status(400).json({ error: "INVALID_REPS" });

  if (order_index !== undefined && order_index !== null && !Number.isInteger(Number(order_index))) return res.status(400).json({ error: "INVALID_ORDER" });

  try {
    const updated = await updateSessionExercise(sessionExerciseId, {
      weight: weight === undefined ? undefined : Number(weight),
      reps: reps === undefined ? undefined : Number(reps),
      order_index: order_index === undefined ? undefined : Number(order_index),
    });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (e) {
    if (e.message === "NO_FIELDS") return res.status(400).json({ error: "NO_FIELDS" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Borrar un ejercicio de la sesión */

router.delete("/:sessionId/exercises/:sessionExerciseId", authRequired, async (req, res) => {
  const sessionExerciseId = Number(req.params.sessionExerciseId);
  if (!Number.isInteger(sessionExerciseId) || sessionExerciseId <= 0) return res.status(400).json({ error: "INVALID_ID" });
  try {
    const ok = await deleteSessionExercise(sessionExerciseId);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Borrar una sesión completa */
router.delete("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });
  try {
    const ok = await deleteSession(id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Reordenar ejercicios de una sesión */
router.put("/:id/exercises/reorder", authRequired, async (req, res) => {
  const session_id = Number(req.params.id);
  if (!Number.isInteger(session_id) || session_id <= 0) return res.status(400).json({ error: "INVALID_SESSION_ID" });

  const { order } = req.body || {};
  try {
    const result = await reorderSessionExercises(session_id, (order || []).map(Number));
    res.json({ session_id, exercises: result });
  } catch (e) {
    if (e.message === "EMPTY_ORDER") return res.status(400).json({ error: "EMPTY_ORDER" });
    if (e.message === "DUPLICATED_IDS") return res.status(400).json({ error: "DUPLICATED_IDS" });
    if (e.message === "MISMATCH_COUNT") return res.status(400).json({ error: "MISMATCH_COUNT" });
    if (e.message === "ID_NOT_IN_SESSION") return res.status(400).json({ error: "ID_NOT_IN_SESSION" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Compactar orden de ejercicios de una sesión (0,1,2,3...) */
router.post("/:id/exercises/compact", authRequired, async (req, res) => {
  const session_id = Number(req.params.id);
  if (!Number.isInteger(session_id) || session_id <= 0) return res.status(400).json({ error: "INVALID_SESSION_ID" });

  try {
    await compactSessionOrder(session_id);
    res.json({ session_id, compacted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Mover un ejercicio a una posición (reordena el resto) */
router.patch("/:sessionId/exercises/:sessionExerciseId/move", authRequired, async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const sessionExerciseId = Number(req.params.sessionExerciseId);
  const { new_index } = req.body || {};

  if (!Number.isInteger(sessionId) || sessionId <= 0)   return res.status(400).json({ error: "INVALID_SESSION_ID" });
  if (!Number.isInteger(sessionExerciseId) || sessionExerciseId <= 0) return res.status(400).json({ error: "INVALID_ID" });
  if (new_index === undefined || new_index === null || Number.isNaN(Number(new_index)))
    return res.status(400).json({ error: "INVALID_NEW_INDEX" });

  try {
    const list = await moveSessionExercise(sessionId, sessionExerciseId, Number(new_index));
    if (!list) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ session_id: sessionId, exercises: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.put('/exercises/reorder-map/:id', authRequired, async (req, res) => {
  console.log("asdkjashd")
  const session_id = Number(req.params.id);

  console.log('[reorder-map] content-type=', req.headers['content-type']);
  console.log('[reorder-map] typeof req.body=', typeof req.body, 'value=', req.body);

  // Acepta: array directo, string JSON o { order: [...] }
  let raw = [];
  if (Array.isArray(req.body)) raw = req.body;
  else if (typeof req.body === 'string') {
    try { raw = JSON.parse(req.body); } catch { raw = []; }
  } else if (req.body && Array.isArray(req.body.order)) raw = req.body.order;

  console.log('[reorder-map] raw parsed=', raw);

  if (!Number.isInteger(session_id) || session_id <= 0) {
    
    return res.status(400).json({ error: 'INVALID_SESSION_ID' });
  }
  if (!raw.length) return res.status(400).json({ error: 'EMPTY_ORDER' });

  // Normaliza y valida elemento a elemento con logs
  const items = [];
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i] || {};
    const idNum = Number(x.id);
    const ordNum = Number(x.order_index);

    console.log(`[reorder-map] item[${i}]`, { id: x.id, order_index: x.order_index, idNum, ordNum });

    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', index: i, received: x.id });
    }
    if (!Number.isInteger(ordNum) || ordNum < 0) {
      return res.status(400).json({ error: 'INVALID_ORDER_INDEX', index: i, received: x.order_index });
    }
    items.push({ id: idNum, order_index: ordNum });
  }

  // Duplicados
  const ids = items.map(it => it.id);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'DUPLICATED_IDS' });
  }

  try {
    const updated = await reorderSessionExercisesByMap(session_id, items);
    return res.json({ session_id, exercises: updated });
  } catch (e) {
    if (e && e.message === 'ID_NOT_IN_SESSION') {
      return res.status(400).json({ error: 'ID_NOT_IN_SESSION' });
    }
    console.error('[reorder-map] ERROR', e && e.stack || e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});



export default router;
