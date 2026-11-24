/**
 * Handlers IPC para operaciones de impresoras
 * Mapea llamadas desde React a métodos del PrinterFarmManager
 */
const { ipcMain } = require('electron');

function setupPrinterHandlers(ipcMain, farmManager, mainWindow) {
  /**
   * printer:connect
   * React envía config de impresora, Electron conecta
   */
  ipcMain.handle('printer:connect', async (event, printerConfig) => {
    console.log('[IPC] printer:connect', printerConfig.name);
    return await farmManager.connectPrinter(printerConfig);
  });

  /**
   * printer:disconnect
   * Desconectar impresora específica
   */
  ipcMain.handle('printer:disconnect', async (event, printerId) => {
    console.log('[IPC] printer:disconnect', printerId);
    return await farmManager.disconnectPrinter(printerId);
  });

  /**
   * printer:pause
   * Pausar impresión
   */
  ipcMain.handle('printer:pause', async (event, printerId) => {
    console.log('[IPC] printer:pause', printerId);
    return await farmManager.executeCommand(printerId, 'pause');
  });

  /**
   * printer:resume
   * Reanudar impresión
   */
  ipcMain.handle('printer:resume', async (event, printerId) => {
    console.log('[IPC] printer:resume', printerId);
    return await farmManager.executeCommand(printerId, 'resume');
  });

  /**
   * printer:stop
   * Detener impresión
   */
  ipcMain.handle('printer:stop', async (event, printerId) => {
    console.log('[IPC] printer:stop', printerId);
    return await farmManager.executeCommand(printerId, 'stop');
  });

  /**
   * printer:upload-file
   * Subir archivo e iniciar impresión
   */
  ipcMain.handle('printer:upload-file', async (event, { printerId, filePath, fileName }) => {
    console.log('[IPC] printer:upload-file', { printerId, fileName });
    return await farmManager.executeCommand(printerId, 'print', {
      filePath,
      fileName,
    });
  });

  /**
   * printer:camera-start
   * Iniciar stream de cámara
   */
  ipcMain.handle('printer:camera-start', async (event, printerId) => {
    console.log('[IPC] printer:camera-start', printerId);
    return await farmManager.executeCommand(printerId, 'camera:start', {});
  });

  /**
   * printer:camera-stop
   * Detener stream de cámara
   */
  ipcMain.handle('printer:camera-stop', async (event, printerId) => {
    console.log('[IPC] printer:camera-stop', printerId);
    return await farmManager.executeCommand(printerId, 'camera:stop', {});
  });

  /**
   * farm:status
   * Obtener estado global de la granja
   */
  ipcMain.handle('farm:status', async (event) => {
    return farmManager.getStatus();
  });

  console.log('[Handlers] Printer handlers instalados');
}

module.exports = {
  setupPrinterHandlers,
};
