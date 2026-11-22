# Notas: lista de sitios de manga, manhwa y webtoon (21-11-2026)

`manga.json` tiene **41 sitios**. Para cada uno se pidió la portada el 21-11-2026 (WebFetch o curl). Solo hay sitios oficiales, de editoriales o distribuidores con licencia, de bibliotecas, tiendas sin DRM o comunidades de autores.

## Revisión de los ya conocidos

Los 17 siguen andando. WEBTOON quedó en dos entradas, inglés y español.

- **Tapas:** sigue en línea, pero **cierra el 31-03-2027** y no deja acceso a lo comprado. Tiene una sección "Léelo en español", así que figura con `es`.
- **K MANGA:** el sitio responde, pero muestra "This service is not available in your region": solo funciona en EE. UU. y Japón.
- **MANGA Plus:** es una aplicación de una sola página. Cargó, pero solo devolvió el título. Sus términos siguen sin poder leerse, así que `guardar` queda sin verificar.
- **MANGA MILLION:** tiene web con versión en español (`/es`). El comunicado dice "por tiempo limitado" sin fecha de fin. Un resumen de búsqueda habló de fines de 2027, pero ninguna fuente que abrí lo confirma.
- **Humble Bundle:** WebFetch no puede leerlo; curl devolvió 200. No vi ningún paquete de manga activo. El último que encontré fue el de Ichijinsha, hasta el 19-06-2026.
- **comici MANGA:** solo tiene contenido en inglés, aunque funciona en Argentina, México y España.
- **Lezhin:** además de lezhin.es, se sumó la edición en inglés (lezhinus.com) como entrada aparte.

## Nuevos (24)

- **Plataformas japonesas en inglés:** MangaPlaza, Renta!, Coolmic, Alpha Manga y emaqi.
- **Multiformato y webtoon:** GlobalComix (tiene manga en español), INKR Comics, WebComics (`es`/`en`) y MangaToon (`es`/`en`).
- **Manga global y de autores:** Saturday AM y MANGA Plus Creators by SHUEISHA (`en`/`es`).
- **Tiendas con descarga oficial:** Neon Ichiban (PDF sin DRM si la editorial lo permite), SuBLime (PDF/EPUB), eManga (PDF/ePub/CBZ), Irodori Aqua (PDF) y Fanatical (bundles de Kodansha sin DRM).
- **Bibliotecas:** hoopla, Libby y Comics Plus. Son préstamos con carné.
- **En español:** Faneo, TusComics y Planeta Cómic (eBooks de manga).

## Cómo se completó `guardar`

- **`no_permite`:** solo donde leí los términos: VIZ, Manga UP!, Comikey, WEBTOON, Tapas, Toomics, Tappytoon, Lezhin EN, comici, MangaPlaza y GlobalComix.
- **`descarga_oficial`:** sitios que venden o dan archivos. BOOK☆WALKER va acá, pero sus descargas tienen DRM LCP. Omoi también, aunque el ePub sin DRM existe solo en algunas series.
- **Ninguno quedó en `permitido`:** en Faneo la licencia depende de cada obra (algunas son CC), así que hay que revisarla obra por obra.

## No verificado o con reservas

- **Alpha Manga y MANGA Plus Creators** (`verificado: "no"`): los dos responden con un desafío anti-bot (HTTP 202) y no se pudo ver el contenido. La URL de MANGA Plus Creators sale de ANN; esas obras también se ven dentro de MANGA Plus.
- **emaqi:** el sitio responde con un bloqueo regional (solo EE. UU. y Canadá). Usa localización asistida por IA.
- **Renta!:** volvió tras un mantenimiento por posible acceso no autorizado (octubre de 2026). Por ahora solo deja leer lo ya comprado: no se puede comprar, alquilar ni crear cuentas.
- **Solo app, sin lector web (no entran en la lista):** Mangamo, NOVELOUS (Shogakukan, EE. UU. y Canadá), Pentacomix (webtoons en español con "traducciones oficiales"; la web figura como "próximamente") y Pocket Toons, que hoy redirige a pocketsaga.com.
- **No cargaron o no se encontraron:** MANGA BANG! (mangaflip.com da error 500), Yomoyo (Beaglee; el dominio no aparece), CORONA EX for English (en.to-corona-ex.com ya no resuelve; no encontré anuncio de cierre) y Pilot Manga, el sitio gratis de Saturday AM (503).
- **Solo en japonés (descartados):** Jump TOON (Shueisha/CyberAgent), ComicWalker/KadoComi (KADOKAWA) y Zebrack.
- **Editoriales sin lector gratis propio:** Kodansha US (403), Yen Press, Seven Seas y Square Enix Manga & Books. Venden por tiendas o apps de terceros.
- **Editoriales en español:**
  - Norma: su "Edición digital" apunta a cimoc.com, que está "en construcción".
  - Ivrea, Panini (España y México), Kamite y Milky Way: no encontré venta digital ni capítulos gratis online.
- **Izneo:** /en redirige a la versión francesa, así que no confirmé oferta en inglés.
- **Plataformas mayormente adultas** (Honeytoon, TOPTOON Plus, Daycomics): no se revisaron a fondo y quedaron afuera.
- **"Give My Regards to Black Jack" (Shuho Sato):** hoy **no encontré dónde leerlo gratis online**. Los sitios que lo alojaban están caídos: el dominio mangaonweb.com ("漫画 on Web", del autor) y satoshuho.com están en venta, y Manga Library Z (ex J-Comi) cerró en 2024. Hay episodios en inglés como ebooks de pago o préstamo (OverDrive/Libby, Nextory, editorial "My Ebook Publishing House"). No encontré manga japonés con licencia CC verificado. Pepper&Carrot (CC BY) ya está en la lista de cómics y no es manga.

## Cerrados o por cerrar

- **MANGA MIRAI** (NTT Docomo): cierra el 15-12-2026 y las compras pasan a MangaPlaza.
- **Tapas:** cierra el 31-03-2027. Sigue en la lista hasta entonces.
- **Manga Planet:** cerró el 31-03-2026 y las compras pasaron a Renta!.
- **InkyPen:** cerró en diciembre de 2025.
- **Pocket Comics** (NHN): cerró el 31-10-2025.
- **MANGA.CLUB** (TORICO): cerró el 31-10-2025 (aviso en manga.club).
- **Manga Library Z:** cerró en noviembre de 2024.
- **CORONA EX for English:** probablemente cerrado, porque el dominio no resuelve. No está confirmado.
