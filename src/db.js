//appuser
//apppass

import mysql from "mysql2/promise";
import dotenv from "dotenv";  
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3360),
  user: process.env.DB_USER ?? "appuser",
  password: process.env.DB_PASS ?? "apppass",
  database: process.env.DB_NAME ?? "pwa_backend",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});