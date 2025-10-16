import multer from "multer";
import path from "path";
import fs from "fs";

const IMAGE_MIME = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const VIDEO_MIME = new Set(["video/mp4","video/webm","video/quicktime","video/x-matroska"]);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const IMG_DIR = path.join(UPLOAD_DIR, "images");
const VID_DIR = path.join(UPLOAD_DIR, "videos");

// asegurar carpetas
for (const dir of [UPLOAD_DIR, IMG_DIR, VID_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeName(original) {
  const ext = path.extname(original).toLowerCase().slice(1); // sin punto
  const base = path.basename(original, path.extname(original))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 60);
  const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  return `${base || "file"}-${unique}.${ext || "bin"}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) return cb(null, IMG_DIR);
    if (VIDEO_MIME.has(file.mimetype)) return cb(null, VID_DIR);
    cb(new Error("UNSUPPORTED_MIME"));
  },
  filename: (req, file, cb) => cb(null, safeName(file.originalname))
});

function fileFilter(req, file, cb) {
  if (IMAGE_MIME.has(file.mimetype) || VIDEO_MIME.has(file.mimetype)) return cb(null, true);
  return cb(new Error("UNSUPPORTED_MIME"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * (IMAGE_MIME.size && VIDEO_MIME.size ? Math.max(
      Number(process.env.MAX_IMAGE_MB || 5),
      Number(process.env.MAX_VIDEO_MB || 200)
    ) : 200) // límite alto; controlamos por campo abajo si quieres
  }
});

// Para crear/editar ejercicios: campos opcionales image y video
export const uploadExerciseMedia = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 }
]);

export function buildPublicUrl(localPath) {
  if (!localPath) return null;
  const base = process.env.BASE_URL?.replace(/\/+$/, "") || "http://45.147.251.120";
  return `${base}/${localPath.replace(/^\.?\/*/, "")}`;
}

// helpers para mapear file -> url pública y path relativo
export function fileToPaths(file) {
  if (!file) return { rel: null, url: null };
  const rel = path.join(
    UPLOAD_DIR,
    file.destination.includes("images") ? "images" : "videos",
    path.basename(file.path)
  ).replace(/\\/g, "/");
  return { rel, url: buildPublicUrl(rel) };
}