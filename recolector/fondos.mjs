// RECOLECTOR DE FONDOS Y ETFs (fase 2).
// Qué hace, en orden:
//   1) Lee tus listas: catalogos/fondos.csv y catalogos/myinvestor.csv.
//   2) Descarga el PDF oficial de Trade Republic con todo lo que se puede comprar allí.
//   3) Descarga la cartera de cada fondo del archivo que publica su gestora.
//   4) Guarda dos archivos que lee la app: public/datos/fondos.json y public/datos/carteras.json.
// Si la descarga de un fondo falla, se conserva la cartera que ya había.
// Se ejecuta con:  npm run fondos

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import iso from 'i18n-iso-countries';
import leerExcel from 'read-excel-file/node';

const require = createRequire(import.meta.url);
iso.registerLocale(require('i18n-iso-countries/langs/en.json'));
iso.registerLocale(require('i18n-iso-countries/langs/es.json'));

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'public', 'datos');
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const ES_ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────── Utilidades ─────────────

async function descargar(url, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': NAVEGADOR }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`respuesta ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      ultimo = e;
      await esperar(1500 * (i + 1));
    }
  }
  throw ultimo;
}

/** Lee un archivo de lista (CSV con punto y coma). Ignora las líneas que empiezan por # y la cabecera. */
async function leerLista(nombre, columnas) {
  const texto = await readFile(path.join(RAIZ, 'catalogos', nombre), 'utf8');
  const filas = [];
  let cabeceraVista = false;
  for (const linea of texto.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!cabeceraVista) {
      cabeceraVista = true; // la primera línea útil son los nombres de las columnas
      continue;
    }
    const celdas = linea.split(';').map((c) => c.trim());
    filas.push(Object.fromEntries(columnas.map((c, i) => [c, celdas[i] ?? ''])));
  }
  return filas;
}

/** Trocea una línea de CSV con comas y comillas. */
function trocearCsv(linea) {
  const celdas = [];
  let actual = '';
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentro && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else dentro = !dentro;
    } else if (c === ',' && !dentro) {
      celdas.push(actual);
      actual = '';
    } else actual += c;
  }
  celdas.push(actual);
  return celdas;
}

const MESES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** "13/Nov/2026" o "13-Nov-2026" -> "2026-11-13" */
function fechaIso(texto) {
  const m = String(texto ?? '').match(/(\d{1,2})[\/\- ]([A-Za-z]{3})[a-z]*[\/\- ](\d{4})/);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// ───────────── Traducciones ─────────────

const SECTORES = {
  'information technology': 'Tecnología',
  'health care': 'Salud',
  financials: 'Finanzas',
  'consumer discretionary': 'Consumo no esencial',
  'consumer staples': 'Consumo básico',
  'communication services': 'Comunicación',
  communication: 'Comunicación',
  industrials: 'Industria',
  energy: 'Energía',
  materials: 'Materiales',
  utilities: 'Suministros (luz, agua, gas)',
  'real estate': 'Inmobiliario',
};
function sectorEs(s) {
  return SECTORES[String(s ?? '').trim().toLowerCase()] ?? 'Otros';
}

const PAISES_RAROS = {
  'united states': 'US',
  usa: 'US',
  'korea (south)': 'KR',
  'south korea': 'KR',
  korea: 'KR',
  'korea, republic of': 'KR',
  taiwan: 'TW',
  'russian federation': 'RU',
  russia: 'RU',
  'united kingdom': 'GB',
  'hong kong': 'HK',
  'czech republic': 'CZ',
  turkey: 'TR',
  'türkiye': 'TR',
  'viet nam': 'VN',
  vietnam: 'VN',
};
const cachePais = new Map();
function paisEs(nombre) {
  const n = String(nombre ?? '').trim();
  if (!n || n === '-') return 'Otros';
  if (cachePais.has(n)) return cachePais.get(n);
  const codigo = PAISES_RAROS[n.toLowerCase()] ?? iso.getAlpha2Code(n, 'en');
  const es = codigo === 'KR' ? 'Corea del Sur' : (codigo && iso.getName(codigo, 'es')) || n;
  cachePais.set(n, es);
  return es;
}

const SOBRAN = new Set(
  'INC CORP CORPORATION CO COMPANY PLC LTD LIMITED SA AG NV SE ASA AB OYJ SPA HOLDINGS HOLDING GROUP THE REG REGISTERED ORD ORDINARY SHARES SHS COMMON STOCK'.split(' '),
);
/** Deja el nombre de una empresa en una forma comparable: "Amazon.com Inc." y "AMAZON COM INC" dan lo mismo. */
function clave(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !SOBRAN.has(t))
    .join(' ');
}

// ───────────── Trade Republic: PDF oficial "Universo de inversión" ─────────────

