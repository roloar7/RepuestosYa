-- Ejemplos de datos para printers con multi-protocolo
-- Usar para testing y referencia

-- ============================================================
-- BAMBU LAB A1 (LAN local)
-- ============================================================
INSERT INTO printers (
  user_id,
  name,
  ip,
  protocol,
  credentials,
  agent_location,
  status
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Ajustar según usuario real
  'A1 Mini - Nave 1',
  '192.168.0.100',
  'bambu_lan',
  jsonb_build_object(
    'access_code', '4E5A4F36',
    'serial_number', '0M11PC250134E9CE',
    'model', 'A1'
  ),
  'nave-1',
  'idle'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- BAMBU LAB P1S (LAN local, otra ubicación)
-- ============================================================
INSERT INTO printers (
  user_id,
  name,
  ip,
  protocol,
  credentials,
  agent_location,
  status
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'P1S - Nave 2',
  '192.168.0.101',
  'bambu_lan',
  jsonb_build_object(
    'access_code', '4E5A4F37',
    'serial_number', '0M11PC250134E9CF',
    'model', 'P1S'
  ),
  'nave-2',
  'offline'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- KLIPPER/CREALITY (futuro - placeholder)
-- ============================================================
-- INSERT INTO printers (
--   user_id,
--   name,
--   ip,
--   protocol,
--   credentials,
--   agent_location,
--   status
-- ) VALUES (
--   (SELECT id FROM auth.users LIMIT 1),
--   'Creality K1 - Remote',
--   '192.168.1.50',
--   'klipper_moonraker',
--   jsonb_build_object(
--     'api_token', 'mkask_...',
--     'model', 'K1',
--     'firmware', 'Klipper'
--   ),
--   'remote-office',
--   'idle'
-- ) ON CONFLICT DO NOTHING;

-- ============================================================
-- Consultas útiles para testing
-- ============================================================

-- Ver todas las impresoras por protocolo
-- SELECT name, protocol, ip, agent_location, status FROM printers;

-- Ver detalles de credenciales para Bambu
-- SELECT name, ip, credentials->>'access_code' as access_code, credentials->>'serial_number' as serial FROM printers WHERE protocol = 'bambu_lan';

-- Ver impresoras por ubicación
-- SELECT name, agent_location, status FROM printers WHERE agent_location = 'nave-1';

-- Actualizar status de impresora
-- UPDATE printers SET status = 'printing', updated_at = NOW() WHERE name = 'A1 Mini - Nave 1';

-- Verificar estructura JSONB
-- SELECT name, jsonb_pretty(credentials) FROM printers WHERE protocol = 'bambu_lan';\n"})
</invoke>