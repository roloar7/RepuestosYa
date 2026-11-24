-- Migration: Add protocol and credentials columns to printers table
-- Date: 2026-11-18
-- Description: Support multi-protocol printers (Bambu, Klipper, etc.)

ALTER TABLE public.printers
ADD COLUMN protocol VARCHAR(50) NOT NULL DEFAULT 'bambu_lan',
ADD COLUMN credentials JSONB DEFAULT '{}'::jsonb,
ADD COLUMN agent_location VARCHAR(100),
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for protocol lookups
CREATE INDEX idx_printers_protocol ON public.printers(protocol);

-- Create index for agent location lookups (multi-agente futuro)
CREATE INDEX idx_printers_agent_location ON public.printers(agent_location);

-- Add comment explaining credentials JSONB structure
COMMENT ON COLUMN public.printers.credentials IS
'JSONB object storing protocol-specific credentials. Examples:
Bambu Lab: { "access_code": "XXXXXX", "serial_number": "0M11XXXX", "model": "A1" }
Klipper: { "api_token": "...", "model": "K1" }';

COMMENT ON COLUMN public.printers.protocol IS
'Printer protocol type. Supported: "bambu_lan", "klipper_moonraker"';

COMMENT ON COLUMN public.printers.agent_location IS
'Physical location or identifier of the agent managing this printer. Examples: "nave-1", "nave-2", "remote", "office"';\n"})
</invoke>