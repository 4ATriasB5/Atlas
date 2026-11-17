# Atlas — guía rápida

Atlas es una app web para entender la economía mundial de forma visual.
Esta es la **fase 1**: mapa mundial real + ficha de país con datos reales.

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

## Lo que todavía no hace (fases siguientes)

- **Fase 2:** fondos y ETFs de MyInvestor y Trade Republic + buscador inverso.
- **Fase 3:** ficha de empresa, precios históricos, «Mi lista» y alertas.
- **Fase 4:** noticias explicadas, sectores y «¿por qué se ha movido?».
- **Fase 5:** radar de emergentes, tiempo real y X.
