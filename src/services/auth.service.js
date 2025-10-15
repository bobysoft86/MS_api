import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

async function getRoleByName(name) {
  const [[r]] = await pool.query("SELECT id, name FROM roles WHERE name = ?", [name]);
  return r || null;
}
async function getRoleById(id) {
  const [[r]] = await pool.query("SELECT id, name FROM roles WHERE id = ?", [id]);
  return r || null;
}

export async function register({ email, password, name, role_id }) {
  const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (rows.length) throw new Error("EMAIL_IN_USE");

  // Por defecto: role = 'user' (id=2)
  let role = null;
  if (role_id != null) {
    role = await getRoleById(role_id);
  }
  if (!role) {
    role = await getRoleByName("user");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [res] = await pool.query(
    "INSERT INTO users (email, password_hash, name, role_id) VALUES (?, ?, ?, ?)",
    [email, passwordHash, name || null, role.id]
  );

  return { id: res.insertId, email, name: name || null, role_id: role.id, role_name: role.name };
}

export async function login({ email, password }) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.name, u.role_id, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  if (!rows.length) throw new Error("INVALID_CREDENTIALS");

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  const token = jwt.sign(
    { sub: user.id, email: user.email, role_id: user.role_id, role_name: user.role_name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role_id: user.role_id, role_name: user.role_name }
  };
}