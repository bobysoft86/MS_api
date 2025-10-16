// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import exercisesRoutes from "./routes/exercises.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import sessionTypesRoutes from "./routes/sessionTypes.routes.js";
import exerciseTypesRoutes from "./routes/exerciseTypes.routes.js";
import usersRoutes from "./routes/users.routes.js";
import creditsRoutes from "./routes/credits.routes.js";

dotenv.config();
const app = express();

// __dirname de ESTE archivo
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.set("trust proxy", 1);

// CORS
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health
app.get("/health", (_, res) => res.json({ ok: true }));

// Rutas API
app.use("/auth", authRoutes);
app.use("/exercises", exercisesRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/session-types", sessionTypesRoutes);
app.use("/exercise-types", exerciseTypesRoutes);
app.use("/users", usersRoutes);
app.use("/", creditsRoutes);

// Estáticos /uploads desde la RAÍZ del proyecto (no dentro de src/)
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(__dirname, "..", uploadDir)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));