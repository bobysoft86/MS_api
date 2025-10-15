import { pool } from "../db.js";

/** (opcional) comprobar existencia del tipo de ejercicio */
export async function exerciseTypeExists(typeId) {
  if (typeId == null) return true; // permitir null
  const [[row]] = await pool.query("SELECT 1 AS ok FROM exercise_types WHERE id = ?", [typeId]);
  return !!row;
}

/** Obtener todos los ejercicios (incluye info del tipo si existe) */
export async function listExercises() {
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.imgUrl, e.videoUrl, e.type_id,
            t.name AS type_name,
            e.created_at
     FROM exercises e
     LEFT JOIN exercise_types t ON t.id = e.type_id
     ORDER BY e.id DESC`
  );
  return rows;
}

/** Crear nuevo ejercicio */
export async function createExercise({ title, imgUrl, videoUrl, type_id }) {
  // (opcional) valida tipo existente
  // const ok = await exerciseTypeExists(type_id);
  // if (!ok) throw new Error("INVALID_TYPE_ID");

  const [res] = await pool.query(
    "INSERT INTO exercises (title, imgUrl, videoUrl, type_id) VALUES (?, ?, ?, ?)",
    [title, imgUrl || null, videoUrl || null, type_id ?? null]
  );
  return {
    id: res.insertId,
    title,
    imgUrl: imgUrl || null,
    videoUrl: videoUrl || null,
    type_id: type_id ?? null
  };
}


export async function createExerciseWithFiles({ title, type_id, imgRel, imgUrl, vidRel, vidUrl }) {
  const [res] = await pool.query(
    "INSERT INTO exercises (title, imgUrl, videoUrl, type_id) VALUES (?, ?, ?, ?)",
    [title, imgUrl || null, vidUrl || null, type_id ?? null]
  );
  return {
    id: res.insertId,
    title,
    imgUrl: imgUrl || null,
    videoUrl: vidUrl || null,
    type_id: type_id ?? null
  };
}

/** Actualizar ejercicio (parcial) */
export async function updateExercise(id, { title, imgUrl, videoUrl, type_id }) {
  const fields = [];
  const params = [];

  if (title !== undefined)   { fields.push("title = ?");   params.push(title); }
  if (imgUrl !== undefined)  { fields.push("imgUrl = ?");  params.push(imgUrl || null); }
  if (videoUrl !== undefined){ fields.push("videoUrl = ?");params.push(videoUrl || null); }
  if (type_id !== undefined) { fields.push("type_id = ?"); params.push(type_id ?? null); }

  if (fields.length === 0) throw new Error("NO_FIELDS");
  params.push(id);

  const [res] = await pool.query(
    `UPDATE exercises SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  if (res.affectedRows === 0) return null;

  const [[row]] = await pool.query(
    `SELECT e.id, e.title, e.imgUrl, e.videoUrl, e.type_id,
            t.name AS type_name,
            e.created_at
     FROM exercises e
     LEFT JOIN exercise_types t ON t.id = e.type_id
     WHERE e.id = ?`,
    [id]
  );
  return row || null;
}

/** Eliminar ejercicio */

export async function deleteExercise(id) {
  const existing = await getExerciseRow(id);
  if (!existing) return false;
  const [res] = await pool.query("DELETE FROM exercises WHERE id = ?", [id]);
  if (res.affectedRows > 0) {
    const maybeLocals = [existing.imgUrl, existing.videoUrl]
      .filter(Boolean)
      .filter(u => u.includes("/uploads/"))
      .map(u => u.replace(/^https?:\/\/[^/]+\/?/, ""));
    for (const rel of maybeLocals) {
      try { await fs.unlink(rel); } catch { /* ignore */ }
    }
    return true;
  }
  return false;
}

/** Obtener un ejercicio por id */

export async function getExercise(id) {
  const [[row]] = await pool.query(
    `SELECT e.id, e.title, e.imgUrl, e.videoUrl, e.type_id, t.name AS type_name, e.created_at
     FROM exercises e
     LEFT JOIN exercise_types t ON t.id = e.type_id
     WHERE e.id = ?`,
    [id]
  );
  return row || null;
}


/** Devuelve una fila “cruda” del ejercicio */
export async function getExerciseRow(id) {
  const [[row]] = await pool.query(
    `SELECT id, title, imgUrl, videoUrl, type_id, created_at
       FROM exercises
      WHERE id = ?`,
    [id]
  );
  return row || null;
}

/** Editar con soporte de ficheros (multipart) */
export async function updateExerciseWithFiles(
  id,
  { title, type_id, imgUrl, vidUrl } // ← ojo a los nombres que manda la ruta
) {
  const existing = await getExerciseRow(id);
  if (!existing) return null;

  const fields = [];
  const params = [];

  if (title !== undefined)   { fields.push("title = ?");     params.push(title); }
  if (type_id !== undefined) { fields.push("type_id = ?");   params.push(type_id ?? null); }
  if (imgUrl !== undefined)  { fields.push("imgUrl = ?");    params.push(imgUrl); }
  if (vidUrl !== undefined)  { fields.push("videoUrl = ?");  params.push(vidUrl); }

  if (fields.length === 0) return await getExerciseRow(id);

  params.push(id);
  await pool.query(`UPDATE exercises SET ${fields.join(", ")} WHERE id = ?`, params);

  // Borrar ficheros antiguos si han sido sustituidos y eran locales (/uploads/*)
  const toDelete = [];

  if (imgUrl !== undefined && existing.imgUrl && existing.imgUrl !== imgUrl && existing.imgUrl.includes("/uploads/")) {
    const rel = existing.imgUrl.replace(/^https?:\/\/[^/]+/, ""); // → "/uploads/…"
    toDelete.push(rel);
  }

  if (vidUrl !== undefined && existing.videoUrl && existing.videoUrl !== vidUrl && existing.videoUrl.includes("/uploads/")) {
    const rel = existing.videoUrl.replace(/^https?:\/\/[^/]+/, "");
    toDelete.push(rel);
  }

  for (const rel of toDelete) {
    // construye ruta absoluta bajo /public
    const abs = path.join(process.cwd(), "public", rel.replace(/^\/+/, ""));
    try { await fs.unlink(abs); } catch { /* silent */ }
  }

  return await getExerciseRow(id);
}