# Atlas — guía rápida

Atlas es una app web para entender la economía mundial de forma visual.
Hechas la **fase 1** (mapa mundial real + ficha de país), la **fase 2** (fondos y ETFs con buscador inverso), la
**fase 3** (empresas, «Mi lista» sincronizada y alertas) y la **fase 4** (noticias, sectores y «¿por qué se ha movido?»).

## Cómo abrir la app en tu ordenador

1. Abre la carpeta `D:\Atlas` en una terminal (clic derecho en la carpeta → «Abrir en Terminal»).
2. Escribe:

   ```
   npm run abrir
   ```

3. Se abre sola en tu navegador (dirección `http://localhost:5173`).
   Para cerrarla, vuelve a la terminal y pulsa `Ctrl + C`.

## Cómo actualizar los datos

```
npm run datos
```

Descarga los datos nuevos y los guarda en `public/datos/`. Tarda unos segundos
(los datos de comercio solo se vuelven a descargar una vez al mes, porque son anuales;
para forzarlo, usa `npm run datos:todo`).

Cuando la app esté publicada en internet, esto lo hará GitHub solo, cada día.

## Activar la capa «Bolsa hoy»

La bolsa necesita una clave gratuita de Finnhub:

1. Crea una cuenta gratuita en <https://finnhub.io> y copia tu «API key».
2. En `D:\Atlas`, haz una copia del archivo `.env.example` y llámala `.env`.
3. Ábrela con el Bloc de notas y pega la clave detrás de `FINNHUB_API_KEY=`.
4. Ejecuta `npm run datos`.

El archivo `.env` nunca se sube a internet. No compartas la clave con nadie.

## De dónde salen los datos

| Qué | Fuente | Cada cuánto cambia |
|---|---|---|
| PIB, crecimiento, inflación, paro, exportaciones | Banco Mundial | Una vez al año por país |
| Qué vende cada país y a quién (solo mercancías) | WITS (Banco Mundial / UN Comtrade) | Una vez al año |
| Bolsa de cada país | Finnhub, con fondos cotizados (ETF) en dólares | Cada día |
| Fronteras del mapa | Natural Earth (paquete `world-atlas`) | No cambia |
| Empresas clave | Lista escrita a mano (`src/editorial.ts`) | Cuando se edite |

## Qué hay en cada carpeta

```
D:\Atlas
├─ src/                 la app
│  ├─ App.tsx           barra superior, menú y navegación
│  ├─ PantallaMapa.tsx  pantalla 1: mapa + panel del país
│  ├─ Mapa.tsx          el mapa (D3): fronteras, zoom, etiqueta
│  ├─ FichaPais.tsx     pantalla 2: ficha de país
│  ├─ capas.ts          métricas del mapa y sus colores
│  ├─ textos.ts         frases que se componen con los datos
│  ├─ editorial.ts      empresas clave (lista a mano)
│  ├─ datos.ts          carga y formato de los datos
│  └─ estilos.css       colores y tipografías
├─ recolector/          el programa que descarga los datos
├─ public/datos/        los datos descargados
├─ .github/workflows/   la actualización y publicación automática diaria
└─ node_modules/        librerías (no se toca; se regenera con «npm install»)
```

## Fondos y ETFs (fase 2)

La sección «Fondos y ETFs» muestra qué empresas lleva dentro cada fondo y permite buscar al revés:
escribes una empresa y ves qué fondos la tienen y con qué peso.

**De dónde salen los datos**

- **Trade Republic:** de su PDF oficial «Universo de inversión» (lista de todo lo que se puede comprar allí).
- **MyInvestor:** no publica su catálogo, así que hay una lista manual: `catalogos/myinvestor.csv`.
  Ábrela con el Bloc de notas y cambia `no` por `si` en los fondos que compruebes en tu app.
  Hasta entonces salen como «por confirmar».
- **Carteras:** de los archivos que publican las gestoras iShares, Xtrackers y SPDR.
  Vanguard, Amundi y Fidelity aparecen en la lista pero todavía sin cartera.
- **Comisiones:** escritas a mano en `catalogos/fondos.csv`. Pueden estar desactualizadas:
  compruébalas siempre en el documento oficial del fondo.

**Añadir un fondo:** añade una línea a `catalogos/fondos.csv` (las instrucciones están al principio del archivo).

**Actualizar las carteras a mano:**

```
npm run fondos
```

No suele hacer falta: GitHub lo hace solo cada lunes.

## Empresas (fase 3, parte A)

Sección **Empresas** (buscador con filtros), **ficha de empresa** y **Mi lista**.

- **Qué empresas:** las 500 del S&P 500 (las mayores de la bolsa de EE. UU.). La lista sale de la cartera
  del fondo iShares Core S&P 500 que ya descargamos en la fase 2.
