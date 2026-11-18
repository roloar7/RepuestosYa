/**
 * Factory de Drivers
 * Crear la instancia correcta según el protocolo
 */
const BambuDriver = require('./BambuDriver');

/**
 * Crear driver según protocolo
 * @param {string} protocol - 'bambu_lan', 'klipper_moonraker', etc.
 * @param {object} printerConfig - Configuración de la impresora
 * @returns {BasePrinterDriver} Instancia del driver
 */
function createPrinterDriver(protocol, printerConfig) {
  switch (protocol) {
    case 'bambu_lan':
      return new BambuDriver(printerConfig);

    // case 'klipper_moonraker':
    //   return new MoonrakerDriver(printerConfig);

    default:
      throw new Error(`Protocolo no soportado: ${protocol}`);
  }
}

module.exports = {
  createPrinterDriver,
  BambuDriver,
  // MoonrakerDriver será importado cuando esté implementado
};
