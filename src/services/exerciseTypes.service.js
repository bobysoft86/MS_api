import { pool } from "../db.js";

/** Crear tipo de ejercicio */
export async function createExerciseType({ name, description }) {
  const [res] = await pool.query(
    "INSERT INTO exercise_types (name, description) VALUES (?, ?)",
    [name, description || null]
  );
  return { id: res.insertId, name, description: description || null };
}

/** Listar todos los tipos de ejercicio */
export async function listExerciseTypes() {
  const [rows] = await pool.query(
    "SELECT id, name, description, created_at FROM exercise_types ORDER BY id ASC"
  );
  return rows;
}

/** Obtener un tipo de ejercicio por ID */
export async function getExerciseType(id) {
  const [[row]] = await pool.query(
    "SELECT id, name, description, created_at FROM exercise_types WHERE id = ?",
    [id]
  );
  return row || null;
}

/** Actualizar tipo de ejercicio (parcial) */
export async function updateExerciseType(id, { name, description }) {
  const fields = [];
  const params = [];
  if (name !== undefined)        { fields.push("name = ?");        params.push(name); }
  if (description !== undefined) { fields.push("description = ?"); params.push(description || null); }

  if (fields.length === 0) throw new Error("NO_FIELDS");
  params.push(id);

  const [res] = await pool.query(
    `UPDATE exercise_types SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  if (res.affectedRows === 0) return null;

  const [[updated]] = await pool.query(
    "SELECT id, name, description, created_at FROM exercise_types WHERE id = ?",
    [id]
  );
  return updated || null;
}

/** Borrar tipo de ejercicio */
export async function deleteExerciseType(id) {
  const [res] = await pool.query("DELETE FROM exercise_types WHERE id = ?", [id]);
  return res.affectedRows > 0;
}