// RECOLECTOR DE NOTICIAS (fase 4)
// Descarga las noticias de la última semana y las fechas de resultados. Se ejecuta con:  npm run noticias
// (va después de «npm run empresas», porque usa su lista de empresas).
//
//   noticias.json       -> noticias generales del mercado y calendario de resultados del S&P 500
//   noticias/XXX.json   -> noticias de cada empresa (las últimas, como mucho 10)
//
// Fuente: Finnhub (la misma clave FINNHUB_API_KEY). Cada noticia lleva el medio que la publica y el enlace
// al original. Atlas no copia el texto de la noticia: solo el titular, el medio y el enlace.
//
// Sin inteligencia artificial: el tipo de noticia y el aviso «Sin confirmar» se deciden buscando palabras
// clave en el titular (las listas están más abajo y se pueden ampliar). Alguna vez puede equivocarse.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'public', 'datos');
const CARPETA = path.join(SALIDA, 'noticias');

try {
  process.loadEnvFile(path.join(RAIZ, '.env'));
} catch {
  /* sin archivo .env: no pasa nada */
}

const CLAVE = process.env.FINNHUB_API_KEY;
const DIAS = 86_400_000;
const POR_EMPRESA = 10;
// «--solo=AAPL,MSFT» solo renueva esas empresas (para probar sin esperar 10 minutos).
const SOLO = process.argv.find((a) => a.startsWith('--solo='))?.slice('--solo='.length).split(',');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);

