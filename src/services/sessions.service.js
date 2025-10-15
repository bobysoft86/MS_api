import { pool } from "../db.js";
/** (opcional) comprobar existencia del tipo de sesión */
export async function sessionTypeExists(typeId) {
  const [[row]] = await pool.query("SELECT 1 AS ok FROM session_types WHERE id = ?", [typeId]);
  return !!row;
}

/** Crear sesión */
export async function createSession({ title, notes, type_id, restTime }) {
  const [res] = await pool.query("INSERT INTO sessions (title, notes, type_id, restTime) VALUES (?, ?, ?, ?)", [title, notes || null, type_id || null, restTime ?? null]);
  return { id: res.insertId, title, notes: notes || null, type_id: type_id || null, restTime: restTime ?? null };
}

/** Actualizar sesión (title/notes/type_id) */
export async function updateSession(id, { title, notes, type_id,restTime }) {
  const fields = [];
  const params = [];
  if (title !== undefined) {
    fields.push("title = ?");
    params.push(title);
  }
  if (notes !== undefined) {
    fields.push("notes = ?");
    params.push(notes || null);
  }
  if (type_id !== undefined) {
    fields.push("type_id = ?");
    params.push(type_id || null);
  }
  if (restTime !== undefined) {
    fields.push("restTime = ?");
    params.push(restTime ?? null);
  }

  if (fields.length === 0) throw new Error("NO_FIELDS");
  params.push(id);

  const [res] = await pool.query(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, params);
  if (res.affectedRows === 0) return null;

  const [[row]] = await pool.query(
    `SELECT s.id, s.title, s.notes, s.type_id, s.restTime,
       t.name AS type_name, t.description AS type_description, s.created_at
     FROM sessions s
     LEFT JOIN session_types t ON s.type_id = t.id
     WHERE s.id = ?`,
    [id]
  );
  return row || null;
}

/** Listar sesiones (con o sin ejercicios) */
export async function listSessions({ includeExercises = false } = {}) {
  const [sessions] = await pool.query(
    `SELECT s.id, s.title, s.notes, s.type_id, t.name AS type_name, t.description AS type_description, s.created_at
     FROM sessions s
     LEFT JOIN session_types t ON s.type_id = t.id
     ORDER BY s.id DESC`
  );
  if (!includeExercises || sessions.length === 0) return sessions;

  const ids = sessions.map((s) => s.id);
  const [rows] = await pool.query(
    `SELECT se.id AS session_exercise_id, se.session_id, se.weight, se.reps, se.order_index,
            e.id AS exercise_id, e.title AS exercise_title, e.imgUrl, e.videoUrl
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.session_id IN (${ids.map(() => "?").join(",")})
     ORDER BY se.session_id ASC, se.order_index ASC, se.id ASC`,
    ids
  );
  const map = new Map(sessions.map((s) => [s.id, { ...s, exercises: [] }]));
  for (const r of rows) {
    map.get(r.session_id).exercises.push({
      id: r.session_exercise_id,
      exercise: {
        id: r.exercise_id,
        title: r.exercise_title,
        imgUrl: r.imgUrl,
        videoUrl: r.videoUrl,
      },
      weight: r.weight,
      reps: r.reps,
      order_index: r.order_index,
    });
  }
  return Array.from(map.values());
}

/** Obtener una sesión (con ejercicios) */
export async function getSession(id) {
  const [[session]] = await pool.query(
    `SELECT s.id, s.title, s.notes,restTime, s.type_id, t.name AS type_name, t.description AS type_description, s.created_at
     FROM sessions s
     LEFT JOIN session_types t ON s.type_id = t.id
     WHERE s.id = ?`,
    [id]
  );
  if (!session) return null;

  const [rows] = await pool.query(
    `SELECT se.id AS session_exercise_id, se.session_id, se.weight, se.reps, se.order_index,
            e.id AS exercise_id, e.title AS exercise_title, e.imgUrl, e.videoUrl
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.session_id = ?
     ORDER BY se.order_index ASC, se.id ASC`,
    [id]
  );
  return {
    ...session,
    exercises: rows.map((r) => ({
      id: r.session_exercise_id,
      exercise: {
        id: r.exercise_id,
        title: r.exercise_title,
        imgUrl: r.imgUrl,
        videoUrl: r.videoUrl,
      },
      weight: r.weight,
      reps: r.reps,
      order_index: r.order_index,
    })),
  };
}