async function etfsDeTradeRepublic() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await descargar('https://assets.traderepublic.com/assets/files/ES/Instrument_Universe_ES_es.pdf');
  const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const etfs = new Set();
  let seccion = '';
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const textos = (await pagina.getTextContent()).items.map((i) => i.str.trim()).filter(Boolean);
    for (let i = 0; i < textos.length; i++) {
      // Cada sección empieza con "UNIVERSO DE INVERSIÓN -" y debajo su nombre (Acciones, ETF…).
      if (/^UNIVERSO DE INVERSI.N\s*-$/.test(textos[i]) && textos[i + 1]) seccion = textos[i + 1].toUpperCase();
      else if (seccion === 'ETF' && ES_ISIN.test(textos[i])) etfs.add(textos[i]);
    }
  }
  if (etfs.size < 100) throw new Error(`solo se han leído ${etfs.size} ETFs; el formato del PDF puede haber cambiado`);
  return etfs;
}

// ───────────── Carteras: un lector por gestora ─────────────
// Cada lector devuelve { fecha, isin?, posiciones: [{ nombre, isin?, simbolo?, pais, sector, peso }] } con el peso en %.

async function carteraIshares(fondo) {
  const url = `https://www.ishares.com/ch/individual/en/products/${fondo.clave}/x/1495092304805.ajax?fileType=csv&fileName=cartera&dataType=fund`;
  const lineas = (await descargar(url)).toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
  const fecha = fechaIso(lineas[0]);
  const iCab = lineas.findIndex((l) => l.startsWith('Ticker,'));
  if (iCab < 0) throw new Error('el archivo no tiene el formato esperado');
  const cab = trocearCsv(lineas[iCab]);
  const col = (n) => cab.indexOf(n);
  const posiciones = [];
  for (const linea of lineas.slice(iCab + 1)) {
    const c = trocearCsv(linea);
    if (c.length < cab.length || c[col('Asset Class')] !== 'Equity') continue;
    const peso = Number(c[col('Weight (%)')]);
    if (!(peso > 0)) continue;
    posiciones.push({
      nombre: c[col('Name')],
      simbolo: c[col('Ticker')],
      pais: c[col('Location')],
      sector: c[col('Sector')],
      peso,
    });
  }
  return { fecha, posiciones };
}

async function hojaExcel(buffer) {
  const r = await leerExcel(buffer);
  // Según la versión de la librería, devuelve las filas o una lista de hojas con sus filas.
  if (r.length && r[0] && !Array.isArray(r[0]) && r[0].data) return { nombre: String(r[0].sheet ?? ''), filas: r[0].data };
  return { nombre: '', filas: r };
}

async function carteraXtrackers(fondo) {
  const url = `https://etf.dws.com/etfdata/export/GBR/ENG/excel/product/constituent/${fondo.isin}/`;
  const { nombre, filas } = await hojaExcel(await descargar(url));
  const iCab = filas.findIndex((f) => f.includes('ISIN') && f.includes('Weighting'));
  if (iCab < 0) throw new Error('el archivo no tiene el formato esperado');
  const cab = filas[iCab];
  const col = (n) => cab.indexOf(n);
  const posiciones = [];
  for (const f of filas.slice(iCab + 1)) {
    if (f[col('Type of Security')] !== 'Equities') continue;
    const peso = Number(f[col('Weighting')]) * 100;
    if (!(peso > 0)) continue;
    posiciones.push({
      nombre: String(f[col('Name')]),
      isin: f[col('ISIN')],
      pais: f[col('Country')],
      sector: f[col('Industry Classification')],
      peso,
    });
  }
  return { fecha: /^\d{4}-\d{2}-\d{2}$/.test(nombre) ? nombre : null, posiciones };
}

async function carteraSpdr(fondo) {
  const url = `https://www.ssga.com/library-content/products/fund-data/etfs/emea/holdings-daily-emea-en-${fondo.clave.toLowerCase()}-gy.xlsx`;
  const { filas } = await hojaExcel(await descargar(url));
  const dato = (rotulo) => filas.find((f) => String(f[0] ?? '').startsWith(rotulo))?.[1];
  const iCab = filas.findIndex((f) => f.includes('ISIN') && f.includes('Percent of Fund'));
  if (iCab < 0) throw new Error('el archivo no tiene el formato esperado');
  const cab = filas[iCab];
  const col = (n) => cab.indexOf(n);
  const posiciones = [];
  for (const f of filas.slice(iCab + 1)) {
    const isin = f[col('ISIN')];
    const peso = Number(f[col('Percent of Fund')]);
    if (typeof isin !== 'string' || !ES_ISIN.test(isin) || !(peso > 0)) continue;
    posiciones.push({
      nombre: String(f[col('Security Name')]),
      isin,
      pais: f[col('Trade Country Name')],
      sector: f[col('Sector Classification')],
      peso,
    });
  }
  return { fecha: fechaIso(dato('Holdings As Of')), isin: dato('ISIN'), posiciones };
}

