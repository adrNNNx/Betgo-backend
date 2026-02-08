-- ============================================================
-- BETGO - Sistema de Entretenimiento para Bares
-- Script de Creación de Base de Datos
-- PostgreSQL 14+
-- ============================================================

-- ============================================================
-- 1. CONFIGURACIÓN INICIAL
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. TIPOS ENUM
-- ============================================================

-- Roles de usuario
CREATE TYPE user_role AS ENUM ('player', 'staff', 'admin');

-- Roles de staff
CREATE TYPE staff_role AS ENUM ('mozo', 'encargado', 'admin_bar', 'super_admin');

-- Tipos de transacción
CREATE TYPE transaction_type AS ENUM (
    'recharge',        -- Recarga de saldo a usuario
    'play_free',       -- Jugada gratuita
    'play_paid',       -- Jugada paga (premio local)
    'play_pool',       -- Jugada por el pozo global
    'prize_local',     -- Premio local ganado
    'prize_jackpot',   -- Jackpot ganado
    'bar_recharge',    -- Recarga de saldo al bar
    'adjustment'       -- Ajuste manual
);

-- Tipos de jugada
CREATE TYPE play_type AS ENUM ('free', 'paid', 'pool');

-- Tipos de premio
CREATE TYPE prize_type AS ENUM ('local', 'jackpot');

-- Estados de código
CREATE TYPE code_status AS ENUM ('pending', 'used', 'expired');

-- Estados de reclamo de premio
CREATE TYPE claim_status AS ENUM ('pending', 'delivered', 'expired');

-- Tipos de movimiento del pozo
CREATE TYPE pool_movement_type AS ENUM ('contribution', 'jackpot_win', 'adjustment');

-- Métodos de pago
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'qr', 'card', 'other');

-- ============================================================
-- 3. TABLAS PRINCIPALES
-- ============================================================

-- --------------------------------------
-- 3.1 BARS - Establecimientos
-- --------------------------------------
CREATE TABLE bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(100),
    logo_url VARCHAR(500),
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    free_plays_per_day INTEGER NOT NULL DEFAULT 3,
    bar_percentage DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
    pool_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    platform_percentage DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: los porcentajes deben sumar 100
    CONSTRAINT bars_percentages_check CHECK (
        bar_percentage + pool_percentage + platform_percentage = 100.00
    ),
    -- Constraint: porcentajes positivos
    CONSTRAINT bars_percentages_positive CHECK (
        bar_percentage >= 0 AND pool_percentage >= 0 AND platform_percentage >= 0
    )
);

CREATE INDEX idx_bars_slug ON bars(slug);
CREATE INDEX idx_bars_is_active ON bars(is_active);

-- --------------------------------------
-- 3.2 TABLES - Mesas
-- --------------------------------------
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE RESTRICT,
    number INTEGER NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    qr_code VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: número de mesa único por bar
    CONSTRAINT tables_bar_number_unique UNIQUE (bar_id, number)
);

CREATE INDEX idx_tables_bar_id ON tables(bar_id);
CREATE INDEX idx_tables_slug ON tables(slug);

-- --------------------------------------
-- 3.3 USERS - Usuarios/Jugadores
-- --------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    role user_role NOT NULL DEFAULT 'player',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- --------------------------------------
-- 3.4 STAFF - Personal
-- --------------------------------------
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    bar_id UUID REFERENCES bars(id) ON DELETE RESTRICT, -- NULL para super_admin
    role staff_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: un usuario solo puede tener un rol por bar
    CONSTRAINT staff_user_bar_unique UNIQUE (user_id, bar_id)
);

CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_staff_bar_id ON staff(bar_id);
CREATE INDEX idx_staff_role ON staff(role);

-- --------------------------------------
-- 3.5 PRIZES - Premios
-- --------------------------------------
CREATE TABLE prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID REFERENCES bars(id) ON DELETE RESTRICT, -- NULL para jackpot global
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type prize_type NOT NULL,
    value DECIMAL(12, 2),
    stock INTEGER, -- NULL = ilimitado
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prizes_bar_id ON prizes(bar_id);
CREATE INDEX idx_prizes_type ON prizes(type);
CREATE INDEX idx_prizes_is_active ON prizes(is_active);

-- --------------------------------------
-- 3.6 SYMBOLS - Símbolos del Juego
-- --------------------------------------
CREATE TABLE symbols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID REFERENCES bars(id) ON DELETE RESTRICT, -- NULL para símbolos globales
    name VARCHAR(50) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    weight INTEGER NOT NULL DEFAULT 100, -- Peso para probabilidad
    prize_id UUID REFERENCES prizes(id) ON DELETE SET NULL,
    is_jackpot BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symbols_bar_id ON symbols(bar_id);
