// RECOLECTOR DE EMPRESAS (fase 3)
// Prepara los datos de la ficha de empresa y del buscador de empresas. Se ejecuta con:  npm run empresas
//
//   empresas.json        -> lista de empresas con precio, tamaño e indicadores
//   historicos/XXX.json  -> precio de cierre semanal de los últimos 5 años (para el gráfico)
//
// De dónde sale cada cosa:
//   · Qué empresas: las del S&P 500, tal como aparecen en la cartera que publica iShares (carteras.json).
//   · Precio e indicadores: Finnhub (clave FINNHUB_API_KEY). Su plan gratuito solo cubre EE. UU.
//   · Ingresos y beneficios de cada año: SEC EDGAR, el registro oficial de EE. UU. (sin clave).
//   · Historial de precios: Twelve Data (clave TWELVEDATA_API_KEY, 800 consultas al día).
//
// Para no pasarse de los límites gratuitos: el precio se pide cada día; los indicadores, las cuentas y
// el historial solo se renuevan cuando tienen más de 6 días. Si algo falla se conserva lo anterior.
// Con «npm run empresas -- --todo» se fuerza a renovarlo todo.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'public', 'datos');
const HISTORICOS = path.join(SALIDA, 'historicos');

try {
  process.loadEnvFile(path.join(RAIZ, '.env'));
} catch {
  /* sin archivo .env: no pasa nada */
}

const CLAVE_FINNHUB = process.env.FINNHUB_API_KEY;
const CLAVE_TWELVE = process.env.TWELVEDATA_API_KEY;
const TODO = process.argv.includes('--todo');
// Cuántos historiales se renuevan como mucho en cada ejecución (cada uno gasta 1 consulta de las 800 diarias).
const MAX_HISTORICOS = Number(process.argv.find((a) => a.startsWith('--historicos='))?.split('=')[1] ?? 110);
const FONDO_SP500 = 'IE00B5BMR087'; // iShares Core S&P 500: su cartera es nuestra lista de empresas
// «--solo-historicos» se salta precios y cuentas: sirve para rellenar los gráficos la primera vez.
const SOLO_HISTORICOS = process.argv.includes('--solo-historicos');
// «--solo-cuentas» se salta precios y gráficos: solo descarga ingresos y beneficios de la SEC.
const SOLO_CUENTAS = process.argv.includes('--solo-cuentas');
const DIAS = 86_400_000;
// La SEC exige que cada programa se identifique con un correo de contacto real.
// Va en el archivo .env (SEC_CONTACTO=...) para que no quede a la vista en el proyecto.
const AGENTE_SEC = `Atlas ${process.env.SEC_CONTACTO?.trim() || '4ATriasB5@users.noreply.github.com'}`;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const viejo = (fecha, dias = 6) => TODO || !fecha || Date.now() - new Date(fecha).getTime() > dias * DIAS;
const redondo = (v, dec = 2) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(dec)) : null);

async function leerJson(ruta) {
  if (!existsSync(ruta)) return null;
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch {
    return null;
  }
}

// ───────────────────────── Finnhub ─────────────────────────

let ultimaFinnhub = 0;
/** Pide algo a Finnhub sin pasar de 55 consultas por minuto. Devuelve null si no hay dato. */
async function finnhub(ruta) {
  for (let i = 1; ; i++) {
    const falta = ultimaFinnhub + 1100 - Date.now();
    if (falta > 0) await esperar(falta);
    ultimaFinnhub = Date.now();
    try {
      const r = await fetch(`https://finnhub.io/api/v1/${ruta}&token=${CLAVE_FINNHUB}`, { signal: AbortSignal.timeout(30_000) });
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

// ───────────────────────── SEC EDGAR ─────────────────────────

async function sec(url) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': AGENTE_SEC }, signal: AbortSignal.timeout(60_000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= 2) throw e;
      await esperar(3000);
    }
  }
}

// Cada empresa llama a sus ingresos de una forma; nos quedamos con la cifra mayor de estas etiquetas.
const ETIQUETAS_INGRESOS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
];
const ETIQUETAS_BENEFICIO = ['NetIncomeLoss', 'ProfitLoss'];

