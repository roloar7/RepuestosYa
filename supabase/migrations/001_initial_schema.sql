-- ============================================================
-- MIGRACIÓN 001: Schema Inicial de RepuestosYa
-- Esta es la migración única que consolida toda la estructura
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
  
  status VARCHAR(20) DEFAULT 'offline',
  last_seen_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('idle', 'printing', 'paused', 'offline', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_printers_user_id ON printers(user_id);
CREATE INDEX IF NOT EXISTS idx_printers_ip ON printers(ip);
CREATE INDEX IF NOT EXISTS idx_printers_serial ON printers(serial_number);
CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all printers" ON printers;
CREATE POLICY "Users can view all printers"
  ON printers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own printers" ON printers;
CREATE POLICY "Users can insert own printers"
  ON printers FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own printers" ON printers;
CREATE POLICY "Users can update own printers"
  ON printers FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own printers" ON printers;
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
  file_type VARCHAR(10) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_file_type CHECK (file_type IN ('3mf', 'gcode'))
);

CREATE INDEX IF NOT EXISTS idx_print_files_user_id ON print_files(user_id);
CREATE INDEX IF NOT EXISTS idx_print_files_created_at ON print_files(created_at DESC);

ALTER TABLE print_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view files" ON print_files;
CREATE POLICY "All authenticated users can view files"
  ON print_files FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "All authenticated users can upload files" ON print_files;
CREATE POLICY "All authenticated users can upload files"
  ON print_files FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "All authenticated users can delete files" ON print_files;
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

ALTER TABLE bridge_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view bridge status" ON bridge_status;
CREATE POLICY "All authenticated users can view bridge status"
  ON bridge_status FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can update bridge status" ON bridge_status;
CREATE POLICY "Service role can update bridge status"
  ON bridge_status FOR UPDATE USING (true);

INSERT INTO bridge_status (id, is_connected) 
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS printers;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS print_files;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS bridge_status;
