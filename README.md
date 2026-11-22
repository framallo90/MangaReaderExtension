# 📖 Manga Reader

Extensión de Chrome para guardar capítulos de manga y cómics como **PDF**, **CBZ** o **imágenes sueltas**, de a uno o varios seguidos, con nombre y carpetas automáticos y sin las páginas de publicidad.

Es de uso personal, está en español y no tiene dependencias ni compilación: es JavaScript plano (Manifest V3).

**Versión actual: 2.9.0** → carpeta `manga-reader-ext(ver 22-11-2026-5)/manga-reader-ext`

---

## Qué hace

| | |
|---|---|
| 💾 **Guardar el capítulo abierto** | Detecta las páginas, arma el nombre y lo guarda en el formato que elijas |
| 📦 **Descargar varios capítulos** | Un rango ("del 1 al 50"), los que tildes en la lista, o una lista de links pegada |
| 🧹 **Filtro de publicidad** | Deja afuera logos, banners, avisos y páginas de créditos; se corrige con un clic en las miniaturas |
| 🗂 **Nombre y carpetas automáticos** | `Serie/Saga/Serie 0012`, con ceros adelante para que ordenen bien |
| ✔ **Registro de guardados** | Avisa lo que ya guardaste, lo saltea en los lotes y muestra los capítulos que te faltan |
| 📚 **Tu lista de sitios** | Accesos directos a tus sitios, divididos en descargables y para leer, con filtros |

---

## Instalación

No está en la tienda de Chrome: se carga a mano.

1. Bajá el repositorio: **Code → Download ZIP** y descomprimilo, o `git clone`.
2. Abrí `chrome://extensions` y activá **Modo desarrollador** (arriba a la derecha).
3. Tocá **Cargar descomprimida** y elegí la carpeta de la versión más nueva:

   ```
   manga-reader-ext(ver 22-11-2026-5)/manga-reader-ext
   ```

4. Fijá el ícono de la extensión en la barra para tenerlo a mano.

Funciona en Chrome de escritorio y en navegadores basados en Chromium que acepten extensiones descomprimidas.

### Actualizar a una versión nueva

Cada versión vive en su propia carpeta, así que actualizar es cargar otra carpeta:

1. En la versión que tenés cargada: ícono → **⚙️ Guardados, sagas, sitios y opciones** → **Exportar copia**. Al quitar la extensión se borra su registro, y la copia lo conserva.
2. En `chrome://extensions`, quitá la tarjeta vieja y cargá la carpeta nueva con **Cargar descomprimida**.
3. En la versión nueva: ⚙️ → **Importar copia**.

No hace falta recargar las pestañas abiertas.

> **Ojo con el nombre de las carpetas:** la más nueva no siempre es la última por orden alfabético. `manga-reader-ext(ver 22-11-2026)`, sin sufijo, es una versión vieja (2.6) que no funciona. La versión de cada carpeta está en su `manifest.json`, y `node tests/ultima_version.js` dice cuál es la última.

---

## Cómo se usa

### Guardar un capítulo

1. Abrí el capítulo.
2. Apretá `Alt+S`, o la burbuja 💾, o clic derecho → **Guardar capítulo**, o el ícono de la extensión.
3. Revisá el nombre y las miniaturas, y tocá **Guardar** (`Enter`).

- **El nombre se arma solo** con el título de la página: serie, saga y número. Se puede editar; cada `/` crea una carpeta.
- **La página se recorre sola** hasta el final para que carguen todas las imágenes, y vuelve a donde estabas.
- **Las miniaturas** muestran cada imagen encontrada. Las que parecen publicidad vienen destildadas con la etiqueta **AD**. Un clic incluye o quita cualquiera.
- **Guardar y siguiente ▶** (`Ctrl+Enter`) guarda y abre el capítulo que sigue, con el diálogo ya listo.
- Los archivos van a `Descargas/MangaReader/…`.

### Descargar varios capítulos

Ícono de la extensión → **📦 Descargar varios capítulos**. Funciona desde la página de un capítulo y desde la portada o el listado de la serie.

1. Escribí **Del … al …** y tocá **Marcar**, o tildá capítulos en la lista.
2. Elegí los formatos.
3. Tocá **Descargar**. El mismo botón después dice **Cancelar**.

Cada capítulo se abre solo en una pestaña al lado, se guarda con el mismo filtro y los mismos nombres que a mano, y la pestaña se cierra. Dejá abierta la pestaña desde donde lo iniciaste.

- **De dónde sale la lista:** de los links de la página, de un desplegable de capítulos, o de la dirección del capítulo si lleva el número al final.
- **Los ya guardados** figuran con ✔ y se saltean.
- **Al terminar** dice cuántos salieron y, de los que no, por qué.
- **Si 3 seguidos no tienen páginas**, el lote para solo en vez de seguir abriendo pestañas.

### Pegar los links de los capítulos

Para cuando la lista no aparece sola, o ya tenés los links. En el mismo diálogo, abrí **Pegar los links de los capítulos**.

1. Pegá los links como los tengas: uno por renglón o todos juntos. Lo que no sea un link (títulos, texto suelto) se ignora.
2. Tocá **Usar estos links**. Quedan en la lista, marcados, cada uno con su número:
   - el que escribas adelante (`12: link`),
   - o el que trae el propio link (`…-manga-07-espanol.html` es el 7),
   - o, si no lo traen, el orden en que los pegaste, desde el número que elijas. También al revés, para listas que van del último al primero.
