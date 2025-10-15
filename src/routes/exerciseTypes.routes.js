import { Router } from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import {
  createExerciseType,
  listExerciseTypes,
  getExerciseType,
  updateExerciseType,
  deleteExerciseType
} from "../services/exerciseTypes.service.js";

const router = Router();

/** Crear tipo de ejercicio */
router.post("/", authRequired, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "MISSING_NAME" });

  try {
    const created = await createExerciseType({ name, description });
    res.status(201).json(created);
  } catch (e) {
    // Si tienes UNIQUE en name, puedes capturar ER_DUP_ENTRY (1062)
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NAME_IN_USE" });
    }
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Listar tipos */
router.get("/", async (_req, res) => {
  try {
    const list = await listExerciseTypes();
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Obtener tipo por id */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });

  try {
    const item = await getExerciseType(id);
    if (!item) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Actualizar tipo (parcial) */
router.put("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });
  if (name === undefined && description === undefined) return res.status(400).json({ error: "NO_FIELDS" });

  try {
    const updated = await updateExerciseType(id, { name, description });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NAME_IN_USE" });
    }
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Borrar tipo */
router.delete("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });

  try {
    const ok = await deleteExerciseType(id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    // Si hay ejercicios con ese type_id y FK RESTRICT, MySQL lanzará error (1451)
    if (e && e.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "TYPE_IN_USE" });
    }
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;