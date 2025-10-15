import { pool } from "../db.js";

/** ======================
 * 🔹 Roles helpers
 * ====================== */
export async function getRoleById(id) {
  const [[r]] = await pool.query("SELECT id, name FROM roles WHERE id = ?", [id]);
  return r || null;
}

export async function getRoleByName(name) {
  const [[r]] = await pool.query("SELECT id, name FROM roles WHERE name = ?", [name]);
  return r || null;
}

/** ======================
 * 🔹 Users helpers
 * ====================== */
export async function getUserById(id) {
  const [[u]] = await pool.query(
    `SELECT u.id, u.email, u.name, u.role_id, credit_balance, r.name AS role_name, u.created_at, u.updated_at
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [id]
  );
  return u || null;
}

export async function getUserByEmail(email) {
  const [[u]] = await pool.query(
    `SELECT u.id, u.email, u.name, u.role_id, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  return u || null;
}

/** Contar admins (para proteger el último admin) */
export async function countAdmins() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt
       FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'admin'`
  );
  return Number(row?.cnt || 0);
}

/** ======================
 * 🔹 Cambiar rol
 * ====================== */
/** Cambiar rol SOLO por role_id */
export async function changeUserRoleById(targetUserId, role_id) {
  // 1) Usuario existe
  const user = await getUserById(targetUserId);
  if (!user) return { notFound: true };

  // 2) Rol destino válido
  const role = await getRoleById(role_id);
  if (!role) return { invalidRole: true };

  // 3) Proteger último admin
  if (user.role_name === "admin" && role.name !== "admin") {
    const admins = await countAdmins();
    if (admins <= 1) return { lastAdmin: true };
  }

  // 4) Actualizar
  const [res] = await pool.query("UPDATE users SET role_id = ? WHERE id = ?", [role.id, targetUserId]);
  if (res.affectedRows === 0) return { notFound: true };

  // 5) Devolver actualizado
  const updated = await getUserById(targetUserId);
  return { user: updated };
}

/** ======================
 * 🔹 Actualizar usuario
 * ====================== */
export async function updateUser(id, { name, email, password_hash }) {
  const fields = [];
  const params = [];

  if (name !== undefined) fields.push("name = ?"), params.push(name);
  if (email !== undefined) fields.push("email = ?"), params.push(email);
  if (password_hash !== undefined) fields.push("password_hash = ?"), params.push(password_hash);

  if (fields.length === 0) throw new Error("NO_FIELDS");
  params.push(id);

  const [res] = await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
  if (res.affectedRows === 0) return null;

  const updated = await getUserById(id);
  return updated;
}

/** ======================
 * 🔹 "Who I Am"
 * ====================== */
export async function getWhoIAm(userId) {
  return await getUserById(userId);
}

export async function getAllUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.name,credit_balance, u.role_id, r.name AS role_name, u.created_at, u.updated_at
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     ORDER BY u.id ASC`
  );
  return rows;
}

export async function deleteUser(id) {
  const [res] = await pool.query("DELETE FROM users WHERE id = ?", [id]);
  return res.affectedRows > 0;
}