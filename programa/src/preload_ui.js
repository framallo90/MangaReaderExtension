// Lo que la interfaz puede pedirle al programa. Cada pedido devuelve el valor o tira un
// Error con el mensaje listo para mostrar.
const { contextBridge, ipcRenderer } = require('electron');
const pedir = async (canal, arg) => {
  const r = await ipcRenderer.invoke(canal, arg);
  if (!r || !r.ok) throw new Error((r && r.error) || 'El programa no respondió');
  return r.valor;
};
contextBridge.exposeInMainWorld('mr', {
  analizar: (url) => pedir('analizar', url),
  seguir: (url, max, conocidas) => pedir('seguir', { url, max, conocidas }),
  alAvanzar: (fn) => { ipcRenderer.on('avance', (_e, texto) => fn(texto)); },
  links: (texto, modo, desde) => pedir('links', { texto, modo, desde }),
  descargar: (items, opciones) => pedir('descargar', { items, opciones }),
  cancelar: () => pedir('cancelar'),
  limpiar: () => pedir('limpiar'),
  config: () => pedir('config:leer'),
  guardarConfig: (c) => pedir('config:guardar', c),
  saga: (serie, numero) => pedir('saga', { serie, numero }),
  elegirCarpeta: () => pedir('carpeta'),
  abrirCarpeta: () => pedir('abrir-carpeta'),
  // (entre llaves: no devuelve nada. Lo que devuelve ipcRenderer.on no se puede pasar a la página)
  alCambiarCola: (fn) => { ipcRenderer.on('cola', (_e, cola) => fn(cola)); },
});
