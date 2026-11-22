# 📖 Manga Reader — programa de escritorio

Explora una página web por niveles (títulos → capítulos → páginas) y guarda los capítulos que elijas como **PDF**, **CBZ** o **imágenes**, en la carpeta que quieras.

Todo corre en tu máquina: no hay servidor ni cuenta. Es independiente de la extensión de Chrome y usa su mismo código para detectar páginas, armar nombres y generar los archivos.

**Estado: versión 0.2.0.** Funciona de punta a punta sobre los sitios de prueba. Todavía no tiene instalador: se abre con `npm start`. Los cambios de cada versión están en las [Actualizaciones](../README.md#actualizaciones) del README principal.

## Cómo abrirlo

Hace falta [Node.js](https://nodejs.org) 22 o más nuevo.

```bash
cd programa
npm install      # una sola vez: baja Electron (unos 370 MB)
npm start
```

## Cómo se usa

1. **Pegá una dirección** arriba y tocá **Analizar**. Puede ser la portada de un sitio, un catálogo, la página de una serie o un capítulo.
   - **Si es la portada de un sitio** y tiene un link a su listado completo ("Directorio", "Biblioteca", "Catálogo"), entra ahí solo: la portada suele mostrar apenas lo destacado. Para ver la portada, volvé por la ruta de arriba.
   - En las demás páginas, ese link aparece como acceso rápido: **¿Buscás el listado completo?**
2. **Mirá lo que encontró.** Antes de leer los links, baja hasta el final de la página, para que aparezca lo que carga de a poco. Cada pestaña es una lista de links de esa página:
   - **Capítulos:** links numerados, en orden. Si la página los separa en volúmenes o sagas, aparecen agrupados y se puede tildar el grupo entero.
   - **Títulos y links:** los demás links, agrupados por la carpeta de su dirección. Acá suelen estar las series de un catálogo.
3. **Bajá un nivel** con la flecha **›** de cualquier renglón: abre esa página y la analiza. La ruta de arriba recuerda por dónde entraste y sirve para volver.
4. **Si el listado sigue en más páginas**, aparece **Traer más páginas**: lee las 10 siguientes, con una pausa entre cada una, y suma lo que encuentra a la lista, sin repetir. Se puede tocar de nuevo hasta llegar al final.
5. **Tildá lo que querés**, elegí formatos y carpeta a la derecha, y tocá **Descargar**. Va a la cola.

Otras formas de cargar capítulos:

- **Si la página es un capítulo**, aparece una tarjeta con **Descargar este capítulo**.
- **Pegar links:** el botón de arriba abre un cuadro para pegar una lista de links como la tengas. Cada uno queda con su número, igual que en la extensión.

### Nombres y carpetas

- Los archivos salen como `Serie/Saga/Serie 0012.pdf`, igual que en la extensión.
- **Serie** vacía: la serie sale del título de cada capítulo. Si la escribís, se usa esa.
- El número es el de la lista. Si la lista no tiene número, sale del título del capítulo.
- **Saltear lo que ya está en la carpeta** mira el disco. Si lo destildás, no pisa nada: guarda `nombre (1).pdf`.

### La cola

Baja de a un capítulo, con una pausa entre uno y otro. Cada renglón dice en qué anda y, si falló, por qué. **Cancelar** corta lo que falta.

## Qué no hace todavía

- **No tiene instalador** ni ícono propio.
- **No deja elegir páginas sueltas** dentro de un capítulo: usa el filtro de publicidad automático.
- **No comparte las sagas** que cargaste en la extensión: usa solo las incluidas.
- **No lleva un registro de guardados** aparte: para saltear, mira el disco.
- **No recorre un sitio entero** de un saque: va nivel por nivel, y "Traer más páginas" suma de a 10 páginas por vez.
- **Encuentra el catálogo por el nombre del link.** Si el sitio lo llama de otra forma, hay que entrar a mano con la flecha ›.
- **Un listado que carga al bajar** se recorre hasta 30 pantallas. Si seguía creciendo, avisa que puede faltar algo.
- **No guarda páginas protegidas** (las que un sitio entrega cifradas): en esos casos dice que no encontró páginas.

## Cómo está armado

| Carpeta o archivo | Qué es |
|---|---|
| `src/main.js` | El proceso principal: abre las páginas en ventanas ocultas, maneja la cola y escribe los archivos |
| `src/pagina/explorar.js` | El explorador: corre dentro de cada página y devuelve sus listas de links |
| `src/armador/` | Ventana oculta que baja las imágenes y arma PDF, CBZ e imágenes |
| `src/ui/` | La interfaz |
| `src/preload_ui.js` | Lo único que la interfaz puede pedirle al programa |
| `scripts/generar.js` | Arma `generado/` con el código de la última versión de la extensión |
| `scripts/abrir.js` | Genera y lanza Electron |
| `generado/` | Se crea solo al abrir. No se edita ni se sube al repositorio |
| `tests/` | El sitio de prueba y las pruebas |

- **El código compartido no se copia a mano.** `generar.js` saca de la extensión las funciones de detección, nombres y capítulos (`content.js`) y el armado de archivos (`offscreen.js`). Un arreglo en la extensión llega al programa la próxima vez que se abre.
- **Las páginas web corren aisladas:** sin acceso a Node ni al disco, sin poder abrir ventanas, bajar archivos por su cuenta ni pedir permisos.
- **Las imágenes se piden con el Referer del capítulo,** como lo haría el navegador. Hay servidores que sin eso contestan 403.

## Pruebas

```bash
npm run prueba
```

Corren dentro de Electron contra un sitio de prueba servido en la máquina: exploran portada, catálogo paginado, directorio que carga al bajar, serie y capítulo; bajan capítulos en los tres formatos a una carpeta temporal; y manejan la interfaz. Son 38 comprobaciones.

Con `CAPTURAS=<carpeta>` guardan además una captura de la interfaz.
