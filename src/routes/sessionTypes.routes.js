import { Router } from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import {
  createSessionType,
  listSessionTypes,
  getSessionType,
  updateSessionType,
  deleteSessionType,
} from "../services/sessionTypes.service.js";

const router = Router();

/** Crear nuevo tipo de sesión */
router.post("/", authRequired, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "MISSING_NAME" });

  try {
    const newType = await createSessionType({ name, description });
    res.status(201).json(newType);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Listar todos los tipos */
router.get("/", async (_req, res) => {
  try {
    const types = await listSessionTypes();
    res.json(types);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Obtener un tipo por ID */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  try {
    const type = await getSessionType(id);
    if (!type) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(type);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Actualizar tipo de sesión */
router.put("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  const { name, description } = req.body || {};
  if (!name && !description)
    return res.status(400).json({ error: "NO_FIELDS" });

  try {
    const updated = await updateSessionType(id, { name, description });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Eliminar tipo de sesión */
router.delete("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  try {
    const ok = await deleteSessionType(id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;