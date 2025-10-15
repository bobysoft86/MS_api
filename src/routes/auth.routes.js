import { Router } from "express";
import { login, register } from "../services/auth.service.js";
import { authRequired } from "../middlewares/auth.middleware.js";

const router = Router();

// Registro
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await register({ email, password, name });
    res.status(201).json(user);
  } catch (e) {
    if (e.message === "EMAIL_IN_USE")
      return res.status(409).json({ error: "EMAIL_IN_USE" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "MISSING_FIELDS" });

    const result = await login({ email, password });
    res.json(result);
  } catch (e) {
    if (e.message === "INVALID_CREDENTIALS")
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// Perfil del usuario autenticado
router.get("/me", authRequired, async (req, res) => {
  // opcional: refrescar desde DB
  res.json({ me: { id: req.user.sub, email: req.user.email, role_id: req.user.role_id, role_name: req.user.role_name } });
});

export default router;