# Recorte de la lista de sitios (versión 2.8.2, 21-11-2026)

La lista de la 2.8 tenía 85 sitios. El usuario pidió dejar solo los que valen la pena: **sitios donde los capítulos se leen en el mismo sitio, con las series completas y al día**. Muchos de los 85 eran tiendas, bibliotecas o archivos de números sueltos. Quedaron 23; salieron 62.

## Criterio

Entra un sitio si cumple todo esto:

1. Los capítulos se leen ahí mismo, en el navegador (no solo en una app ni después de comprar un archivo).
2. Tiene el catálogo de series completo y se actualiza con capítulos nuevos.
3. Es legítimo: plataforma oficial, del autor o con licencia. Nunca agregadores sin licencia.
4. Funciona desde Argentina y no tiene fecha de cierre anunciada.

## Los 23 que quedan

- **Manga, manhwa y webtoon (14):** MANGA Plus, MANGA MILLION, VIZ / Shonen Jump, Manga UP!, MangaPlaza, comici MANGA, Coolmic, Omoi, WEBTOON en español, WEBTOON en inglés, Lezhin en español, Manta, Tappytoon, Toomics.
- **Manga y cómics (4):** GlobalComix, Comikey, MangaToon, WebComics.
- **Cómics y tiras (5):** Marvel Comics, Panel Syndicate, Pepper&Carrot, GoComics, Comics Kingdom.

## Verificado el 21-11-2026

- Las 23 direcciones responden 200.
- Abiertas en un navegador desde esta máquina (Argentina):
  - **DC Universe Infinite:** redirige a `/coming-soon/` con "Sorry, this service is only available in select countries". Sale.
  - **Marvel:** `marvel.webtoon.com` es solo la página del lanzamiento. El lector con el catálogo es `marvelcomicsapp.com` y carga desde acá. Se cambió la dirección.
  - **MangaToon, Manta y MANGA MILLION:** muestran el catálogo para leer en la web.
- **MANGA MILLION:** gratis hasta fines de diciembre de 2027 según la cobertura del lanzamiento (Anime Corner, Anitrendz, Lowyat). No hace falta cuenta.
- **Tapas:** cierra en marzo de 2027 y los usuarios pierden lo comprado (Anime News Network, 01-10-2026). Sale.

## Los 62 que salieron, por motivo

| Motivo | Sitios |
|---|---|
| Tiendas: venden tomos o archivos | BOOK☆WALKER, eManga, Irodori Aqua, J-Novel Club (sobre todo novelas), Planeta Cómic digital, Renta! (en mantenimiento), SuBLime, Fanatical, Humble Bundle, Izneo, Kindle Cómics, Neon Ichiban, Sweet Shop, 2000 AD, DriveThruComics, itch.io: cómics, El Jueves (tienda de RBA) |
| Préstamo de biblioteca: hace falta carnet | Comics Plus, hoopla, Libby, Biblioteca Pública Digital de Chile, BibloRed |
| Archivos de números sueltos o de un solo libro | AHIRA, Barnacle Press, Biblioteca Virtual de Prensa Histórica, Comic Book Plus, Comic Strip Library, Cómics de la Unión Europea, Condorito (un solo libro), Digital Comic Museum, educ.ar, Fanzines de la UAB, Hemeroteca Digital BNE, Internet Archive, Memoria Chilena |
| Secciones de humor de diarios | Clarín, El País, elDiario.es, La Jornada, Página/12 |
| Sin actualizar, en pausa o en beta | Dosis Diarias (desde 2019), Historietas Reales (desde 2021), El Vosque (en pausa), Zestworld (poca actividad), xkcd en español (esporádico), TusComics (beta) |
| Tiras de una viñeta, no series | xkcd, Cyanide & Happiness, Cat and Girl, Sandra and Woo |
| Cierra o no anda desde Argentina | Tapas, DC Universe Infinite |
| Repetidos o absorbidos por otro de la lista | INKR (ahora es parte de GlobalComix), Lezhin en inglés, Gaturro (está en GoComics), Macanudo (está en Comics Kingdom), ArcaMax (mismas tiras que GoComics y Comics Kingdom) |
| Catálogo chico o de nicho | Alpha Manga (un solo sello), MANGA Plus Creators (amateurs), Saturday AM, Faneo (comunidad sin series completas), Hiveworks (directorio que lleva a otros sitios) |

Los datos de cada uno siguen en `manga.json`, `comics.json` y sus notas, por si alguno vuelve a cumplir el criterio.