/** Ingresos y beneficio neto anuales de todas las empresas, de un golpe (una consulta por año y etiqueta). */
async function cuentasDeLaSec(simbolos) {
  const lista = await sec('https://www.sec.gov/files/company_tickers.json');
  if (!lista) throw new Error('la SEC no devuelve la lista de empresas');
  const numeroSec = new Map(Object.values(lista).map((x) => [x.ticker, x.cik_str]));
  // Una empresa con dos clases de acción (GOOGL y GOOG) tiene un solo número: las dos comparten cuentas.
  const simbolosDe = new Map();
  for (const s of simbolos) {
    const cik = numeroSec.get(s.replace('.', '-'));
    if (cik) simbolosDe.set(cik, [...(simbolosDe.get(cik) ?? []), s]);
  }

  const esteAño = new Date().getUTCFullYear();
  const años = Array.from({ length: 6 }, (_, i) => esteAño - 6 + i);
  const cuentas = new Map(simbolos.map((s) => [s, { ingresos: new Map(), beneficios: new Map() }]));

  for (const año of años) {
    for (const [campo, etiquetas] of [
      ['ingresos', ETIQUETAS_INGRESOS],
      ['beneficios', ETIQUETAS_BENEFICIO],
    ]) {
      for (const etiqueta of etiquetas) {
        const marco = await sec(`https://data.sec.gov/api/xbrl/frames/us-gaap/${etiqueta}/USD/CY${año}.json`);
        await esperar(400);
        for (const d of marco?.data ?? []) {
          for (const s of simbolosDe.get(d.cik) ?? []) {
            const mapa = cuentas.get(s)[campo];
            // Ingresos: la cifra mayor. Beneficio: la primera etiqueta que tenga dato.
            if (campo === 'ingresos') mapa.set(año, Math.max(mapa.get(año) ?? -Infinity, d.val));
            else if (!mapa.has(año)) mapa.set(año, d.val);
          }
        }
      }
    }
    console.log(`   SEC: cuentas de ${año} leídas`);
  }
  const aLista = (m) => [...m].sort((a, b) => a[0] - b[0]).map(([a, v]) => ({ a, v }));
  return new Map([...cuentas].map(([s, c]) => [s, { ingresos: aLista(c.ingresos), beneficios: aLista(c.beneficios) }]));
}

// ───────────────────────── Twelve Data ─────────────────────────

/** Cierres semanales de 5 años. Devuelve null si no hay dato y 'limite' si se han agotado las consultas. */
async function historico(simbolo) {
  try {
    const r = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(simbolo)}&interval=1week&outputsize=262&apikey=${CLAVE_TWELVE}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    const j = await r.json();
    if (j.code === 429) return 'limite';
    if (j.status !== 'ok' || !Array.isArray(j.values)) return null;
    return j.values
      .map((v) => [v.datetime.slice(0, 10), redondo(Number(v.close))])
      .filter(([, c]) => c !== null)
      .reverse();
  } catch {
    return null;
  }
}

// ───────────────────────── Principal ─────────────────────────