const LECTORES = { ishares: carteraIshares, xtrackers: carteraXtrackers, spdr: carteraSpdr };
const WEB_GESTORA = {
  ishares: (f) => `https://www.ishares.com/uk/individual/en/products/${f.clave}/x`,
  xtrackers: (f) => `https://etf.dws.com/en-gb/${f.isin}/`,
  spdr: () => 'https://www.ssga.com/es/es/intermediary/etfs/fund-finder',
};
const DOMICILIOS = { IE: 'Irlanda', LU: 'Luxemburgo', DE: 'Alemania', FR: 'Francia', ES: 'España', NL: 'Países Bajos' };

// ───────────── Programa principal ─────────────

function repartir(posiciones, campo, maximo) {
  const suma = new Map();
  let total = 0;
  for (const p of posiciones) {
    suma.set(p[campo], (suma.get(p[campo]) ?? 0) + p.peso);
    total += p.peso;
  }
  const orden = [...suma.entries()].sort((a, b) => b[1] - a[1]);
  const lista = orden.slice(0, maximo).map(([n, v]) => ({ n, p: +((v / total) * 100).toFixed(1) }));
  const resto = orden.slice(maximo).reduce((s, [, v]) => s + v, 0);
  if (resto > 0) lista.push({ n: 'Resto', p: +((resto / total) * 100).toFixed(1) });
  return lista;
}

