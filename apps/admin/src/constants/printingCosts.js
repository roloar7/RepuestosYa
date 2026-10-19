/**
 * Costos de producción para impresión 3D.
 * Estos valores son la base del cálculo de la Calculadora de costos.
 */

// Precio por kilogramo de filamento según material
export const MATERIALS = {
  PLA: { id: "PLA", label: "PLA", pricePerKg: 18000 },
  PETG: { id: "PETG", label: "PETG", pricePerKg: 21000 },
  ABS: { id: "ABS", label: "ABS", pricePerKg: 23000 },
}

// Precio por hora de impresión
export const PRICE_PER_HOUR = 500

// Precio por hora de post-procesado / mano de obra
export const POST_PROCESSING_PRICE_PER_HOUR = 3500

// Margen de ganancia por defecto (%)
export const DEFAULT_PROFIT_MARGIN = 120

export const materialList = Object.values(MATERIALS)
