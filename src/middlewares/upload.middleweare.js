import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Raíz del proyecto: .../MS_api
const ROOT = path.resolve(__dirname, "..", "..");

// Config
const IMAGE_MIME = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const VIDEO_MIME = new Set(["video/mp4","video/webm","video/quicktime","video/x-matroska"]);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

// Paths ABSOLUTOS (fuera de src/)
const UPLOAD_ABS = path.join(ROOT, UPLOAD_DIR);
const IMG_ABS    = path.join(UPLOAD_ABS, "images");
const VID_ABS    = path.join(UPLOAD_ABS, "videos");

// asegurar carpetas sin romper el arranque
for (const dir of [UPLOAD_ABS, IMG_ABS, VID_ABS]) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {
    console.error("[upload] mkdir fail:", dir, e?.message);
  }
}

function safeName(original) {
  const ext  = (path.extname(original) || "").toLowerCase();
  const base = (path.basename(original, ext) || "file")
    .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60) || "file";
  const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  return `${base}-${unique}${ext || ".bin"}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) return cb(null, IMG_ABS);
    if (VIDEO_MIME.has(file.mimetype)) return cb(null, VID_ABS);
    return cb(new Error("UNSUPPORTED_MIME"));
  },
  filename: (req, file, cb) => cb(null, safeName(file.originalname))
});

function fileFilter(req, file, cb) {
  if (IMAGE_MIME.has(file.mimetype) || VIDEO_MIME.has(file.mimetype)) return cb(null, true);
  return cb(new Error("UNSUPPORTED_MIME"));
}

const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 5);
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 200);
const upload = multer({ storage, fileFilter, limits: { fileSize: Math.max(MAX_IMAGE_MB, MAX_VIDEO_MB) * 1024 * 1024 } });

function relFromAbs(absPath) {
  // /.../MS_api/uploads/images/a.jpg -> /uploads/images/a.jpg
  const rel = path.relative(ROOT, absPath).replace(/\\/g, "/");
  return `/${rel.startsWith(UPLOAD_DIR) ? rel : `${UPLOAD_DIR}/${rel}`}`;
}

export function publicUrl(rel) {
  if (!rel) return null;
  const clean = rel.startsWith("/") ? rel : `/${rel}`;
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/,"");
  return base ? `${base}${clean}` : clean;
}

export function fileToPaths(file) {
  if (!file) return { rel: null, url: null };
  const rel = relFromAbs(file.path);
  return { rel, url: publicUrl(rel) };
}

export const uploadExerciseMedia = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 }
]);

export function multerErrorHandler(err, req, res, next) {
  if (err?.message === "UNSUPPORTED_MIME") return res.status(400).json({ error: "Tipo de archivo no soportado" });
  if (err && err.name === "MulterError")  return res.status(400).json({ error: err.message });
  next(err);
}