async function principal() {
  await mkdir(DATOS, { recursive: true });
  const lista = await leerLista('fondos.csv', ['isin', 'nombre', 'gestora', 'tipo', 'comision', 'region', 'tema', 'fuente', 'clave']);
  const deMyInvestor = await leerLista('myinvestor.csv', ['isin', 'nombre', 'confirmado']);
  console.log(`Lista de fondos: ${lista.length}. Lista de MyInvestor: ${deMyInvestor.length}.`);

  const leerAnterior = async (archivo) => {
    const ruta = path.join(DATOS, archivo);
    if (!existsSync(ruta)) return null;
    try {
      return JSON.parse(await readFile(ruta, 'utf8'));
    } catch {
      return null;
    }
  };
  const fondosAntes = await leerAnterior('fondos.json');
  const carterasAntes = await leerAnterior('carteras.json');

  // 1) Trade Republic
  let etfsTR = null;
  try {
    etfsTR = await etfsDeTradeRepublic();
    console.log(`Trade Republic: ${etfsTR.size} ETFs en su PDF oficial.`);
  } catch (e) {
    console.warn(`Trade Republic: no se ha podido leer el PDF (${e.message}). Se conserva lo anterior.`);
  }

  // 2) Carteras
  const carteras = new Map(); // posición en la lista -> { fecha, posiciones }
  for (const [i, fondo] of lista.entries()) {
    const lector = LECTORES[fondo.fuente];
    if (!lector) continue;
    try {
      const c = await lector(fondo);
      if (c.posiciones.length === 0) throw new Error('cartera vacía');
      if (c.isin && !fondo.isin) fondo.isin = c.isin;
      carteras.set(i, c);
      console.log(`  ${fondo.nombre}: ${c.posiciones.length} posiciones (${c.fecha ?? 'sin fecha'})`);
    } catch (e) {
      console.warn(`  ${fondo.nombre}: no se ha podido descargar la cartera (${e.message})`);
    }
    await esperar(700); // sin prisas, para no cargar las webs de las gestoras
  }

  // 3) Juntar empresas. Las de SPDR van primero porque traen el nombre mejor escrito.
  const empresas = []; // [nombre, país, sector, símbolo]
  const porClave = new Map();
  const porIsin = new Map();
  const anotar = (p) => {
    const k = clave(p.nombre);
    let idx = (p.isin && porIsin.get(p.isin)) ?? porClave.get(k);
    if (idx === undefined) {
      idx = empresas.length;
      empresas.push([p.nombre, paisEs(p.pais), sectorEs(p.sector), '']);
    }
    if (p.isin) porIsin.set(p.isin, idx);
    if (k && !porClave.has(k)) porClave.set(k, idx);
    if (p.simbolo && !empresas[idx][3] && /^[A-Z0-9.]{1,6}$/.test(p.simbolo)) empresas[idx][3] = p.simbolo;
    return idx;
  };
  const orden = [...carteras.keys()].sort(
    (a, b) => (lista[a].fuente === 'spdr' ? 0 : lista[a].fuente === 'xtrackers' ? 1 : 2) - (lista[b].fuente === 'spdr' ? 0 : lista[b].fuente === 'xtrackers' ? 1 : 2),
  );

  const carterasSalida = {};
  const resumenCartera = {};
  for (const i of orden) {
    const fondo = lista[i];
    const { fecha, posiciones } = carteras.get(i);
    posiciones.sort((a, b) => b.peso - a.peso);
    const pesos = new Map();
    for (const p of posiciones) {
      const idx = anotar(p);
      pesos.set(idx, (pesos.get(idx) ?? 0) + p.peso);
    }
    carterasSalida[fondo.isin] = [...pesos.entries()].filter(([, v]) => v >= 0.005).map(([idx, v]) => [idx, +v.toFixed(2)]);
    const traducidas = posiciones.map((p) => ({ ...p, pais: paisEs(p.pais), sector: sectorEs(p.sector) }));
    resumenCartera[fondo.isin] = {
      fechaCartera: fecha,
      nPosiciones: posiciones.length,
      top: posiciones.slice(0, 10).map((p) => ({ n: empresas[anotar(p)][0], p: +p.peso.toFixed(2) })),
      sectores: repartir(traducidas, 'sector', 11),
      paises: repartir(traducidas, 'pais', 8),
    };
  }

  // Fondos cuya descarga ha fallado hoy: se recupera su cartera del archivo anterior.
  if (carterasAntes && fondosAntes) {
    for (const fondo of lista) {
      if (!fondo.fuente || !fondo.isin || carterasSalida[fondo.isin] || !carterasAntes.fondos?.[fondo.isin]) continue;
      carterasSalida[fondo.isin] = carterasAntes.fondos[fondo.isin].map(([idxViejo, peso]) => {
        const [nombre, pais, sector, simbolo] = carterasAntes.empresas[idxViejo];
        const k = clave(nombre);
        let idx = porClave.get(k);
        if (idx === undefined) {
          idx = empresas.length;
          empresas.push([nombre, pais, sector, simbolo]);
          porClave.set(k, idx);
        }
        return [idx, peso];
      });
      const antes = fondosAntes.fondos?.find((f) => f.isin === fondo.isin);
      if (antes) {
        resumenCartera[fondo.isin] = {
          fechaCartera: antes.fechaCartera,
          nPosiciones: antes.nPosiciones,
          top: antes.top,
          sectores: antes.sectores,
          paises: antes.paises,
        };
      }
      console.log(`  ${fondo.nombre}: se conserva la cartera anterior.`);
    }
  }

  // 4) Ficha de cada fondo
  const mi = new Map(deMyInvestor.map((f) => [f.isin, /^s[ií]$/i.test(f.confirmado)]));
  const trAntes = new Set((fondosAntes?.fondos ?? []).filter((f) => f.tradeRepublic).map((f) => f.isin));
  const fondos = [];
  for (const fondo of lista) {
    if (!ES_ISIN.test(fondo.isin)) {
      console.warn(`  ${fondo.nombre}: sin ISIN válido, no se incluye.`);
      continue;
    }
    const comision = fondo.comision ? Number(fondo.comision.replace(',', '.')) : null;
    fondos.push({
      isin: fondo.isin,
      nombre: fondo.nombre,
      gestora: fondo.gestora,
      tipo: fondo.tipo === 'Fondo' ? 'Fondo' : 'ETF',
      comision: Number.isFinite(comision) ? comision : null,
      domicilio: DOMICILIOS[fondo.isin.slice(0, 2)] ?? fondo.isin.slice(0, 2),
      region: fondo.region || 'Sin clasificar',
      tema: fondo.tema || 'General',
      tradeRepublic: etfsTR ? etfsTR.has(fondo.isin) : trAntes.has(fondo.isin),
      myInvestor: mi.has(fondo.isin) ? (mi.get(fondo.isin) ? 'si' : 'por confirmar') : 'no',
      web: WEB_GESTORA[fondo.fuente]?.(fondo) ?? null,
      fechaCartera: null,
      nPosiciones: null,
      top: [],
      sectores: [],
      paises: [],
      ...(resumenCartera[fondo.isin] ?? {}),
    });
  }

  const hoy = new Date().toISOString();
  await writeFile(
    path.join(DATOS, 'fondos.json'),
    JSON.stringify({ actualizado: hoy, etfsTradeRepublic: etfsTR?.size ?? fondosAntes?.etfsTradeRepublic ?? null, fondos }),
  );
  await writeFile(path.join(DATOS, 'carteras.json'), JSON.stringify({ actualizado: hoy, empresas, fondos: carterasSalida }));
  const conCartera = fondos.filter((f) => f.nPosiciones).length;
  console.log(`\nGuardado: ${fondos.length} fondos (${conCartera} con cartera) y ${empresas.length} empresas distintas.`);
}

principal().catch((e) => {
  console.error('El recolector de fondos ha fallado:', e);
  process.exit(1);
});
