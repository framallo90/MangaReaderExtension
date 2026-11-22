# Sitios legítimos de cómics: notas (21-11-2026)

Acompaña a `comics.json`, que tiene 57 sitios: 34 con español y 23 solo en español. En 53 la página cargó el 21-11-2026. Para verificar usé `curl` con un User-Agent de navegador y WebFetch. Cuando el sitio bloqueaba bots, busqué una captura reciente en la Wayback Machine. Los datos que ya estaban en `research_notes/Sitios legítimos de manga y cómics/` no los volví a investigar: solo volví a abrir las URL.

## Qué cambió en la lista conocida

- **Marvel:** reemplacé Marvel Unlimited por **Marvel Comics powered by WEBTOON** (`marvel.webtoon.com`), que está en línea desde el 16-11-2026. Ahora `marvel.com/unlimited` dice que Unlimited "will sunset on 12/7" y que no acepta altas nuevas.
- **Panel Syndicate:** el 21-11-2026, `https://` rechazó la conexión, así que en el JSON va `http://panelsyndicate.com/`, que anda. Su página de ayuda confirma que se puede pagar 0 y que los archivos vienen en PDF, CBR o CBZ sin DRM.
- **Comic Book Plus, Digital Comic Museum, DriveThruComics y Hemeroteca Digital BNE:** a curl y a WebFetch les devolvieron 403 (desafío de Cloudflare o bloqueo de bots), así que figuran como `verificado: "no"`. Están en línea según la Wayback Machine: CBP con captura del 12-11-2026, DriveThru del 07-11-2026 y DCM del 23-06-2026. En el caso de la BNE, la página oficial `bne.es/es/catalogos/hemeroteca-digital` sí cargó y lista "prensa satírica, humorística".
- **Izneo:** desde acá, `/en` redirige a `/fr`. Su soporte dice que el catálogo en inglés existe. No encontré nada en español.
- **Neon Ichiban:** ahora se presenta como tienda para leer, coleccionar y revender cómics y manga, y tiene sección "Free Comics".
- **Comics Plus:** pasó a ser parte de The Joyful Reading Company (con Beanstack). Su sitio de lectores es `comicsplusapp.com`.

## Nuevos respecto de la lista conocida (32)

- **Tiras de diario oficiales:** GoComics y Gaturro en GoComics; Comics Kingdom (con sección "Comics in Spanish") y **Macanudo en español** en Comics Kingdom; ArcaMax.
- **Diarios en español:** El País (Las Viñetas, con el archivo de Forges en el mismo diario), elDiario.es (Viñetas), Clarín (Humor), Página/12 (Humor), La Jornada (Cartones) y **El Jueves**, que solo se lee con suscripción: `eljueves.es` hoy redirige a la tienda de RBA.
- **Autores y personajes en español:** **Condorito**, cuyo sitio oficial da gratis en PDF el primer libro, de 1955. **Dosis Diarias** (Montt), con archivo de 2006 a 2019. **Historietas Reales**, blog argentino de 2005 a 2021. **xkcd en español**, traducción no oficial con CC BY-NC 2.5.
- **Archivos y bibliotecas en español:** Biblioteca Virtual de Prensa Histórica (CC BY 4.0), fanzines del DDD de la UAB (en PDF), Biblioteca Pública Digital de Chile (préstamo), Biblioteca Digital de Bogotá con su colección "Cómic Colombiano" (65 obras), educ.ar (historietas con CC BY-NC-SA) y Learning Corner de la UE (cómics en PDF en español).
- **Plataformas en inglés o mixtas:** Tapas (tiene sección "Léelo en español"), WEBTOON (es/en), Zestworld, la tienda de cómics de Kindle (ex Comixology) y Comics Plus.
- **Dominio público y licencia libre en inglés:** ComicBook Experience, Barnacle Press, Comic Strip Library y Sandra and Woo (CC BY-NC-ND 3.0).
- **Webcomics oficiales:** Hiveworks y Cyanide & Happiness.

## Criterios del campo `guardar`

