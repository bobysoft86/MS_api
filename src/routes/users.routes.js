import { Router } from "express";
import bcrypt from "bcrypt";
import { authRequired, requireRole } from "../middlewares/auth.middleware.js";
import {
  getUserById,
  getWhoIAm,
  updateUser,
  changeUserRoleById,
  getAllUsers,
  deleteUser,

} from "../services/users.service.js";

const router = Router();



/** ======================
 * 🔹 GET /users  → todos los usuarios
 * ====================== */

router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});


/** ======================
 * 🔹 GET /users/me  → quién soy
 * ====================== */
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await getWhoIAm(req.user.sub);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** ======================
 * 🔹 GET /users/:id → info de un usuario (solo admin)
 * ====================== */
router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  try {
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** ======================
 * 🔹 PATCH /users/:id → actualizar usuario
 * ====================== */
router.patch("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  // Si no eres admin, solo puedes editarte a ti mismo
  const isAdmin = req.user.role_name === "admin";
  if (!isAdmin && req.user.sub !== id)
    return res.status(403).json({ error: "FORBIDDEN" });

  const { name, email, password } = req.body || {};
  if (name === undefined && email === undefined && password === undefined)
    return res.status(400).json({ error: "NO_FIELDS" });

  try {
    let password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 12);
    }

    const updated = await updateUser(id, { name, email, password_hash });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "EMAIL_IN_USE" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** ======================
 * 🔹 PATCH /users/:id/role → cambiar rol
 * ====================== */
router.patch("/:id/role", authRequired, requireRole("admin"), async (req, res) => {
  const targetId = Number(req.params.id);
  const { role_id } = req.body || {};

  if (!Number.isInteger(targetId) || targetId <= 0)
    return res.status(400).json({ error: "INVALID_USER_ID" });

  if (!Number.isInteger(Number(role_id)) || Number(role_id) <= 0)
    return res.status(400).json({ error: "INVALID_ROLE_ID" });

  try {
    const result = await changeUserRoleById(targetId, Number(role_id));

    if (result.notFound)    return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (result.invalidRole) return res.status(400).json({ error: "INVALID_ROLE" });
    if (result.lastAdmin)   return res.status(409).json({ error: "CANNOT_REMOVE_LAST_ADMIN" });

    return res.json({ updated: true, user: result.user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});


/** ======================
 * 🔹 DELETE /users/:id → borrar usuario
 * ====================== */

router.delete("/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "INVALID_ID" });

  try {
    const deleted = await deleteUser(id);
    if (!deleted) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/** ======================
 * 🔹 Export router
 * ====================== */

export default router;