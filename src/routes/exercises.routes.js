import { Router } from "express";
import { authRequired, requireRole } from "../middlewares/auth.middleware.js";
import { uploadExerciseMedia, fileToPaths, multerErrorHandler } from "../middlewares/upload.middleware.js";import {
  listExercises,
  deleteExercise,  
  getExercise,
  createExerciseWithFiles,
  updateExerciseWithFiles

} from "../services/exercises.service.js";

const router = Router();


/** Listar ejercicios */
router.get("/", async (_req, res) => {
  try {
    const rows = await listExercises();
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** Detalle de ejercicio */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });
  try {
    const row = await getExercise(id);
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(row);
  } catch (e) {
    console.error(e); res.status(500).json({ error: "SERVER_ERROR" });
  }
});



/** Crear ejercicio (multipart) */
router.post("/", authRequired, requireRole("admin"), uploadExerciseMedia, async (req, res) => {
  try {
    const { title, type_id } = req.body || {};
    if (!title) return res.status(400).json({ error: "MISSING_TITLE" });

    const imgFile = req.files?.image?.[0];
    const vidFile = req.files?.video?.[0];

    const { rel: imgRel, url: imgUrl } = fileToPaths(imgFile);
    const { rel: vidRel, url: vidUrl } = fileToPaths(vidFile);

    const row = await createExerciseWithFiles({
      title,
      type_id: type_id == null ? null : Number(type_id),
      imgRel, imgUrl,
      vidRel, vidUrl
    });
    res.status(201).json(row);
  } catch (e) {
    if (e.message === "UNSUPPORTED_MIME") return res.status(400).json({ error: "UNSUPPORTED_MIME" });
    console.error(e); res.status(500).json({ error: "SERVER_ERROR" });
  }
});
// routes/exercises.routes.js

/** Editar ejercicio (multipart; reemplaza imagen/video si envías nuevos) */
router.put("/:id",
  authRequired,
  requireRole("admin"),
  uploadExerciseMedia,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });

    try {
      const { title, type_id } = req.body || {};
      const imgFile = req.files?.image?.[0];
      const vidFile = req.files?.video?.[0];

      const updates = {};
      if (title !== undefined)   updates.title   = title;
      if (type_id !== undefined) updates.type_id = (type_id == null ? null : Number(type_id));

      if (imgFile) {
        const { url } = fileToPaths(imgFile);
        updates.imgUrl = url;     // ← el service espera imgUrl
      }
      if (vidFile) {
        const { url } = fileToPaths(vidFile);
        updates.vidUrl = url;     // ← el service usa vidUrl para mapear a videoUrl en SQL
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "NO_FIELDS" });
      }

      const updated = await updateExerciseWithFiles(id, updates);
      if (!updated) return res.status(404).json({ error: "NOT_FOUND" });

      res.json(updated);
    } catch (e) {
      if (e.message === "UNSUPPORTED_MIME") {
        return res.status(400).json({ error: "UNSUPPORTED_MIME" });
      }
      console.error(e);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);


/** Borrar ejercicio (borra ficheros locales asociados) */
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID" });
  try {
    const ok = await deleteExercise(id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;