- Puse **`no_permite`** solo cuando lo dicen los términos o cuando es préstamo o app con DRM. Casos: Comics Kingdom (sus términos limitan el uso a lo "authorized by King Features" y prohíben herramientas de extracción), WEBTOON (descargas solo en la app, por 30 días), Marvel, DC, Kindle, Izneo, El Jueves y las bibliotecas.
- **Diarios, GoComics, ArcaMax y webcomics sin licencia declarada** quedaron en **`sin_verificar`**: no leí términos que lo prohíban ni que lo permitan.
- En **Faneo** la licencia la elige cada autor, así que hay que mirar la ficha de cada obra.
- En **Internet Archive** también hay que revisar cada ítem. Probé filtrar por `licenseurl` y aparecen cómics comerciales marcados como CC0 por quien los subió, así que ese filtro no sirve.

## Para tener en cuenta

- **Sitios sin actividad:** Barnacle Press no se actualiza desde 2021, Dosis Diarias desde 2019 e Historietas Reales desde 2021. xkcd en español sube tiras de vez en cuando; la última es del 24-11-2025. Zestworld sigue en línea con catálogo, pero sus términos son de 2023 y la prensa lo da por apagado desde 2024.
- **Modelo freemium de los diarios:** El País y Clarín tienen muro de pago por cantidad de notas. Los límites que encontré son de 2020 a 2023, así que pueden haber cambiado.
- **GoComics:** curl recibe 403, pero WebFetch sí trajo la página (Gaturro y Calvin and Hobbes en Español con tira del 21-11-2026). Por eso figura como verificado.

## Lo que no pude verificar o descarté

- **Sitios propios de autores:** `porliniers.com` y `modernadepueblo.com` no respondieron, así que no los agregué. Liniers se lee en Comics Kingdom.
- **Quino:** `quino.com.ar` es el sitio oficial de Quino, pero no tiene tiras para leer. "Mafalda digital" remite a Kindle y a una app.
- **Gaturro:** `gaturro.com` está desactualizado (© 2017), así que lo cargué por GoComics.
- **La Nación (Argentina):** no encontré una sección de humor con URL estable; las que probé dieron 404.
- **Argentina y México:**
  - Para la BNMM, Trapalanda no respondió y no encontré historieta digitalizada abierta.
  - En México, `hndm.iib.unam.mx` y `pepines.unam.mx` no respondieron. Además, "pepines" parece ser un catálogo y no un lector.
  - No encontré colecciones de historieta de la Secretaría de Cultura.
- **Bibliotecas:** no confirmé que eBiblio (España) tenga cómics. En Chronicling America (Library of Congress), la página devolvió 403 a bots, así que la dejé afuera.
- **Free Comic Book Day:** en 2026 fue solo en tiendas y en papel (el 2-05-2026). No ofrece lectura en línea, así que no lo agregué.
- **Obras sueltas:** las historietas de la OPS (PDF por documento, sin una sección propia) no las agregué. *First Woman* de la NASA tampoco: el PDF en español que encontré dio 404.
- **Sitios caídos:** Galicia Comic, Zona00Comics y Marmota Comics no respondieron. Revista Larva (Colombia) y CoquitoMAN (Paraguay) tampoco.
- **Otros descartes:** Billy Ireland (OSU) es una colección de imágenes y no un lector de números. Darths & Droids e Irregular Webcomic quedaron afuera: el primero no muestra licencia en la portada y el segundo dio 403.

## Cerrados o que ya no sirven

- **Marvel Unlimited:** cierra. No acepta altas, la lectura termina el 7-12-2026 y el retiro definitivo es el 28-12-2026. Lo reemplaza la app de Marvel con WEBTOON.
- **Dark Horse Digital:** dejó de vender el 24-02-2025. El sitio sigue en pie solo para la biblioteca de quienes ya compraron.
- **Comixology:** la app y la tienda se integraron a Kindle en diciembre de 2023. Desde febrero de 2025 Kindle tampoco permite bajar por USB.
- **Lektu (España):** "LEKTU está cerrada desde el 30/03/2025" (verificado en su portada).
- **Otras plataformas cerradas:**
  - Omnibus cerró el 21-08-2024.
  - Madefire, cerrado.
  - Europe Comics cerró su actividad con el público el 12-01-2023 y sigue solo en tiendas.
  - La tienda sin DRM de Image Comics cerró en 2018-2019.
- **Dominios que ya no pertenecen al proyecto original (no usar):**
  - Comics Uniting Nations (cómics de la ONU).
  - `maitena.com.ar`.
  - `tutelandia.com.ar`, el sitio de Tute: ahora tiene contenido ajeno.
  - `mortadelo.com`, que es un dominio estacionado. No encontré un sitio oficial de Mortadelo para leer.
