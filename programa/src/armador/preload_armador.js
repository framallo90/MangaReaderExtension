// Lo único que el armador puede pedirle al proceso principal: escribir un archivo del
// trabajo en curso y avisar el progreso.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mrArmador', {
  guardar: (jobId, rel, bytes) => ipcRenderer.invoke('armador:guardar', { jobId, rel, bytes }),
  progreso: (m) => ipcRenderer.send('armador:progreso', m),
});
