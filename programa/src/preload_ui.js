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
  // Busca con el buscador del propio sitio: { plantilla | pagina, texto, conocidas }. Devuelve lo mismo que analizar
  buscarEnSitio: (dato) => pedir('buscar-en-sitio', dato),
  alAvanzar: (fn) => { ipcRenderer.on('avance', (_e, texto) => fn(texto)); },
  links: (texto, modo, desde) => pedir('links', { texto, modo, desde }),
  descargar: (items, opciones) => pedir('descargar', { items, opciones }),
  cancelar: () => pedir('cancelar'),
  limpiar: () => pedir('limpiar'),
  config: () => pedir('config:leer'),
  guardarConfig: (c) => pedir('config:guardar', c),
  saga: (serie, numero) => pedir('saga', { serie, numero }),
  // Favoritos: la lista, sumar uno ({ sitio: {nombre, url} }) o una lista pegada ({ texto }), y quitar
  guardados: () => pedir('guardados:leer'),
  guardarLinks: (dato) => pedir('guardados:agregar', dato),
  quitarLinks: (urls) => pedir('guardados:quitar', urls),
  // La miniatura (data:) de la imagen que acompaña a un título; `pagina` es de dónde salió
  tapa: (url, pagina) => pedir('tapa', { url, pagina }),
  reintentar: () => pedir('reintentar'),                    // vuelve a la cola lo que falló, quedó incompleto o se canceló
  paginas: (url) => pedir('paginas', url),                  // todas las imágenes de un capítulo, con lo marcado como publicidad
  disco: (pedido) => pedir('disco', pedido),                // qué capítulos de una serie ya están en la carpeta: { serie, numeros, formatos }
  vistaPlantilla: (texto) => pedir('plantilla:vista', texto),
  revisarSagas: (texto) => pedir('sagas:revisar', texto),
  reciente: (dato) => pedir('reciente', dato),              // anota una dirección analizada a mano: { url, titulo }
  titulos: (pedido) => pedir('titulos', pedido),            // de una lista de títulos, de cuáles ya tenés algo: { nombres }
  registro: () => pedir('registro:leer'),                   // lo que se bajó con el programa, por serie
  quitarDelRegistro: (clave) => pedir('registro:quitar', clave),
  agregarBiblioteca: () => pedir('biblioteca:agregar'),     // suma una carpeta de tu colección (abre el diálogo para elegirla)
  quitarBiblioteca: (carpeta) => pedir('biblioteca:quitar', carpeta),
  carpetas: () => pedir('carpetas'),                        // { sinMirar }: carpetas que hoy no están a la vista
  vincular: (serie, carpeta) => pedir('vincular', { serie, carpeta }),   // ata una carpeta a una serie (sin carpeta: la elige con el diálogo)
  desvincular: (serie) => pedir('desvincular', serie),
  // Series seguidas: la lista, seguir ({ url, serie }), dejar de seguir, buscar lo nuevo y bajarlo
  seguidas: () => pedir('seguidas:leer'),
  seguirSerie: (dato) => pedir('seguidas:seguir', dato),
  dejarDeSeguir: (url) => pedir('seguidas:dejar', url),
  buscarNovedades: () => pedir('seguidas:buscar'),
  bajarNovedades: (url) => pedir('seguidas:bajar', url),
  elegirCarpeta: () => pedir('carpeta'),
  abrirCarpeta: () => pedir('abrir-carpeta'),
  // (entre llaves: no devuelve nada. Lo que devuelve ipcRenderer.on no se puede pasar a la página)
  alCambiarCola: (fn) => { ipcRenderer.on('cola', (_e, cola) => fn(cola)); },
  // (0.11.0) La galería del sitio: todos los títulos de su listado, con su tapa
  galeria: {
    de: (url) => pedir('galeria:de', url),                                  // la guardada del sitio de esa dirección, o null (no recorre nada)
    marcas: (sitio) => pedir('galeria:marcas', sitio),                      // solo lo que ya tenés de cada título: [[dirección, marca]]
    recorrer: (pedido) => pedir('galeria:recorrer', pedido),                // { url, tope, modo: 'nueva' | 'refrescar' | 'seguir' }
    cancelar: () => pedir('galeria:cancelar'),
    marcar: (pedido) => pedir('galeria:marcar', pedido),                    // { sitio, urls, marcada }
    buscarNuevo: (sitio) => pedir('galeria:buscar-nuevo', sitio),           // lo nuevo de las series marcadas
    encolarNuevo: (sitio) => pedir('galeria:encolar-nuevo', sitio),
    olvidar: (sitio) => pedir('galeria:olvidar', sitio),
    alAvanzar: (fn) => { ipcRenderer.on('galeria', (_e, evento) => fn(evento)); },
  },
  // (0.10.4) Se abrió el programa otra vez con el proxy de prueba y esta ventana no lo usa: { proxy, actual }
  alPedirProxy: (fn) => { ipcRenderer.on('aviso-proxy', (_e, d) => fn(d)); },
  reabrirConProxy: () => pedir('reabrir-con-proxy'),
});
