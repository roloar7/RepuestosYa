-- ============================================================
-- SCHEMA REPUESTOSYA
-- Base de datos completa para RepuestosYa
-- ============================================================

-- ============================================================
-- TABLA: printers
-- ============================================================
CREATE TABLE IF NOT EXISTS printers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  ip VARCHAR(15) NOT NULL UNIQUE,
  access_code VARCHAR(255),
  serial_number VARCHAR(255) UNIQUE,
  
  -- Multi-protocol support
  protocol VARCHAR(50) DEFAULT 'bambu_lan',
  credentials JSONB DEFAULT '{}'::jsonb,
  agent_location VARCHAR(100),
  
  status VARCHAR(20) DEFAULT 'offline', -- idle, printing, paused, offline, error
  last_seen_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('idle', 'printing', 'paused', 'offline', 'error')),
  CONSTRAINT valid_protocol CHECK (protocol IN ('bambu_lan', 'klipper_moonraker'))
);

CREATE INDEX idx_printers_user_id ON printers(user_id);
CREATE INDEX idx_printers_ip ON printers(ip);
CREATE INDEX idx_printers_serial ON printers(serial_number);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_protocol ON printers(protocol);
CREATE INDEX idx_printers_agent_location ON printers(agent_location);

-- RLS para printers
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all printers"
  ON printers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own printers"
  ON printers FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own printers"
  ON printers FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own printers"
  ON printers FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- ============================================================
-- TABLA: print_files
-- ============================================================
CREATE TABLE IF NOT EXISTS print_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL, -- 3mf, gcode
  file_size BIGINT NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_file_type CHECK (file_type IN ('3mf', 'gcode'))
);

CREATE INDEX idx_print_files_user_id ON print_files(user_id);
CREATE INDEX idx_print_files_created_at ON print_files(created_at DESC);

-- RLS para print_files
ALTER TABLE print_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view files"
  ON print_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can upload files"
  ON print_files FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All authenticated users can delete files"
  ON print_files FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TABLA: bridge_status
-- ============================================================
CREATE TABLE IF NOT EXISTS bridge_status (
  id BIGINT PRIMARY KEY DEFAULT 1,
  is_connected BOOLEAN DEFAULT false,
  last_update TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT single_row CHECK (id = 1)
);

-- RLS para bridge_status
ALTER TABLE bridge_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view bridge status"
  ON bridge_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can update bridge status"
  ON bridge_status FOR UPDATE USING (true);

-- Insert initial row
INSERT INTO bridge_status (id, is_connected) 
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================

-- Crear publicación si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Agregar tablas a la publicación de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS printers;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS print_files;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS bridge_status;
