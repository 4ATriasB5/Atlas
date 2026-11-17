// RECOLECTOR DE ATLAS
// Descarga los datos de las fuentes públicas y los guarda en public/datos/.
// La app solo lee esos archivos. Se ejecuta con:  npm run datos
//
//   paises.json   -> Banco Mundial (PIB, crecimiento, inflación, paro, exportaciones)
//   comercio.json -> WITS / Banco Mundial (qué vende cada país y a quién)
//   bolsas.json   -> Finnhub (variación diaria de la bolsa de cada país)
//
// Si una fuente falla, se conserva el archivo anterior y las demás siguen.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import iso from 'i18n-iso-countries';
import { INDICADORES, ETF_PAISES, ETF_EXTRA, ALIAS_WITS } from './fuentes.mjs';

const require = createRequire(import.meta.url);
iso.registerLocale(require('i18n-iso-countries/langs/es.json'));

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'public', 'datos');
const FORZAR_TODO = process.argv.includes('--todo');
const DIAS_CACHE_COMERCIO = 30; // el comercio es anual: basta con revisarlo una vez al mes

// La clave de Finnhub se guarda en el archivo .env (que nunca se sube a internet).
try {
  process.loadEnvFile(path.join(RAIZ, '.env'));
} catch {
  /* sin archivo .env: no pasa nada */
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();

/** Pide una dirección y devuelve su JSON. Devuelve null si no existe (404). Reintenta si falla. */
async function pedirJson(url, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= intentos) throw e;
      await esperar(1500 * i);
    }
  }
}

/** Ejecuta una tarea sobre cada elemento, con un máximo de `n` a la vez. */
async function enParalelo(elementos, n, tarea) {
  const cola = [...elementos];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (cola.length) await tarea(cola.shift());
    }),
  );
}

async function leerAnterior(nombre) {
  const ruta = path.join(SALIDA, nombre);
  if (!existsSync(ruta)) return null;
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch {
    return null;
  }
}

async function guardar(nombre, contenido) {
  await mkdir(SALIDA, { recursive: true });
  const texto = JSON.stringify(contenido);
  await writeFile(path.join(SALIDA, nombre), texto, 'utf8');
  console.log(`   guardado ${nombre} (${(texto.length / 1024).toFixed(0)} KB)`);
}

// ───────────────────────── 1. PAÍSES (Banco Mundial) ─────────────────────────

const REGIONES = {
  EAS: 'Asia Oriental y Pacífico',
  ECS: 'Europa y Asia Central',
  LCN: 'Latinoamérica y Caribe',
  MEA: 'Oriente Medio y Norte de África',
  NAC: 'Norteamérica',
  SAS: 'Asia Meridional',
  SSF: 'África Subsahariana',
};
const INGRESOS = {
  HIC: 'Ingresos altos',
  UMC: 'Ingresos medios-altos',
  LMC: 'Ingresos medios-bajos',
  LIC: 'Ingresos bajos',
};

/** Lista base: todos los países con código ISO, con su nombre en español. */
function listaBase() {
  const paises = {};
  for (const iso3 of Object.keys(iso.getAlpha3Codes())) {
    if (iso3 === 'ATA') continue; // la Antártida no es un país
    paises[iso3] = {
      iso3,
      iso2: iso.alpha3ToAlpha2(iso3),
      num: String(iso.alpha3ToNumeric(iso3)).padStart(3, '0'),
      nombre: iso.getName(iso3, 'es') ?? iso3,
      region: null,
      ingreso: null,
      capital: null,
      rangoPib: null,
      d: {},
      serie: [],
    };
  }
  // Kosovo no tiene código ISO oficial; el Banco Mundial usa XKX.
  paises.XKX = { iso3: 'XKX', iso2: 'XK', num: null, nombre: 'Kosovo', region: null, ingreso: null, capital: null, rangoPib: null, d: {}, serie: [] };
  return paises;
}

async function todasLasPaginas(url) {
  const filas = [];
  for (let pagina = 1; ; pagina++) {
    const r = await pedirJson(`${url}&page=${pagina}`);
    if (!r || !Array.isArray(r) || !r[1]) break;
    filas.push(...r[1]);
    if (pagina >= (r[0]?.pages ?? 1)) break;
  }
  return filas;
}

