-- Tabla para almacenar telemetría de impresoras (temperatura, etc)
CREATE TABLE printer_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  temperature DECIMAL(5, 2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para queries rápidas
CREATE INDEX idx_printer_telemetry_printer_id ON printer_telemetry(printer_id);
CREATE INDEX idx_printer_telemetry_timestamp ON printer_telemetry(timestamp DESC);
CREATE INDEX idx_printer_telemetry_latest ON printer_telemetry(printer_id, timestamp DESC);

-- Habilitar RLS
ALTER TABLE printer_telemetry ENABLE ROW LEVEL SECURITY;

-- Política: usuarios ven telemetría solo de sus impresoras
CREATE POLICY "Users can view their printer telemetry"
  ON printer_telemetry FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM printers 
      WHERE printers.id = printer_telemetry.printer_id 
      AND printers.user_id = auth.uid()
    )
  );

-- Política: solo sistema puede insertar (sin restricción de usuario, confiamos en el servidor)
-- Si quieres restricción, descomenta:
-- CREATE POLICY "System can insert telemetry"
--   ON printer_telemetry FOR INSERT
--   WITH CHECK (true);