- **Precio e indicadores:** Finnhub, con la misma clave de la capa «Bolsa hoy». Su plan gratuito solo
  cubre EE. UU.; por eso las empresas europeas o asiáticas tienen una ficha reducida, sin precio.
- **Ingresos y beneficios de cada año:** SEC EDGAR, el registro oficial de EE. UU. No necesita clave, pero
  exige un correo de contacto: va en `.env` como `SEC_CONTACTO=` y como secreto `SEC_CONTACTO` en GitHub.
  Para renovar solo esta parte: `node recolector/empresas.mjs --solo-cuentas` (menos de un minuto).
  Unos pocos bancos y empresas declaran los ingresos con otras etiquetas y salen sin ese gráfico.
- **Gráfico de precios (5 años):** Twelve Data. Necesita una clave gratuita `TWELVEDATA_API_KEY` en el
  archivo `.env` y como secreto en GitHub, igual que la de Finnhub. Sin ella, todo funciona menos el gráfico.
  El plan gratuito da 800 consultas al día, así que los historiales se renuevan por tandas (unos 110 por noche).
- **Mi lista:** se guarda solo en el navegador del dispositivo donde la creas. La sincronización entre
  dispositivos y las alertas llegan en la parte B.

**Actualizar a mano** (tarda unos 10 minutos; la primera vez, cerca de 45):

```
npm run empresas
```

No suele hacer falta: GitHub lo hace solo cada noche.

## Cuenta, lista sincronizada y alertas (fase 3, parte B)

Con el botón **Entrar** (arriba) se entra con el correo, sin contraseña: llega un enlace y al pulsarlo ya estás dentro.
Con la cuenta abierta, «Mi lista» se ve igual en todos los dispositivos y se pueden crear **alertas** desde la ficha
de cada empresa. Los avisos aparecen dentro de la app (campana de arriba y pantalla «Mi lista»); se comprueban al
abrir la app, con el precio de cierre del día.

- **Dónde se guarda:** en Supabase (base de datos gratuita en la nube). Cada persona solo ve sus propios datos.
- **Cómo se activa:** los dos datos del proyecto de Supabase van en `src/nube-config.ts`, y las tablas se crean
  pegando `nube/tablas.sql` en el «SQL Editor» de Supabase. Mientras ese archivo esté vacío, el botón «Entrar»
  no aparece y la lista se guarda solo en el dispositivo.
- **Límite del plan gratuito:** Supabase envía pocos correos por hora (suficiente para uso personal).

## Noticias, sectores y «¿por qué se ha movido?» (fase 4)

- **Noticias:** pantalla nueva con las empresas que más se han movido, los resultados de la semana, los próximos
  resultados, las noticias de «Mi lista» y las del mercado. Cada ficha de empresa tiene también sus noticias.
  Arriba se puede elegir un **sector**: entonces todo se limita a sus empresas y salen dos listas más:
  «Lo importante del sector» (noticias que afectan a todo el sector, buscadas por palabras como *oil* u *OPEC*; la
  lista `TEMAS` de `recolector/noticias.mjs` se puede ampliar) y «Lo más relevante de sus empresas» (ordenadas por
  puntos: tamaño de la empresa, hechos antes que opiniones, lo reciente y las empresas que más se han movido).
  - **Fuente:** Finnhub (la misma clave). Atlas solo guarda el titular, el medio y el enlace a la noticia original.
    Los titulares están en inglés, tal como los publica cada medio.
  - **Etiquetas:** «Sin confirmar» (rumores, fuentes anónimas, «podría»), «Opinión» (alguien opina o recomienda) y
    el tipo de noticia. Se ponen solas buscando palabras clave del titular, sin inteligencia artificial, así que alguna
    vez fallan. Las listas de palabras están al principio de `recolector/noticias.mjs` y se pueden ampliar.
- **Sectores:** agrupa las empresas del S&P 500 por sector, con lo que se ha movido cada uno hoy y en el año. Se
  calcula con los datos de empresas que ya teníamos; no necesita nada nuevo.
- **¿Por qué se ha movido?:** en cada ficha de empresa. Compara la empresa con su sector y con la bolsa en general,
  y mira si ese día presentó resultados o hubo noticias suyas. Habla siempre de *posibles* causas.

**Actualizar a mano** (unos 10 minutos; va después de `npm run empresas`):

```
npm run noticias
```

No suele hacer falta: GitHub lo hace solo cada noche.

## Lo que todavía no hace (fases siguientes)

- **Avisos por correo o notificaciones en el móvil:** de momento los avisos solo se ven dentro de la app.
- **Titulares traducidos al español:** necesitaría una IA de pago; se puede añadir más adelante.
- **Fase 5:** radar de emergentes, tiempo real y X.
