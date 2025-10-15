import { pool } from "../db.js";

/** Crear un nuevo tipo de sesión */
export async function createSessionType({ name, description }) {
  const [res] = await pool.query(
    "INSERT INTO session_types (name, description) VALUES (?, ?)",
    [name, description || null]
  );
  return { id: res.insertId, name, description: description || null };
}

/** Listar todos los tipos de sesión */
export async function listSessionTypes() {
  const [rows] = await pool.query(
    "SELECT id, name, description, created_at FROM session_types ORDER BY id ASC"
  );
  return rows;
}

/** Obtener un tipo de sesión por ID */
export async function getSessionType(id) {
  const [[row]] = await pool.query(
    "SELECT id, name, description, created_at FROM session_types WHERE id = ?",
    [id]
  );
  return row || null;
}

/** Actualizar un tipo de sesión */
export async function updateSessionType(id, { name, description }) {
  const [result] = await pool.query(
    "UPDATE session_types SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
    [name || null, description || null, id]
  );

  if (result.affectedRows === 0) return null;

  const [[updated]] = await pool.query(
    "SELECT id, name, description, created_at FROM session_types WHERE id = ?",
    [id]
  );
  return updated;
}

/** Eliminar un tipo de sesión */
export async function deleteSessionType(id) {
  const [result] = await pool.query(
    "DELETE FROM session_types WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}