async function recolectarPaises() {
  console.log('1/3 Banco Mundial: datos macroeconómicos…');
  const paises = listaBase();

  const fichas = await todasLasPaginas('https://api.worldbank.org/v2/country?format=json&per_page=400');
  for (const f of fichas) {
    const p = paises[f.id];
    if (!p || f.region?.id === 'NA') continue; // 'NA' = agregados (regiones, mundo…), no países
    p.region = REGIONES[f.region?.id] ?? null;
    p.ingreso = INGRESOS[f.incomeLevel?.id] ?? null;
    p.capital = f.capitalCity || null;
  }

  const añoFin = new Date().getFullYear();
  const añoIni = añoFin - 14;
  for (const [clave, codigo] of Object.entries(INDICADORES)) {
    const filas = await todasLasPaginas(
      `https://api.worldbank.org/v2/country/all/indicator/${codigo}?format=json&per_page=20000&date=${añoIni}:${añoFin}`,
    );
    let conDato = 0;
    for (const f of filas) {
      const p = paises[f.countryiso3code];
      if (!p || f.value === null || f.value === undefined) continue;
      const año = Number(f.date);
      const actual = p.d[clave];
      if (!actual || año > actual.a) {
        if (!actual) conDato++;
        p.d[clave] = { v: f.value, a: año };
      }
      if (clave === 'crecimiento') p.serie.push({ a: año, v: f.value });
    }
    console.log(`   ${clave}: ${conDato} países`);
  }

  for (const p of Object.values(paises)) p.serie = p.serie.sort((a, b) => a.a - b.a).slice(-12);

  // Puesto de cada país en el mundo según su PIB.
  Object.values(paises)
    .filter((p) => p.d.pib)
    .sort((a, b) => b.d.pib.v - a.d.pib.v)
    .forEach((p, i) => (p.rangoPib = i + 1));

  await guardar('paises.json', {
    actualizado: ahora(),
    fuente: 'Banco Mundial · World Development Indicators',
    indicadores: INDICADORES,
    paises,
  });
  return paises;
}

// ───────────────────────── 2. COMERCIO (WITS) ─────────────────────────

const ALIAS_WITS_INVERSO = Object.fromEntries(Object.entries(ALIAS_WITS).map(([wits, isoReal]) => [isoReal, wits]));

/** Lee una respuesta en formato SDMX y devuelve [{ id, v }] para la dimensión pedida. */
function leerSdmx(json, dimension) {
  const dims = json?.structure?.dimensions?.series ?? [];
  const pos = dims.findIndex((d) => d.id === dimension);
  const series = json?.dataSets?.[0]?.series ?? {};
  if (pos < 0) return [];
  return Object.entries(series).map(([clave, s]) => {
    const indice = Number(clave.split(':')[pos]);
    const observacion = Object.values(s.observations ?? {})[0];
    return { id: dims[pos].values[indice].id, v: (observacion?.[0] ?? 0) * 1000 }; // WITS da miles de dólares
  });
}

async function comercioDe(iso3, paises) {
  const reportero = (ALIAS_WITS_INVERSO[iso3] ?? iso3).toLowerCase();
  const ultimo = new Date().getFullYear() - 1;
  for (let año = ultimo; año >= ultimo - 5; año--) {
    const base = `https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade/reporter/${reportero}/year/${año}`;
    const jsonProductos = await pedirJson(`${base}/partner/wld/product/all/indicator/XPRT-TRD-VL?format=JSON`, 2);
    if (!jsonProductos) continue; // ese año no está publicado: probar el anterior
    const grupos = leerSdmx(jsonProductos, 'PRODUCTCODE');
    const total = grupos.find((g) => g.id === 'Total')?.v ?? 0;
    if (!total) continue;
    const productos = grupos
      .filter((g) => /^\d/.test(g.id)) // solo los 16 capítulos de productos, sin subtotales
      .sort((a, b) => b.v - a.v);

    let socios = [];
    const jsonSocios = await pedirJson(`${base}/partner/all/product/Total/indicator/XPRT-TRD-VL?format=JSON`, 2);
    if (jsonSocios) {
      socios = leerSdmx(jsonSocios, 'PARTNER')
        .map((s) => ({ iso3: ALIAS_WITS[s.id] ?? s.id, v: s.v }))
        .filter((s) => paises[s.iso3] && s.iso3 !== iso3) // fuera regiones y agregados
        .sort((a, b) => b.v - a.v)
        .slice(0, 8);
    }
    return { a: año, total, productos, socios };
  }
  return null;
}

