# 📖 Manga Reader v2.5 — Guardar capítulos

Guarda el capítulo de manga que tenés abierto como PDF (y/o imágenes sueltas), sin las páginas de publicidad.

## Instalación

1. Descomprimí el ZIP
2. `chrome://extensions/` → Modo desarrollador ON → **Cargar descomprimida**
3. Si actualizás desde una versión anterior: botón 🔄 en la extensión y **recargá la página del manga (F5)**

## Uso

1. Abrí el capítulo
2. `Alt+S`, o clic derecho → **Guardar capítulo (PDF / CBZ)**, o el ícono de la extensión
3. Escribí el nombre del tomo y dale a **Guardar**

El nombre se arma solo a partir del título de la página: serie, saga (por ahora solo One Piece) y número con ceros adelante para que ordene bien, por ejemplo `One Piece/11 Saga Final/One Piece 1134`. Podés editarlo antes de guardar.

Usá `/` en el nombre para armar carpetas: `One Piece/Tomo 110` → `Descargas/MangaReader/One Piece/Tomo 110.pdf`.
La extensión recuerda la carpeta de la serie para cada sitio.

## Burbuja flotante

En las páginas que parecen un capítulo aparece una burbuja 💾.

- **Clic**: abre "Guardar capítulo"
- **Arrastrar**: la movés a donde no moleste; recuerda la posición
- **i**: muestra los controles rápidos y el botón para ocultarla
- Se activa o desactiva desde el ícono de la extensión

## Avisos

- **✔ Ya lo guardaste**: la extensión recuerda cada capítulo guardado completo (con todas sus páginas) y te avisa al abrir el diálogo, aunque le cambies el nombre.
- **⚠️ Pueden faltar páginas**: si no llegaste al final de la página o alguna página del capítulo no cargó. El botón **Recorrer la página** baja sola hasta el final, espera a que carguen las imágenes y vuelve a donde estabas.
- Las imágenes que el navegador todavía no bajó se cargan y se incluyen solas, y el conteo se actualiza a medida que aparecen páginas nuevas.

## Filtro de publicidad

El diálogo muestra una miniatura por cada imagen encontrada. Las que no parecen del capítulo vienen destildadas y con la etiqueta **AD**:

- imágenes fuera de la carpeta donde está la mayoría de las páginas (logos, banners)
- imágenes que son un link a otro sitio
- GIF animados
- últimas páginas con un formato distinto al resto (créditos o avisos del scan)

Hacé clic en cualquier miniatura para incluirla o quitarla. Pasá el mouse por encima para ver el motivo.

## CBZ (para lectores de cómics)

Tildá **📚 CBZ** en el diálogo. Es el formato estándar de las apps de cómics en tablet.

- Lleva las imágenes originales sin tocar (sin recomprimir ni convertir), numeradas `001`, `002`…
- Incluye `ComicInfo.xml` con serie, número, saga y sentido de lectura derecha → izquierda, que muchos lectores usan para ordenar la biblioteca
- La extensión recuerda qué formatos tildaste

CBR no está disponible: es un RAR, formato propietario que no se puede generar desde una extensión.

## El PDF

- Una página por imagen, con su tamaño original
- Las JPG se incrustan sin recomprimir; WebP/PNG se convierten a JPG de alta calidad
- El nombre del tomo queda como título, y está marcado como lectura derecha → izquierda

El atajo se puede cambiar en `chrome://extensions/shortcuts`.