3. Escribí el nombre en **Serie**: los archivos salen como `Serie/Serie 0007`.
4. Tocá **Descargar**.

Abajo del cuadro dice cuántos links tomó, qué números faltan en el medio y cuántos estaban repetidos.

### Formatos

| Formato | Qué guarda |
|---|---|
| **PDF** | Una página por imagen, en su tamaño original. JPG y PNG van sin recomprimir; WebP se convierte a JPG de alta calidad. Marcado para leer de derecha a izquierda |
| **CBZ** | El formato de las apps de cómics: las imágenes originales numeradas y un `ComicInfo.xml` con serie, número y saga |
| **Imágenes** | Las originales en una carpeta, como `pagina_001.jpg`, con la extensión de su tipo real |

Los tres se pueden combinar: cada página se baja una sola vez.

### Burbuja flotante

En las páginas que parecen un capítulo aparece una burbuja 💾.

- **Clic:** abre "Guardar capítulo".
- **Arrastrar:** la movés a donde no moleste, y recuerda la posición.
- **i:** accesos rápidos, **No mostrar en este sitio** y **Ocultar en todos lados**.

### Tu lista de sitios

Ícono de la extensión → **📚 Sitios de manga y cómics**. La extensión no trae sitios cargados: la lista es la tuya.

- **Para cargarla:** ⚙️ → **Mis sitios de manga y cómics** → **Pegar una lista**. Se pega el texto como venga, con una dirección por renglón, y se detectan solos el nombre, la descripción, el tipo y el idioma.
- **Dos secciones:** 📥 Descargables y 👁 Para leer en el sitio, que se pliegan tocando el título.
- **Filtros** por tipo (manga, cómics) e idioma, y un buscador.
- **Tocar el nombre** abre el sitio en una pestaña nueva. La **i** muestra qué tiene.

### Guardados, sagas y opciones

Ícono de la extensión → **⚙️ Guardados, sagas, sitios y opciones**.

- **Capítulos guardados** por serie, con los que te faltan en el medio. **Exportar copia** e **Importar copia** para no perder el registro.
- **Sagas:** para que los capítulos de una serie se guarden en una carpeta por saga. Se cargan una por línea (`desde-hasta Nombre`).
- **Mis sitios:** pegar la lista, y agregar, editar o quitar de a uno.
- **Sitios donde la burbuja no aparece.**

El atajo `Alt+S` se cambia en `chrome://extensions/shortcuts`.

---

## Qué no hace

- **No guarda páginas protegidas.** Si un sitio entrega las páginas cifradas y su lector las arma en el momento, la extensión lo reconoce, lo avisa con 🔒 y no las guarda.
- **No adivina direcciones.** Si la dirección de un capítulo no lleva su número y la página no tiene links a los capítulos, el diálogo lo explica en vez de inventar una. Para eso está pegar los links.
- **No lee dentro de iframes** ni imágenes puestas como fondo.
- **No mira el disco:** si borrás un archivo a mano, el registro sigue diciendo que lo guardaste hasta que lo quites en opciones.

Usala con contenido que tengas derecho a guardar.

---

## Qué hay en el repositorio

| Carpeta o archivo | Qué es |
|---|---|
| `manga-reader-ext(ver DD-MM-AAAA)/manga-reader-ext/` | Una carpeta por versión, lista para cargar en Chrome. Cada una trae su `README.md` y su `DOCUMENTACION.md` |
| `DOCUMENTACION.md` | La referencia completa de la última versión: arquitectura, mensajes, formatos, constantes, limitaciones, solución de problemas e historial |
| `tests/` | Las pruebas |
| `reports/`, `research_notes/` | Un estudio de sitios legítimos de manga y cómics y sus fuentes |

Dentro de cada versión:

| Archivo | Rol |
|---|---|
| `manifest.json` | Permisos, atajo y scripts |
| `content.js` | Detección de páginas, filtro, nombres, lista de capítulos, diálogos y burbuja |
| `background.js` | Service worker: menú, atajo, descargas y lotes |
| `offscreen.js` | Baja las páginas y arma PDF, CBZ e imágenes, sin librerías |
| `popup.*`, `opciones.*` | El menú del ícono y la página de guardados, sagas, sitios y opciones |
| `sagas.js`, `sitios.js` | Sagas incluidas y funciones de la lista de sitios |

---

## Pruebas

No hacen falta dependencias: alcanza con Node 22 o más nuevo.

```bash
bash tests/correr.sh        # sintaxis y pruebas en Node contra la última versión
node tests/e2e.js           # navegador real, sobre sitios de prueba servidos en la máquina
node tests/lote_largo.js    # un lote de decenas de capítulos seguidos
```

- Las pruebas en navegador necesitan el Chromium de Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*`) o el de la variable `CHROMIUM`. El Chrome común ya no acepta cargar extensiones por línea de comandos.
- `node tests/probar_sitio.js "<dirección>"` informa qué detecta la extensión en una página, sin dejar archivos.
- Todas las descargas de las pruebas van a una carpeta temporal que se borra al terminar.

## Cómo se cambia algo

Las versiones no se editan: se copia la última carpeta a una nueva con la fecha del día, se sube `version` en `manifest.json` y se trabaja ahí. Con cada versión se actualiza su `DOCUMENTACION.md` y se copia a la raíz. El detalle está en la sección 13 de [DOCUMENTACION.md](DOCUMENTACION.md).