let ultima = 0;
/** Pide algo a Finnhub sin pasar de 55 consultas por minuto. Devuelve null si no hay dato. */
async function finnhub(ruta) {
  for (let i = 1; ; i++) {
    const falta = ultima + 1100 - Date.now();
    if (falta > 0) await esperar(falta);
    ultima = Date.now();
    try {
      const r = await fetch(`https://finnhub.io/api/v1/${ruta}&token=${CLAVE}`, { signal: AbortSignal.timeout(30_000) });
      if (r.status === 429) {
        await esperar(20_000);
        throw new Error('límite por minuto');
      }
      if (r.status === 403 || r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch {
      if (i >= 3) return null;
      await esperar(2000 * i);
    }
  }
}

// ───────────────────────── Clasificar titulares ─────────────────────────

// Tipo de noticia: gana el primero de la lista que encaje con el titular.
const TIPOS = [
  ['Resultados', /\b(earnings|results|quarter(ly)?|Q[1-4]|revenue|sales|profit|EPS|guidance|outlook|forecasts?)\b/i],
  ['Compra o fusión', /\b(acquir\w*|acquisition|merger|merge|takeover|buyout|(agrees|deal|offer|bid) to buy|bid for|stake in|spin-?off)\b/i],
  ['Justicia y reguladores', /\b(lawsuit|sues?|sued|court|judge|antitrust|regulators?|regulatory|FTC|DOJ|probe|investigation|fined?|settle\w*|ban|tariffs?|sanctions?)\b/i],
  ['Directivos', /\b(CEO|CFO|chief executive|executives?|resign\w*|steps? down|appoint\w*|chairman|chairwoman|names new|successor)\b/i],
  ['Analistas', /\b(upgrades?|upgraded|downgrades?|downgraded|price targets?|analysts?|rating|outperform|underperform|overweight|underweight|initiates? coverage)\b/i],
  ['Dividendos y recompras', /\b(dividends?|buybacks?|repurchase\w*|share split|stock split)\b/i],
  ['Productos', /\b(launch\w*|unveil\w*|introduc\w*|new (product|model|chip|phone|drug|service)|FDA|approval|approved|trial)\b/i],
  ['La acción en bolsa', /\b(stocks?|shares) (\w+ )?(falls?|fell|drops?|dropped|jumps?|jumped|soars?|soared|surges?|surged|slides?|slid|sinks?|sank|rall(y|ies|ied)|tumbles?|tumbled|plunges?|plunged|climbs?|climbed|rises?|rose|gains?|gained|slumps?|slumped)\b|\b(up|down|soars?|jumps?|falls?|drops?|sinks?|slides?|surges?|climbs?|rises?|tumbles?|plunges?) (more than |over |nearly |about )?\d+(\.\d+)?%/i],
  ['Empleo y plantilla', /\b(layoffs?|lay off|job cuts?|cuts? jobs|hiring|workers strike|on strike)\b/i],
];

// «Sin confirmar»: el titular habla de rumores, fuentes anónimas o de algo que podría pasar.
const RUMOR =
  /\b(reportedly|reports? say|report says|according to (a )?(report|people|sources)|sources? (say|said|tell)|people familiar|familiar with the matter|in talks|early talks|considering|considers|weighs|weighing|mulls?|explor(es|ing)|said to be|rumou?rs?|rumou?red|speculation|could|may|might|eyes|nears? (a )?deal)\b/i;

// «Opinión»: artículos que opinan o recomiendan, no que cuentan un hecho.
const OPINION =
  /(\bCramer\b|Motley Fool|\bWe're (buying|adding|selling|trimming)\b|should you|is it time|stocks? to (buy|sell|watch)|buy now|top pick|my favorite|I'd buy|I would|better buy|millionaire|retire|\bbuy or sell\b|\?\s*$)/i;
const MEDIOS_OPINION = new Set(['SeekingAlpha', 'Motley Fool']);

function clasificar(titular, medio) {
  const tipo = TIPOS.find(([, re]) => re.test(titular))?.[0] ?? 'Otras';
  const opinion = OPINION.test(titular) || MEDIOS_OPINION.has(medio);
  const rumor = !opinion && RUMOR.test(titular);
  return { tipo, ...(rumor ? { rumor: true } : {}), ...(opinion ? { opinion: true } : {}) };
}

/** Noticia tal como la guarda Atlas: titular, medio, enlace, fecha (segundos) y etiquetas. */
function limpiar(n) {
  const titular = String(n.headline ?? '')
    .replace(/\s+-\s+Reuters\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const medio = String(n.source ?? '').trim();
  if (!titular || !n.url || !n.datetime) return null;
  return { t: titular, f: medio, u: n.url, d: n.datetime, ...clasificar(titular, medio) };
}

// Notas de prensa de estudios de mercado que nombran a muchas empresas: no aportan nada.
const RELLENO = /(Strategic Business Report|Market Report|Market Size|Market Share|CAGR|ResearchAndMarkets|Industry Analysis|Forecast to 20\d\d)/i;

// ───────────────────────── ¿La noticia habla de esta empresa? ─────────────────────────

// Finnhub devuelve muchas noticias generales junto a las de cada empresa. Nos quedamos con las que
// nombran a la empresa en el titular. Nombres que la prensa usa y que no salen de su nombre oficial:
const OTROS_NOMBRES = {
  GOOGL: ['Google', 'YouTube', 'Waymo'],
  GOOG: ['Google', 'YouTube', 'Waymo'],
  META: ['Facebook', 'Instagram', 'WhatsApp'],
  LLY: ['Lilly'],
  XOM: ['Exxon'],
  JPM: ['JPMorgan', 'JP Morgan'],
  BRK: ['Berkshire', 'Buffett'],
  'BRK.B': ['Berkshire', 'Buffett'],
  KO: ['Coca-Cola', 'Coke'],
  PG: ['P&G', 'Procter'],
  HD: ['Home Depot'],
  BAC: ['BofA', 'Bank of America'],
  GS: ['Goldman'],
  MS: ['Morgan Stanley'],
  UNH: ['UnitedHealth'],
  TSLA: ['Musk'],
  MCD: ["McDonald's"],
  DIS: ['Disney'],
  NFLX: ['Netflix'],
  WFC: ['Wells Fargo'],
};
const GENERICAS = new Set(['American', 'General', 'United', 'First', 'Global', 'International', 'National', 'Public', 'Digital', 'Eli', 'The', 'Applied', 'Advanced', 'Federal', 'Southern', 'Western', 'Universal', 'Old']);
const SUFIJOS = /\b(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.?|Class [A-C]|Holdings?|Group|plc|PLC|Ltd\.?|N\.?V\.?|S\.?A\.?|Limited|Trust|REIT|The)\b|[,.]/g;

function nombresDe(e) {
  const limpio = e.n.replace(SUFIJOS, ' ').replace(/\s+/g, ' ').trim();
  const palabras = limpio.split(' ');
  const lista = new Set([limpio, ...(OTROS_NOMBRES[e.t] ?? [])]);
  if (palabras.length > 1 && palabras[0].length >= 4 && !GENERICAS.has(palabras[0])) lista.add(palabras[0]);
  if (palabras.length > 2) lista.add(palabras.slice(0, 2).join(' '));
  return [...lista].filter((x) => x.length >= 3);
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hablaDe(e) {
  const nombres = nombresDe(e).map((x) => new RegExp(`(^|[^\\w])${escapar(x)}(?![\\w])`, 'i'));
  const simbolo = new RegExp(`(^|[^\\w$])\\$?${escapar(e.t)}(?![\\w])`);
  /** 0 = no la nombra; 1 = la nombra; 2 = la nombra al principio (suele ser la protagonista). */
  return (titular) => {
    let pos = simbolo.exec(titular)?.index ?? -1;
    for (const re of nombres) {
      const m = re.exec(titular);
      if (!m) continue;
      // El nombre tiene que ir con mayúscula, para no confundir «Apple» con «apple».
      const letra = titular[m.index + m[1].length];
      if (letra !== letra.toUpperCase()) continue;
      if (pos < 0 || m.index < pos) pos = m.index;
    }
    return pos < 0 ? 0 : pos <= 25 ? 2 : 1;
  };
}

/** ¿Se publicó entre el cierre de la sesión anterior y el cierre de la sesión «fecha»? (igual que en la app) */
function enSesion(segundos, fecha) {
  if (!fecha) return false;
  const d = new Date(`${fecha}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  const desde = Date.parse(`${d.toISOString().slice(0, 10)}T20:00:00Z`) / 1000;
  const hasta = Date.parse(`${fecha}T21:00:00Z`) / 1000;
  return segundos >= desde && segundos <= hasta;
}

// ───────────────────────── Programa ─────────────────────────

async function main() {
  console.log('Noticias: preparando…');
  if (!CLAVE) {
    console.log('   Falta FINNHUB_API_KEY: no se descargan noticias.');
    return;
  }
  const rutaEmpresas = path.join(SALIDA, 'empresas.json');
  if (!existsSync(rutaEmpresas)) {
    console.log('   Falta empresas.json: ejecuta antes «npm run empresas».');
    return;
  }
  const todas = JSON.parse(await readFile(rutaEmpresas, 'utf8')).empresas;
  const empresas = SOLO ? todas.filter((e) => SOLO.includes(e.t)) : todas;
  const rutaIndice = path.join(SALIDA, 'noticias.json');
  const anterior = existsSync(rutaIndice) ? JSON.parse(await readFile(rutaIndice, 'utf8')) : null;
  const simbolos = new Set(todas.map((e) => e.t));
  const ahora = Date.now();
  const desde = dia(ahora - 7 * DIAS);
  const hasta = dia(ahora);

  // 1) Noticias generales del mercado
  const generales = await finnhub('news?category=general&minId=0');
  const vistos = new Set();
  const mercado = (generales ?? [])
    .map(limpiar)
    .filter((n) => n && !vistos.has(n.t.toLowerCase()) && vistos.add(n.t.toLowerCase()))
    .sort((a, b) => b.d - a.d)
    .slice(0, 40);
  console.log(`   ${mercado.length} noticias generales`);

  // 2) Calendario de resultados: 10 días atrás y 3 semanas adelante, solo empresas del S&P 500
  const calendario = await finnhub(`calendar/earnings?from=${dia(ahora - 10 * DIAS)}&to=${dia(ahora + 21 * DIAS)}`);
  const resultados = {};
  for (const r of calendario?.earningsCalendar ?? []) {
    if (!simbolos.has(r.symbol)) continue;
    (resultados[r.symbol] ??= []).push({
      d: r.date,
      // bmo = antes de abrir la bolsa; amc = tras el cierre; vacío = no se sabe
      h: r.hour || '',
      bE: r.epsEstimate ?? null,
      bR: r.epsActual ?? null,
      iE: r.revenueEstimate ?? null,
      iR: r.revenueActual ?? null,
    });
  }
  console.log(`   ${Object.keys(resultados).length} empresas con resultados en el calendario`);

  // 3) Noticias de cada empresa (una consulta por empresa: unos 10 minutos)
  await mkdir(CARPETA, { recursive: true });
  let conNoticias = 0;
  let fallos = 0;
  for (const [i, e] of empresas.entries()) {
    const lista = await finnhub(`company-news?symbol=${encodeURIComponent(e.t)}&from=${desde}&to=${hasta}`);
    if (!Array.isArray(lista)) {
      fallos++;
      continue; // se conserva el archivo anterior
    }
    const habla = hablaDe(e);
    const vistas = new Set();
    // Se eligen las más útiles (las que tratan de la empresa y cuentan un hecho) y se ordenan por fecha.
    const noticias = lista
      .map(limpiar)
      .filter((n) => n && !RELLENO.test(n.t) && !vistas.has(n.t.toLowerCase()) && vistas.add(n.t.toLowerCase()))
      .map((n) => ({ n, puntos: habla(n.t) }))
      .filter((x) => x.puntos > 0)
      .map((x) => ({ ...x, puntos: x.puntos + (x.n.tipo !== 'Otras' ? 1 : 0) - (x.n.opinion ? 1 : 0) }))
      .sort((a, b) => b.puntos - a.puntos || b.n.d - a.n.d)
      // Las de la última sesión van siempre (hasta 5): son las que explican «¿por qué se ha movido?».
      .map((x) => ({ ...x, deSesion: enSesion(x.n.d, e.fecha) }))
      .sort((a, b) => Number(b.deSesion) - Number(a.deSesion))
      .filter((x, i, todas) => !x.deSesion || todas.slice(0, i).filter((y) => y.deSesion).length < 5)
      .slice(0, POR_EMPRESA)
      .map((x) => x.n)
      .sort((a, b) => b.d - a.d);
    if (noticias.length) conNoticias++;
    await writeFile(path.join(CARPETA, `${e.t}.json`), JSON.stringify({ t: e.t, actualizado: new Date(ahora).toISOString(), n: noticias }), 'utf8');
    if ((i + 1) % 50 === 0) console.log(`   empresas: ${i + 1} de ${empresas.length}`);
  }
  console.log(`   ${conNoticias} empresas con noticias propias; ${fallos} sin respuesta`);

  // Si una parte falla, se conserva la de la vez anterior.
  await writeFile(
    rutaIndice,
    JSON.stringify({
      actualizado: new Date(ahora).toISOString(),
      mercado: generales ? mercado : (anterior?.mercado ?? []),
      resultados: calendario ? resultados : (anterior?.resultados ?? {}),
      porSector: await agruparPorSector(todas, (generales ?? []).map(limpiar).filter(Boolean)),
    }),
    'utf8',
  );
  console.log('   guardado noticias.json');
}

// ───────────────────────── Noticias por sector ─────────────────────────

// Temas de cada sector: palabras que, si salen en un titular, hacen que la noticia sea del sector aunque no
// nombre a ninguna gran empresa (el precio del petróleo, los tipos de interés, la FDA…). Se pueden ampliar.
const TEMAS = {
  'Tecnología': /\b(semiconductors?|chips?|chipmakers?|AI (spending|boom|bubble|stocks|infrastructure)|artificial intelligence|data cent(er|re)s?|cloud computing|software stocks|tech stocks|tech sector|export controls?)\b/i,
  'Comunicación': /\b(streaming|advertising|ad market|ad spending|telecoms?|5G|social media|media stocks|box office|wireless carriers?|broadband)\b/i,
  'Consumo no esencial': /\b(retail sales|consumer spending|retailers?|holiday (shopping|sales|season)|Black Friday|Cyber Monday|automakers?|car sales|auto sales|electric vehicles?|EV (sales|makers?|demand)|homebuilders?|travel demand|cruise|restaurants?)\b/i,
  Salud: /\b(FDA|drugmakers?|pharma\w*|biotechs?|Medicare|Medicaid|health insurers?|drug pric\w*|vaccines?|obesity drugs?|GLP-1|hospitals?|healthcare stocks|health care stocks)\b/i,
  'Consumo básico': /\b(food prices|grocer\w*|consumer staples|packaged food|beverages?|tobacco|supermarkets?|egg prices|cocoa|coffee prices)\b/i,
  Finanzas: /\b(banks?(?! of America)|banking|lenders?|Federal Reserve|Fed (chair|officials?|meeting|minutes|rate)|rate cuts?|rate hikes?|interest rates?|Treasury yields?|bond yields?|credit cards?|insurers?|brokerages?|private credit|bank stocks)\b/i,
  'Energía': /\b(oil|crude|OPEC\+?|natural gas|LNG|gasoline|refiner(y|ies|s)|drilling|shale|Brent|WTI|barrels?|energy stocks)\b/i,
  Industria: /\b(airlines?|aerospace|defen[cs]e (spending|contractors?|stocks|budget)|Pentagon|manufacturing|factory|factories|freight|railroads?|trucking|shipping|infrastructure|tariffs?|industrial stocks|jobs report|payrolls)\b/i,
  Materiales: /\b(copper|gold|silver|steel|alumin(um|ium)|lithium|mining|miners|chemicals?|fertili[sz]ers?|commodit(y|ies)|iron ore|rare earths?)\b/i,
  Inmobiliario: /\b(real estate|REITs?|housing (market|starts)|home sales|home prices|mortgage rates?|commercial property|office (space|market|vacanc\w*)|rents?|landlords?|data center REIT)\b/i,
  'Suministros (luz, agua, gas)': /\b(utilit(y|ies)|power grid|electricity|power (prices|demand|plants?)|nuclear (power|energy|plant)|renewables?|solar|wind (power|farms?)|electric bills?)\b/i,
};

const ANALISTAS = TIPOS.find(([t]) => t === 'Analistas')[1];
const ACCION ='La acción en bolsa';
/** Puntos de una noticia: hechos antes que opiniones, y lo reciente antes que lo de hace días. */
function puntosNoticia(n, ahora) {
  let p = 0;
  if (n.tipo !== 'Otras') p += n.tipo === ACCION ? 1 : 2;
  if (n.opinion) p -= 3;
  if (n.rumor) p -= 1;
  const horas = (ahora / 1000 - n.d) / 3600;
  p += horas < 24 ? 2 : horas < 48 ? 1 : 0;
  return p;
}

/**
 * Noticias de cada sector, en dos listas:
 *  - empresas: lo más relevante de sus empresas (como mucho 3 por empresa). Suman puntos las empresas grandes,
 *    las noticias que cuentan un hecho, las recientes y las de empresas que se han movido mucho ese día.
 *  - tema: noticias del sector en general, aunque no hablen de una gran empresa (salen de las noticias del
 *    mercado y de las de todas las empresas, buscando las palabras de TEMAS).
 * Cada noticia de «empresas» lleva «s», el símbolo de su empresa.
 */
async function agruparPorSector(todas, generales = []) {
  const ahora = Date.now();
  const hace7 = ahora / 1000 - 7 * 86_400;
  const leidas = new Map();
  for (const e of todas) {
    const ruta = path.join(CARPETA, `${e.t}.json`);
    if (existsSync(ruta)) leidas.set(e.t, JSON.parse(await readFile(ruta, 'utf8')).n);
  }

  const sectores = [...new Set(todas.map((e) => e.s).filter(Boolean))];
  const porSector = {};
  for (const sector of sectores) {
    const suyas = todas.filter((e) => e.s === sector).sort((a, b) => b.pesoSP - a.pesoSP);
    // Puesto de cada empresa por tamaño dentro del sector
    const puesto = new Map(suyas.map((e, i) => [e.t, i]));

    const candidatas = [];
    for (const e of suyas) {
      const movida = typeof e.cambio === 'number' && Math.abs(e.cambio) >= 3;
      const p = puesto.get(e.t);
      const extra = (p < 5 ? 3 : p < 15 ? 2 : p < 30 ? 1 : 0);
      const lista = (leidas.get(e.t) ?? [])
        .filter((n) => n.d >= hace7)
        .map((n) => ({ n: { ...n, s: e.t }, puntos: puntosNoticia(n, ahora) + extra + (movida && enSesion(n.d, e.fecha) ? 3 : 0) }))
        .sort((a, b) => b.puntos - a.puntos || b.n.d - a.n.d)
        .slice(0, 3);
      candidatas.push(...lista);
    }
    const vistas = new Set();
    const empresas = candidatas
      .sort((a, b) => b.puntos - a.puntos || b.n.d - a.n.d)
      .filter((x) => !vistas.has(x.n.t.toLowerCase()) && vistas.add(x.n.t.toLowerCase()))
      .slice(0, 20)
      .map((x) => x.n);

    // Noticias del tema del sector (de cualquier origen), sin repetir las de arriba
    const tema = TEMAS[sector];
    const deTema = [];
    if (tema) {
      const origen = [...generales, ...[...leidas.values()].flat()];
      for (const n of origen) {
        // Las notas de analistas sobre una sola acción no son noticias del sector.
        if (n.d < hace7 || !tema.test(n.t) || RELLENO.test(n.t) || ANALISTAS.test(n.t)) continue;
        const clave = n.t.toLowerCase();
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        const { s: _s, ...limpia } = n;
        deTema.push({ n: limpia, puntos: puntosNoticia(n, ahora) });
      }
    }
    porSector[sector] = {
      empresas,
      tema: deTema
        .sort((a, b) => b.puntos - a.puntos || b.n.d - a.n.d)
        .slice(0, 15)
        .map((x) => x.n),
    };
  }
  console.log(`   noticias agrupadas en ${sectores.length} sectores`);
  return porSector;
}

// «--solo-sectores» rehace solo la agrupación por sector con las noticias ya guardadas (sin descargar nada).
if (process.argv.includes('--solo-sectores')) {
  const todas = JSON.parse(await readFile(path.join(SALIDA, 'empresas.json'), 'utf8')).empresas;
  const rutaIndice = path.join(SALIDA, 'noticias.json');
  const indice = JSON.parse(await readFile(rutaIndice, 'utf8'));
  indice.porSector = await agruparPorSector(todas, indice.mercado ?? []);
  await writeFile(rutaIndice, JSON.stringify(indice), 'utf8');
  process.exit(0);
}

main().catch((e) => {
  console.error('Error en noticias:', e.message);
  process.exitCode = 1;
});