/** Añadir ejercicio a la sesión */
export async function addExerciseToSession({ session_id, exercise_id, weight, reps, order_index }) {
  let finalOrder = order_index;
  if (finalOrder === undefined || finalOrder === null) {
    finalOrder = await getNextOrderIndex(session_id);
  }

  const [res] = await pool.query(
    `INSERT INTO session_exercises (session_id, exercise_id, weight, reps, order_index)
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, exercise_id, weight ?? null, reps ?? null, finalOrder]
  );
  return {
    id: res.insertId,
    session_id,
    exercise_id,
    weight: weight ?? null,
    reps: reps ?? null,
    order_index: finalOrder,
  };
}

/** Actualizar peso/reps/orden de un ejercicio dentro de la sesión */
export async function updateSessionExercise(session_exercise_id, { weight, reps, order_index }) {
  const fields = [];
  const params = [];
  if (weight !== undefined) {
    fields.push("weight = ?");
    params.push(weight ?? null);
  }
  if (reps !== undefined) {
    fields.push("reps = ?");
    params.push(reps ?? null);
  }
  if (order_index !== undefined) {
    fields.push("order_index = ?");
    params.push(order_index);
  }
  if (fields.length === 0) throw new Error("NO_FIELDS");
  params.push(session_exercise_id);

  const [res] = await pool.query(`UPDATE session_exercises SET ${fields.join(", ")} WHERE id = ?`, params);
  if (res.affectedRows === 0) return null;

  const [[row]] = await pool.query(
    `SELECT se.id AS session_exercise_id, se.session_id, se.weight, se.reps, se.order_index,
            e.id AS exercise_id, e.title AS exercise_title, e.imgUrl, e.videoUrl
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.id = ?`,
    [session_exercise_id]
  );
  if (!row) return null;
  return {
    id: row.session_exercise_id,
    session_id: row.session_id,
    exercise: { id: row.exercise_id, title: row.exercise_title, imgUrl: row.imgUrl, videoUrl: row.videoUrl },
    weight: row.weight,
    reps: row.reps,
    order_index: row.order_index,
  };
}

/** Borrar ejercicio de la sesión */
export async function deleteSessionExercise(session_exercise_id) {
  const [res] = await pool.query("DELETE FROM session_exercises WHERE id = ?", [session_exercise_id]);
  return res.affectedRows > 0;
}

/** Borrar sesión completa */
export async function deleteSession(session_id) {
  const [res] = await pool.query("DELETE FROM sessions WHERE id = ?", [session_id]);
  return res.affectedRows > 0;
}
// Devuelve el siguiente order_index para una sesión (0 si no hay elementos)

export async function getNextOrderIndex(session_id) {
  const [[row]] = await pool.query("SELECT COALESCE(MAX(order_index) + 1, 0) AS next_idx FROM session_exercises WHERE session_id = ?", [session_id]);
  return Number(row.next_idx) || 0;
}

export async function reorderSessionExercises(session_id, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("EMPTY_ORDER");
  }

  // 1) Traer todos los ids existentes de esa sesión
  const [rows] = await pool.query("SELECT id FROM session_exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC", [session_id]);
  const existingIds = rows.map((r) => r.id);

  // 2) Validaciones básicas
  const setGiven = new Set(orderedIds);
  if (setGiven.size !== orderedIds.length) throw new Error("DUPLICATED_IDS");
  // deben coincidir exactamente (mismo conteo y mismos elementos)
  if (orderedIds.length !== existingIds.length) throw new Error("MISMATCH_COUNT");
  const setExisting = new Set(existingIds);
  for (const id of orderedIds) if (!setExisting.has(id)) throw new Error("ID_NOT_IN_SESSION");

  // 3) Transacción: asignar order_index = posición en el array
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i++) {
      await conn.query("UPDATE session_exercises SET order_index = ? WHERE id = ? AND session_id = ?", [i, orderedIds[i], session_id]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  // 4) Devolver lista ya ordenada
  const [after] = await pool.query(
    `SELECT se.id AS session_exercise_id, se.session_id, se.weight, se.reps, se.order_index,
            e.id AS exercise_id, e.title AS exercise_title, e.imgUrl, e.videoUrl
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.session_id = ?
     ORDER BY se.order_index ASC, se.id ASC`,
    [session_id]
  );
  return after.map((r) => ({
    id: r.session_exercise_id,
    session_id: r.session_id,
    exercise: { id: r.exercise_id, title: r.exercise_title, imgUrl: r.imgUrl, videoUrl: r.videoUrl },
    weight: r.weight,
    reps: r.reps,
    order_index: r.order_index,
  }));
}

export async function compactSessionOrder(session_id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query("SELECT id FROM session_exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC", [session_id]);
    for (let i = 0; i < rows.length; i++) {
      await conn.query("UPDATE session_exercises SET order_index = ? WHERE id = ?", [i, rows[i].id]);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return true;
}

export async function moveSessionExercise(session_id, session_exercise_id, newIndex) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Datos actuales
    const [[cur]] = await conn.query("SELECT id, order_index FROM session_exercises WHERE id = ? AND session_id = ?", [session_exercise_id, session_id]);
    if (!cur) {
      await conn.rollback();
      return null; // no existe en esa sesión
    }

    const [[cntRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM session_exercises WHERE session_id = ?", [session_id]);
    const count = Number(cntRow.cnt);

    // 2) Normaliza newIndex a 0..count-1
    let target = Number(newIndex);
    if (Number.isNaN(target)) target = cur.order_index;
    if (target < 0) target = 0;
    if (target > count - 1) target = count - 1;

    if (target === cur.order_index) {
      await conn.rollback();
      // no hay cambio; devolver estado actual
      return { id: cur.id, session_id, order_index: cur.order_index };
    }

    // 3) Desplazar el hueco
    if (target < cur.order_index) {
      // Mover hacia arriba: shift +1 los que están en [target, cur.order_index-1]
      await conn.query(
        `UPDATE session_exercises
           SET order_index = order_index + 1
         WHERE session_id = ?
           AND order_index >= ?
           AND order_index < ?
           AND id <> ?`,
        [session_id, target, cur.order_index, session_exercise_id]
      );
    } else {
      // Mover hacia abajo: shift -1 los que están en (cur.order_index, target]
      await conn.query(
        `UPDATE session_exercises
           SET order_index = order_index - 1
         WHERE session_id = ?
           AND order_index <= ?
           AND order_index > ?
           AND id <> ?`,
        [session_id, target, cur.order_index, session_exercise_id]
      );
    }

    // 4) Colocar el que movemos en la posición target
    await conn.query("UPDATE session_exercises SET order_index = ? WHERE id = ?", [target, session_exercise_id]);

    await conn.commit();

    // 5) (opcional) devolver la lista ya ordenada
    const [after] = await pool.query(
      `SELECT se.id AS session_exercise_id, se.session_id, se.weight, se.reps, se.order_index,
              e.id AS exercise_id, e.title AS exercise_title, e.imgUrl, e.videoUrl
         FROM session_exercises se
         JOIN exercises e ON e.id = se.exercise_id
        WHERE se.session_id = ?
        ORDER BY se.order_index ASC, se.id ASC`,
      [session_id]
    );

    return after.map((r) => ({
      id: r.session_exercise_id,
      session_id: r.session_id,
      exercise: { id: r.exercise_id, title: r.exercise_title, imgUrl: r.imgUrl, videoUrl: r.videoUrl },
      weight: r.weight,
      reps: r.reps,
      order_index: r.order_index,
    }));
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  
}



/**
 * items: Array<{ id: number; order_index: number }>
 * Aplica el nuevo orden a los registros de session_exercises (id = PK del vínculo).
 */
export async function reorderSessionExercisesByMap(session_id, items) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ids = items.map(i => i.id);
    // Verifica pertenencia
    const [rows] = await conn.query(
      `SELECT id FROM session_exercises WHERE session_id = ? AND id IN (${ids.map(()=> '?').join(',')})`,
      [session_id, ...ids]
    );
    const found = new Set(rows.map(r => r.id));
    if (found.size !== ids.length) throw new Error('ID_NOT_IN_SESSION');

    const caseParts = [];
    const params = [];
    for (const it of items) { caseParts.push('WHEN ? THEN ?'); params.push(it.id, it.order_index); }

    await conn.query(
      `UPDATE session_exercises
       SET order_index = CASE id ${caseParts.join(' ')} END
       WHERE session_id = ?
         AND id IN (${ids.map(()=> '?').join(',')})`,
      [...params, session_id, ...ids]
    );

    const [out] = await conn.query(
      `SELECT se.id, se.session_id, se.exercise_id, se.weight, se.reps, se.order_index,
              e.title, e.imgUrl
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
       WHERE se.session_id = ?
       ORDER BY se.order_index ASC, se.id ASC`,
      [session_id]
    );

    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}