async function principal() {
  console.log('Empresas: preparando la lista…');
  const carteras = await leerJson(path.join(SALIDA, 'carteras.json'));
  const cartera = carteras?.fondos?.[FONDO_SP500];
  if (!cartera) {
    console.error('   No hay cartera del S&P 500. Ejecuta antes «npm run fondos».');
    process.exit(1);
  }
  if (!CLAVE_FINNHUB) {
    console.error('   Falta la clave FINNHUB_API_KEY: no se pueden pedir precios (ver LEEME.md).');
    process.exit(1);
  }

  const anterior = await leerJson(path.join(SALIDA, 'empresas.json'));
  const previa = new Map((anterior?.empresas ?? []).map((e) => [e.t, e]));

  const lista = [];
  for (const [id, peso] of cartera) {
    const [nombre, pais, sector, simboloCartera] = carteras.empresas[id];
    // Dos empresas con «clase B» vienen sin símbolo en el archivo de iShares.
    let t = simboloCartera;
    if (!t && /^Berkshire Hathaway/i.test(nombre)) t = 'BRK.B';
    if (!t && /^Brown-Forman.*Class B/i.test(nombre)) t = 'BF.B';
    if (!t || !/^[A-Z.]{1,6}$/.test(t)) continue;
    lista.push({ ...(previa.get(t) ?? {}), t, n: nombre, pais, s: sector, pesoSP: peso });
  }
  console.log(`   ${lista.length} empresas en la lista`);

  // 1) Precio de hoy (siempre) e indicadores (si tienen más de 6 días).
  let conPrecio = 0;
  let renovadas = 0;
  for (const [i, e] of SOLO_HISTORICOS || SOLO_CUENTAS ? [] : lista.entries()) {
    const q = await finnhub(`quote?symbol=${e.t}`);
    if (q?.c && q.pc) {
      e.precio = redondo(q.c);
      e.cambio = redondo(q.dp ?? ((q.c - q.pc) / q.pc) * 100);
      e.fecha = q.t ? new Date(q.t * 1000).toISOString().slice(0, 10) : null;
      conPrecio++;
    }
    if (viejo(e.m)) {
      const [perfil, met] = [await finnhub(`stock/profile2?symbol=${e.t}`), await finnhub(`stock/metric?symbol=${e.t}&metric=all`)];
      const x = met?.metric;
      if (perfil?.name || x) {
        if (perfil?.name) {
          e.ind = perfil.finnhubIndustry || null;
          e.web = perfil.weburl || null;
          e.salida = perfil.ipo || null;
          e.acciones = redondo(perfil.shareOutstanding, 3); // en millones
        }
        if (x) {
          e.bpa = redondo(x.epsTTM); // beneficio por acción de los últimos 12 meses
          e.perFuturo = redondo(x.forwardPE, 1);
          e.divAnual = redondo(x.dividendIndicatedAnnual ?? x.dividendPerShareTTM); // dólares por acción al año
          e.margen = redondo(x.netProfitMarginTTM, 1);
          e.roe = redondo(x.roeTTM, 1);
          e.crecIngresos = redondo(x.revenueGrowthTTMYoy, 1);
          e.crecIngresos5 = redondo(x.revenueGrowth5Y, 1);
          e.deuda = redondo(x['totalDebt/totalEquityQuarterly']);
          e.beta = redondo(x.beta);
          e.max52 = redondo(x['52WeekHigh']);
          e.min52 = redondo(x['52WeekLow']);
          e.rent52 = redondo(x['52WeekPriceReturnDaily'], 1);
          e.rentAño = redondo(x.yearToDatePriceReturnDaily, 1);
          if (!e.acciones && x.marketCapitalization && e.precio) e.acciones = redondo(x.marketCapitalization / e.precio, 3);
        }
        e.m = new Date().toISOString();
        renovadas++;
      }
    }
    if ((i + 1) % 50 === 0) console.log(`   Finnhub: ${i + 1} de ${lista.length}`);
  }
  console.log(`   ${conPrecio} con precio; indicadores renovados en ${renovadas}`);

  // 2) Ingresos y beneficios (SEC), una vez por semana.
  let cuentasFecha = anterior?.cuentasActualizado ?? null;
  if (SOLO_CUENTAS || (!SOLO_HISTORICOS && viejo(cuentasFecha))) {
    try {
      const cuentas = await cuentasDeLaSec(lista.map((e) => e.t));
      let n = 0;
      for (const e of lista) {
        const c = cuentas.get(e.t);
        if (c?.ingresos.length || c?.beneficios.length) {
          e.ingresos = c.ingresos;
          e.beneficios = c.beneficios;
          n++;
        }
      }
      cuentasFecha = new Date().toISOString();
      console.log(`   SEC: cuentas de ${n} empresas`);
    } catch (err) {
      console.error(`   SEC: no disponible (${err.message}); se conservan las cuentas anteriores.`);
    }
  }

  // 3) Historial de precios (Twelve Data): primero las que no tienen, luego las más antiguas.
  if (SOLO_CUENTAS) {
    // gráficos: no se tocan
  } else if (!CLAVE_TWELVE) {
    console.log('   Sin clave TWELVEDATA_API_KEY: los gráficos de precio quedan sin datos (ver LEEME.md).');
  } else {
    await mkdir(HISTORICOS, { recursive: true });
    // Si una descarga anterior se cortó a medias, se aprovechan los gráficos que ya están en el disco.
    for (const e of lista) {
      try {
        const guardado = JSON.parse(await readFile(path.join(HISTORICOS, `${e.t}.json`), 'utf8'));
        if (guardado.actualizado && guardado.actualizado > (e.h ?? '')) e.h = guardado.actualizado;
      } catch {
        // todavía no hay archivo para esta empresa
      }
    }
    const pendientes = lista
      .filter((e) => viejo(e.h))
      .sort((a, b) => (a.h ?? '').localeCompare(b.h ?? '') || b.pesoSP - a.pesoSP)
      .slice(0, MAX_HISTORICOS);
    let hechos = 0;
    for (const e of pendientes) {
      const puntos = await historico(e.t);
      if (puntos === 'limite') {
        console.log('   Twelve Data: límite de consultas alcanzado; se sigue en la próxima ejecución.');
        break;
      }
      if (puntos && puntos.length > 10) {
        const ahora = new Date().toISOString();
        await writeFile(path.join(HISTORICOS, `${e.t}.json`), JSON.stringify({ t: e.t, actualizado: ahora, puntos }), 'utf8');
        e.h = ahora;
        hechos++;
      }
      await esperar(8000); // 8 consultas por minuto como máximo
    }
    console.log(`   Twelve Data: ${hechos} historiales renovados (${lista.filter((e) => e.h).length} en total)`);
  }

  // Si esta vez no ha salido ni un precio, algo va mal: mejor conservar el archivo anterior.
  if (conPrecio === 0 && anterior && !SOLO_HISTORICOS && !SOLO_CUENTAS) {
    console.error('   Ningún precio descargado: se conserva el archivo anterior.');
    process.exit(1);
  }

  lista.sort((a, b) => (b.acciones ?? 0) * (b.precio ?? 0) - (a.acciones ?? 0) * (a.precio ?? 0));
  const texto = JSON.stringify({
    actualizado: new Date().toISOString(),
    cuentasActualizado: cuentasFecha,
    empresas: lista,
  });
  await writeFile(path.join(SALIDA, 'empresas.json'), texto, 'utf8');
  console.log(`   guardado empresas.json (${(texto.length / 1024).toFixed(0)} KB)`);
}

principal().catch((e) => {
  console.error(`   ERROR en empresas: ${e.message}`);
  process.exit(1);
});
