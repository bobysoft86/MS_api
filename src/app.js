import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import exercisesRoutes from "./routes/exercises.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import sessionTypesRoutes from "./routes/sessionTypes.routes.js";
import exerciseTypesRoutes from "./routes/exerciseTypes.routes.js";
import usersRoutes from "./routes/users.routes.js";
import creditsRoutes from "./routes/credits.routes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || "uploads";


const allowed = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/exercises", exercisesRoutes);
// app.use('/sessions', (req, res, next) => {
//   console.log('> SESSIONS HIT', req.method, req.path, 'ct=', req.headers['content-type']);
//   console.log('> BODY typeof=', typeof req.body, 'body=', req.body);
//   next();
// }, sessionsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/session-types", sessionTypesRoutes);
app.use("/exercise-types", exerciseTypesRoutes);
app.use("/users", usersRoutes);
app.use("/", creditsRoutes);
app.use("/uploads", express.static(path.join(__dirname, "..", uploadDir)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