CREATE INDEX idx_symbols_prize_id ON symbols(prize_id);
CREATE INDEX idx_symbols_is_jackpot ON symbols(is_jackpot);
CREATE INDEX idx_symbols_display_order ON symbols(display_order);

-- --------------------------------------
-- 3.7 GLOBAL_POOL - Pozo Nacional (Singleton)
-- --------------------------------------
CREATE TABLE global_pool (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    cost_per_play DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
    min_amount DECIMAL(14, 2) NOT NULL DEFAULT 100000.00,
    last_winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    last_winner_amount DECIMAL(14, 2),
    last_winner_at TIMESTAMP WITH TIME ZONE,
    total_collected DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_paid DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: solo puede existir un registro (singleton)
    CONSTRAINT global_pool_singleton CHECK (id = 1)
);

-- Insertar registro inicial del pozo
INSERT INTO global_pool (id, current_amount, cost_per_play, min_amount) 
VALUES (1, 0.00, 1000.00, 100000.00);

-- ============================================================
-- 4. TABLAS TRANSACCIONALES
-- ============================================================

-- --------------------------------------
-- 4.1 TRANSACTIONS - Transacciones
-- --------------------------------------
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    bar_id UUID REFERENCES bars(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
    type transaction_type NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    balance_before DECIMAL(12, 2),
    balance_after DECIMAL(12, 2),
    payment_method payment_method,
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_bar_id ON transactions(bar_id);
CREATE INDEX idx_transactions_staff_id ON transactions(staff_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Índice compuesto para reportes por fecha y tipo
CREATE INDEX idx_transactions_date_type ON transactions(created_at, type);

-- --------------------------------------
-- 4.2 PLAYS - Registro de Jugadas
-- --------------------------------------
CREATE TABLE plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL para jugadores anónimos
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    type play_type NOT NULL,
    result JSONB NOT NULL, -- Array de 5 symbol_ids
    is_winner BOOLEAN NOT NULL DEFAULT false,
    prize_id UUID REFERENCES prizes(id) ON DELETE SET NULL,
    amount_paid DECIMAL(10, 2),
    pool_contribution DECIMAL(10, 2),
    device_fingerprint VARCHAR(255),
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plays_user_id ON plays(user_id);
CREATE INDEX idx_plays_bar_id ON plays(bar_id);
CREATE INDEX idx_plays_table_id ON plays(table_id);
CREATE INDEX idx_plays_type ON plays(type);
CREATE INDEX idx_plays_is_winner ON plays(is_winner);
CREATE INDEX idx_plays_created_at ON plays(created_at);

-- Índice para búsqueda por dispositivo/IP (control de jugadas gratis)
CREATE INDEX idx_plays_device ON plays(device_fingerprint, created_at);
CREATE INDEX idx_plays_ip ON plays(ip_address, created_at);

-- --------------------------------------
-- 4.3 USER_DAILY_PLAYS - Control Jugadas Gratis
-- --------------------------------------
CREATE TABLE user_daily_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE RESTRICT,
    play_date DATE NOT NULL DEFAULT CURRENT_DATE,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    plays_used INTEGER NOT NULL DEFAULT 0,
    plays_limit INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índice único para control por dispositivo
CREATE UNIQUE INDEX idx_daily_plays_device ON user_daily_plays(bar_id, play_date, device_fingerprint) 
WHERE device_fingerprint IS NOT NULL;

-- Índice para búsqueda por IP
CREATE INDEX idx_daily_plays_ip ON user_daily_plays(bar_id, play_date, ip_address);

-- Índice para búsqueda por usuario
CREATE INDEX idx_daily_plays_user ON user_daily_plays(bar_id, play_date, user_id);

-- --------------------------------------
-- 4.4 RECHARGE_CODES - Códigos de Recarga
-- --------------------------------------
CREATE TABLE recharge_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL UNIQUE,
    qr_data TEXT NOT NULL,
    status code_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    amount_requested DECIMAL(10, 2),
    amount_loaded DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recharge_codes_code ON recharge_codes(code);
CREATE INDEX idx_recharge_codes_user_id ON recharge_codes(user_id);
CREATE INDEX idx_recharge_codes_status ON recharge_codes(status);
CREATE INDEX idx_recharge_codes_expires_at ON recharge_codes(expires_at);

-- --------------------------------------
-- 4.5 PRIZE_CLAIMS - Premios Ganados
-- --------------------------------------
CREATE TABLE prize_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    bar_id UUID REFERENCES bars(id) ON DELETE RESTRICT,
    prize_id UUID NOT NULL REFERENCES prizes(id) ON DELETE RESTRICT,
    play_id UUID NOT NULL REFERENCES plays(id) ON DELETE RESTRICT,
    claim_code VARCHAR(20) NOT NULL UNIQUE,
    status claim_status NOT NULL DEFAULT 'pending',
    delivered_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prize_claims_code ON prize_claims(claim_code);
CREATE INDEX idx_prize_claims_user_id ON prize_claims(user_id);
CREATE INDEX idx_prize_claims_bar_id ON prize_claims(bar_id);
CREATE INDEX idx_prize_claims_status ON prize_claims(status);
CREATE INDEX idx_prize_claims_expires_at ON prize_claims(expires_at);

-- --------------------------------------
-- 4.6 POOL_MOVEMENTS - Movimientos del Pozo
-- --------------------------------------
CREATE TABLE pool_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type pool_movement_type NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    balance_before DECIMAL(14, 2) NOT NULL,
    balance_after DECIMAL(14, 2) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    bar_id UUID REFERENCES bars(id) ON DELETE SET NULL,
    play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
    notes TEXT,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_movements_type ON pool_movements(type);
CREATE INDEX idx_pool_movements_user_id ON pool_movements(user_id);
CREATE INDEX idx_pool_movements_bar_id ON pool_movements(bar_id);
CREATE INDEX idx_pool_movements_created_at ON pool_movements(created_at);

-- --------------------------------------
-- 4.7 AUDIT_LOGS - Registro de Auditoría
-- --------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- 5. FUNCIONES Y TRIGGERS
-- ============================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_bars_updated_at BEFORE UPDATE ON bars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prizes_updated_at BEFORE UPDATE ON prizes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_symbols_updated_at BEFORE UPDATE ON symbols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_pool_updated_at BEFORE UPDATE ON global_pool
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_daily_plays_updated_at BEFORE UPDATE ON user_daily_plays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para generar código aleatorio
CREATE OR REPLACE FUNCTION generate_random_code(length INTEGER DEFAULT 8)
RETURNS VARCHAR AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin caracteres confusos (0, O, 1, I)
    result VARCHAR := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. DATOS INICIALES (SEEDS)
-- ============================================================

-- Usuario administrador por defecto (contraseña: admin123 - CAMBIAR EN PRODUCCIÓN)
-- Hash generado con bcrypt, rounds=10
INSERT INTO users (id, phone, email, password_hash, name, role, is_active)
VALUES (
    gen_random_uuid(),
    '0981000000',
    'admin@betgo.com',
    '$2b$10$rQZ5aKJLZk9xL7nF3mHkXeYqP8h3VZkJ0Y9xL7nF3mHkXeYqP8h3V', -- CAMBIAR
    'Administrador',
    'admin',
    true
);

-- Crear staff super_admin para el usuario admin
INSERT INTO staff (user_id, bar_id, role, is_active)
SELECT id, NULL, 'super_admin', true
FROM users WHERE email = 'admin@betgo.com';

-- Símbolos globales por defecto para el pozo
INSERT INTO symbols (bar_id, name, image_url, weight, is_jackpot, display_order, is_active) VALUES
(NULL, 'Cereza', '/symbols/cherry.png', 150, false, 1, true),
(NULL, 'Limón', '/symbols/lemon.png', 140, false, 2, true),
(NULL, 'Naranja', '/symbols/orange.png', 130, false, 3, true),
(NULL, 'Uva', '/symbols/grape.png', 120, false, 4, true),
(NULL, 'Sandía', '/symbols/watermelon.png', 100, false, 5, true),
(NULL, 'Campana', '/symbols/bell.png', 80, false, 6, true),
(NULL, 'Diamante', '/symbols/diamond.png', 50, false, 7, true),
(NULL, 'Siete', '/symbols/seven.png', 30, false, 8, true),
(NULL, 'Jackpot', '/symbols/jackpot.png', 5, true, 9, true);

-- ============================================================
-- 7. COMENTARIOS EN TABLAS
-- ============================================================

COMMENT ON TABLE bars IS 'Establecimientos/bares registrados en el sistema';
COMMENT ON TABLE tables IS 'Mesas de cada bar, puntos de acceso para escanear QR';
COMMENT ON TABLE users IS 'Usuarios del sistema (jugadores, staff, admins)';
COMMENT ON TABLE staff IS 'Asignación de personal a bares con sus roles';
COMMENT ON TABLE symbols IS 'Símbolos del juego de tragamonedas';
COMMENT ON TABLE prizes IS 'Premios disponibles (locales por bar o jackpot global)';
COMMENT ON TABLE global_pool IS 'Pozo nacional/global del sistema (singleton)';
COMMENT ON TABLE transactions IS 'Registro de todas las transacciones financieras';
COMMENT ON TABLE plays IS 'Registro de cada jugada realizada';
COMMENT ON TABLE user_daily_plays IS 'Control de jugadas gratuitas diarias por dispositivo';
COMMENT ON TABLE recharge_codes IS 'Códigos QR generados para solicitar recarga de saldo';
COMMENT ON TABLE prize_claims IS 'Premios ganados pendientes de entrega';
COMMENT ON TABLE pool_movements IS 'Historial de movimientos del pozo global';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de acciones en el sistema';

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
