-- ===================================
-- BASE DE DATOS: pwa_backend (limpia)
-- ===================================

CREATE DATABASE IF NOT EXISTS pwa_backend
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pwa_backend;



CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (id, name) VALUES
  (1,'admin'), (2,'user'), (3,'client')
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- ===================================
-- USUARIOS
-- ===================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 2,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id)
    REFERENCES roles(id) ON DELETE RESTRICT,
  name VARCHAR(190),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, email, password_hash, role_id, name) VALUES
  (1, 'admin@ms.com', '$2b$12$G7K/Ja9qE1EH6/OkgEnzF.Ivd.cUbZU0CrwayAe1IKYRiuYeePyX2', 1, 'Admin ManelSubirats') -- password: 12341234Aa
ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash), role_id = VALUES(role_id), name = VALUES(name);   

-- ===================================
-- TIPOS DE EJERCICIOS (primero, para que exista al crear el FK)
-- ===================================
CREATE TABLE IF NOT EXISTS exercise_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- EJERCICIOS (después; ya puede referenciar exercise_types)
-- ===================================
CREATE TABLE IF NOT EXISTS exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  imgUrl TEXT,
  type_id INT NULL,
  videoUrl TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exercises_type
    FOREIGN KEY (type_id) REFERENCES exercise_types(id)
    ON DELETE SET NULL,
  INDEX idx_exercises_type (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TIPOS DE SESIÓN
-- ===================================
CREATE TABLE IF NOT EXISTS session_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- SESIONES DE ENTRENAMIENTO
-- ===================================
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  notes TEXT NULL,
  restTime INT NULL,
  type_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_type FOREIGN KEY (type_id)
    REFERENCES session_types(id)
    ON DELETE SET NULL,
  INDEX idx_sessions_type (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- EJERCICIOS DENTRO DE UNA SESIÓN
-- ===================================
CREATE TABLE IF NOT EXISTS session_exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  exercise_id INT NOT NULL,
  weight DECIMAL(6,2) NULL CHECK (weight IS NULL OR weight >= 0),
  reps INT NULL CHECK (reps IS NULL OR reps >= 1),
  order_index INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_se_session FOREIGN KEY (session_id)
    REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_se_exercise FOREIGN KEY (exercise_id)
    REFERENCES exercises(id) ON DELETE RESTRICT,
  INDEX idx_se_session (session_id),
  INDEX idx_se_order (session_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saldo cacheado en users
ALTER TABLE users
  ADD COLUMN credit_balance INT NOT NULL DEFAULT 0;

-- Ledger de movimientos de crédito
CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  delta INT NOT NULL,                  -- + añade, - descuenta (no 0)
  reason VARCHAR(100) NULL,            -- 'admin_adjust', 'booking', 'refund', ...
  reference_type VARCHAR(50) NULL,     -- 'booking', 'manual', etc.
  reference_id BIGINT NULL,            -- id externo si aplica
  created_by INT NULL,                 -- admin (users.id) que lo hizo; NULL si sistema
  metadata JSON NULL,                  -- datos extra
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ct_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_admin  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (delta <> 0),
  INDEX idx_ct_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;