async function recolectarComercio(paises) {
  console.log('2/3 WITS: qué vende cada país y a quién…');
  const anterior = await leerAnterior('comercio.json');
  if (anterior?.actualizado && !FORZAR_TODO) {
    const dias = (Date.now() - new Date(anterior.actualizado).getTime()) / 86_400_000;
    if (dias < DIAS_CACHE_COMERCIO) {
      console.log(`   se descargó hace ${dias.toFixed(0)} días; son datos anuales, no hace falta repetir.`);
      return;
    }
  }
  const candidatos = Object.values(paises).filter((p) => p.d.pib || p.iso3 === 'TWN');
  const comercio = {};
  let hechos = 0;
  await enParalelo(candidatos, 5, async (p) => {
    try {
      const c = await comercioDe(p.iso3, paises);
      if (c) comercio[p.iso3] = c;
    } catch (e) {
      console.log(`   ${p.iso3}: sin datos (${e.message})`);
    }
    if (++hechos % 40 === 0) console.log(`   ${hechos}/${candidatos.length} países…`);
  });
  console.log(`   ${Object.keys(comercio).length} países con datos de comercio`);
  if (Object.keys(comercio).length < 50 && anterior) {
    console.log('   muy pocos países: algo falla en WITS, se conserva el archivo anterior.');
    return;
  }
  await guardar('comercio.json', {
    actualizado: ahora(),
    fuente: 'WITS (Banco Mundial) con datos de UN Comtrade · solo mercancías',
    comercio,
  });
}

// ───────────────────────── 3. BOLSAS (Finnhub) ─────────────────────────

async function recolectarBolsas() {
  console.log('3/3 Finnhub: bolsas de hoy…');
  const clave = process.env.FINNHUB_API_KEY;
  if (!clave) {
    console.log('   no hay clave FINNHUB_API_KEY: la capa de bolsa queda sin activar (ver LEEME.md).');
    if (!(await leerAnterior('bolsas.json'))) {
      await guardar('bolsas.json', { actualizado: null, fuente: 'Finnhub', paises: {}, extra: {} });
    }
    return;
  }
  const cotizar = async (simbolo) => {
    const q = await pedirJson(`https://finnhub.io/api/v1/quote?symbol=${simbolo}&token=${clave}`, 2);
    if (!q || !q.c || !q.pc) return null; // Finnhub devuelve ceros si no conoce el símbolo
    return {
      cierre: q.c,
      cambioPct: q.dp ?? ((q.c - q.pc) / q.pc) * 100,
      fecha: q.t ? new Date(q.t * 1000).toISOString() : null,
    };
  };
  const paises = {};
  const extra = {};
  const lista = [...ETF_PAISES.map((e) => [paises, ...e]), ...ETF_EXTRA.map((e) => [extra, ...e])];
  for (const [destino, clavePais, simbolo, nombre] of lista) {
    try {
      const c = await cotizar(simbolo);
      if (c) destino[clavePais] = { simbolo, nombre, ...c };
      else console.log(`   ${simbolo}: sin cotización`);
    } catch (e) {
      console.log(`   ${simbolo}: error (${e.message})`);
    }
    await esperar(1100); // el plan gratuito permite 60 consultas por minuto
  }
  console.log(`   ${Object.keys(paises).length} países con bolsa`);
  if (Object.keys(paises).length === 0) {
    console.log('   ninguna cotización: se conserva el archivo anterior. Revisa la clave.');
    return;
  }
  await guardar('bolsas.json', {
    actualizado: ahora(),
    fuente: 'Finnhub · fondos cotizados (ETF) en dólares que replican la bolsa de cada país',
    paises,
    extra,
  });
}

// ───────────────────────── PROGRAMA ─────────────────────────

console.log(`Atlas · recolector de datos · ${new Date().toLocaleString('es-ES')}`);
let fallos = 0;
let paises = null;
try {
  paises = await recolectarPaises();
} catch (e) {
  fallos++;
  console.error(`   ERROR en Banco Mundial: ${e.message}`);
  paises = (await leerAnterior('paises.json'))?.paises ?? null;
}
if (paises) {
  try {
    await recolectarComercio(paises);
  } catch (e) {
    fallos++;
    console.error(`   ERROR en WITS: ${e.message}`);
  }
}
try {
  await recolectarBolsas();
} catch (e) {
  fallos++;
  console.error(`   ERROR en Finnhub: ${e.message}`);
}
console.log(fallos ? `Terminado con ${fallos} fuente(s) con errores.` : 'Terminado sin errores.');
process.exitCode = fallos === 3 ? 1 : 0;
