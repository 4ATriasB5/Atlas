// Fase 4: noticias, sectores y «¿por qué se ha movido?». Aquí van los datos y los cálculos;
// las pantallas están en Noticias.tsx y PantallaSectores.tsx.

import { enumerar, numero, pct, pctSigno } from './datos';
import { type DatosEmpresas, type EmpresaBolsa, leer, per } from './empresas';

// ───────────── Datos ─────────────

export interface Noticia {
  /** titular, tal como lo publica el medio (en inglés) */
  t: string;
  /** medio */
  f: string;
  /** enlace a la noticia original */
  u: string;
  /** fecha, en segundos */
  d: number;
  tipo: string;
  rumor?: boolean;
  opinion?: boolean;
}

export interface Resultado {
  /** día en que presenta resultados */
  d: string;
  /** bmo = antes de abrir; amc = tras el cierre; vacío = no se sabe */
  h: string;
  /** beneficio por acción: esperado y real */
  bE: number | null;
  bR: number | null;
  /** ingresos: esperados y reales */
  iE: number | null;
  iR: number | null;
}

export interface DatosNoticias {
  actualizado: string;
  mercado: Noticia[];
  resultados: Record<string, Resultado[]>;
}

let promesa: Promise<DatosNoticias | null> | null = null;
export function cargarNoticias(): Promise<DatosNoticias | null> {
  promesa ??= leer<DatosNoticias>('noticias.json');
  return promesa;
}

const deEmpresa = new Map<string, Promise<Noticia[]>>();
export function cargarNoticiasEmpresa(simbolo: string): Promise<Noticia[]> {
  if (!deEmpresa.has(simbolo)) {
    deEmpresa.set(
      simbolo,
      leer<{ n: Noticia[] }>(`noticias/${simbolo}.json`).then((x) => x?.n ?? []),
    );
  }
  return deEmpresa.get(simbolo)!;
}

/** «hace 3 h», «ayer», «17 nov.» */
export function cuando(segundos: number): string {
  const ms = Date.now() - segundos * 1000;
  const horas = ms / 3_600_000;
  if (horas < 1) return 'hace menos de 1 h';
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  if (horas < 48) return 'ayer';
  return new Date(segundos * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export const diaLargo = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
export const diaMedio = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

// ───────────── Mercado y sectores ─────────────

/** Media de un dato, dando más peso a las empresas más grandes (como hace el propio índice). */
function mediaPonderada(lista: EmpresaBolsa[], dato: (e: EmpresaBolsa) => number | null | undefined): number | null {
  let suma = 0;
  let pesos = 0;
  for (const e of lista) {
    const v = dato(e);
    if (typeof v !== 'number' || !Number.isFinite(v) || !(e.pesoSP > 0)) continue;
    suma += v * e.pesoSP;
    pesos += e.pesoSP;
  }
  return pesos > 0 ? suma / pesos : null;
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Cuánto se movió hoy el S&P 500, calculado con sus empresas. */
export function cambioMercado(datos: DatosEmpresas): number | null {
  return mediaPonderada(datos.empresas, (e) => e.cambio);
}

export function cambioSector(datos: DatosEmpresas, sector: string, sin?: EmpresaBolsa): number | null {
  return mediaPonderada(
    datos.empresas.filter((e) => e.s === sector && e !== sin),
    (e) => e.cambio,
  );
}

export interface Sector {
  nombre: string;
  empresas: EmpresaBolsa[];
  /** qué parte del S&P 500 es este sector, en % */
  peso: number;
  hoy: number | null;
  año: number | null;
  perMediano: number | null;
  dividendoMedio: number | null;
}

export function resumenSectores(datos: DatosEmpresas): Sector[] {
  const grupos = new Map<string, EmpresaBolsa[]>();
  for (const e of datos.empresas) grupos.set(e.s, [...(grupos.get(e.s) ?? []), e]);
  const total = datos.empresas.reduce((s, e) => s + (e.pesoSP || 0), 0) || 1;
  return [...grupos.entries()]
    .map(([nombre, empresas]) => ({
      nombre,
      empresas: [...empresas].sort((a, b) => b.pesoSP - a.pesoSP),
      peso: (empresas.reduce((s, e) => s + (e.pesoSP || 0), 0) / total) * 100,
      hoy: mediaPonderada(empresas, (e) => e.cambio),
      año: mediaPonderada(empresas, (e) => e.rentAño),
      perMediano: mediana(empresas.map(per).filter((x): x is number => x !== null)),
      dividendoMedio: mediaPonderada(empresas, (e) => (e.precio && typeof e.divAnual === 'number' ? (e.divAnual / e.precio) * 100 : null)),
    }))
    .sort((a, b) => b.peso - a.peso);
}

/** Qué hace cada sector, en palabras sencillas. */
export const QUE_HACE: Record<string, string> = {
  Tecnología: 'Fabrican chips, ordenadores, móviles y programas informáticos.',
  Comunicación: 'Buscadores, redes sociales, plataformas de vídeo, operadoras de teléfono y medios.',
  'Consumo no esencial': 'Venden cosas que se pueden aplazar si hay crisis: coches, ropa, viajes, restaurantes, tiendas online.',
  Salud: 'Farmacéuticas, hospitales, seguros médicos y aparatos sanitarios.',
  'Consumo básico': 'Lo que se compra siempre: comida, bebida, productos de limpieza, supermercados.',
  Finanzas: 'Bancos, aseguradoras, gestoras de fondos y empresas de pagos con tarjeta.',
  Energía: 'Petróleo y gas: lo extraen, lo transportan o lo refinan.',
  Industria: 'Aviones, maquinaria, transporte de mercancías, construcción y defensa.',
  Materiales: 'Química, acero, minería, envases y materiales de construcción.',
  Inmobiliario: 'Dueños de edificios que cobran alquileres: oficinas, almacenes, torres de telefonía, viviendas.',
  'Suministros (luz, agua, gas)': 'Llevan la electricidad, el agua y el gas a casas y empresas.',
};

// ───────────── «¿Por qué se ha movido?» ─────────────

/** Día de bolsa anterior (se salta sábados y domingos; los festivos no se tienen en cuenta). */
function sesionAnterior(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** Noticias publicadas entre el cierre de la sesión anterior y el cierre de esta: las que pudieron moverla. */
export function noticiasDeLaSesion(noticias: Noticia[], fecha: string): Noticia[] {
  const desde = Date.parse(`${sesionAnterior(fecha)}T20:00:00Z`) / 1000;
  const hasta = Date.parse(`${fecha}T21:00:00Z`) / 1000;
  return noticias.filter((n) => n.d >= desde && n.d <= hasta);
}

const dolar = (v: number) => `${numero(v, 2)} $`;

/** ¿Ganó más o menos de lo que esperaban los analistas? Por debajo de un 2 % de diferencia cuenta como «igual». */
export function sorpresa(r: Resultado): 'mejor' | 'peor' | 'igual' | null {
  if (r.bR === null || r.bE === null) return null;
  const dif = r.bE !== 0 ? ((r.bR - r.bE) / Math.abs(r.bE)) * 100 : 0;
  return dif > 2 ? 'mejor' : dif < -2 ? 'peor' : 'igual';
}

/** Frase sobre unos resultados: si superaron o no lo que esperaban los analistas. */
export function fraseResultado(r: Resultado, experto: boolean): string | null {
  const s = sorpresa(r);
  if (!s || r.bR === null || r.bE === null) return null;
  const veredicto =
    s === 'mejor' ? 'superó lo que esperaban los analistas' : s === 'peor' ? 'no llegó a lo que esperaban los analistas' : 'ganó más o menos lo que esperaban los analistas';
  let detalle = `ganó ${dolar(r.bR)} por acción, frente a ${dolar(r.bE)} previstos`;
  if (experto && r.iR && r.iE) detalle += `; ingresos ${pctSigno(((r.iR - r.iE) / r.iE) * 100)} sobre lo previsto`;
  return `${veredicto} (${detalle})`;
}

export type Nivel = 'tranquilo' | 'mercado' | 'sector' | 'propio';

export interface Explicacion {
  nivel: Nivel;
  cambio: number;
  fecha: string;
  mercado: number | null;
  sector: number | null;
  /** frases en orden, listas para leer */
  frases: string[];
  /** una sola frase, para listas cortas */
  breve: string;
  noticias: Noticia[];
  /** resultados presentados justo antes de esta sesión */
  resultado: Resultado | null;
  /** próximos resultados, si se conocen */
  proximo: Resultado | null;
}

export function explicarMovimiento(
  e: EmpresaBolsa,
  datos: DatosEmpresas,
  noticias: Noticia[],
  resultados: Resultado[],
  experto: boolean,
): Explicacion | null {
  if (typeof e.cambio !== 'number' || !e.fecha) return null;
  const c = e.cambio;
  const fecha = e.fecha;
  const m = cambioMercado(datos);
  const s = cambioSector(datos, e.s, e);
  const verbo = (v: number) => (v >= 0 ? 'subió' : 'bajó');
  const anterior = sesionAnterior(fecha);

  let nivel: Nivel;
  if (Math.abs(c) < 1.5 && (m === null || Math.abs(c - m) < 1.5)) nivel = 'tranquilo';
  else if (s !== null && Math.abs(s) >= 1 && Math.abs(c - s) < 1) nivel = 'sector';
  else if (m !== null && Math.abs(c - m) < 1) nivel = 'mercado';
  else nivel = 'propio';

  const frases: string[] = [`El ${diaLargo(fecha)} su acción ${verbo(c)} un ${pct(Math.abs(c), 1)}.`];
  if (m !== null) {
    frases.push(
      `Ese día la bolsa de EE. UU. en general (el S&P 500) ${verbo(m)} un ${pct(Math.abs(m), 1)}` +
        (s !== null ? ` y las demás empresas de su sector («${e.s}») ${s >= 0 ? 'subieron' : 'bajaron'} de media un ${pct(Math.abs(s), 1)}.` : '.'),
    );
  }
  const diagnostico: Record<Nivel, string> = {
    tranquilo: 'Fue un día tranquilo para esta empresa: un movimiento así es normal y no necesita una explicación especial.',
    sector: 'Se movió casi igual que su sector, así que la causa parece algo que afectó a todo el sector, no solo a esta empresa.',
    mercado: `Se movió casi igual que la bolsa en general: fue un día de ${m !== null && m >= 0 ? 'subidas' : 'bajadas'} para casi todos.`,
    propio: 'Se movió bastante más que su sector y que la bolsa en general, así que probablemente fue por algo propio de la empresa.',
  };
  frases.push(diagnostico[nivel]);

  // Resultados que pudieron moverla: los de ese día antes de abrir, o los del día anterior tras el cierre.
  const resultado =
    resultados.find((r) => (r.d === fecha && r.h !== 'amc') || (r.d === anterior && r.h === 'amc')) ?? null;
  if (resultado) {
    const cuandoFue = resultado.d === fecha ? (resultado.h === 'bmo' ? 'esa misma mañana, antes de abrir la bolsa' : 'ese mismo día') : 'la tarde anterior, tras el cierre';
    const veredicto = fraseResultado(resultado, experto);
    frases.push(`Presentó sus resultados ${cuandoFue}${veredicto ? ` y ${veredicto}` : ''}. Los resultados suelen ser la causa de los movimientos más grandes.`);
    const s2 = sorpresa(resultado);
    if ((s2 === 'mejor' && c < -1) || (s2 === 'peor' && c > 1)) {
      frases.push(
        s2 === 'mejor'
          ? 'Aun así la acción bajó: pasa a menudo cuando los inversores esperaban todavía más, o cuando no les gusta lo que la empresa prevé para los próximos meses.'
          : 'Aun así la acción subió: pasa cuando los inversores temían algo peor, o cuando les gusta lo que la empresa prevé para los próximos meses.',
      );
    }
  }
  const hoyTrasCierre = resultados.find((r) => r.d === fecha && r.h === 'amc');
  if (hoyTrasCierre) frases.push('Ese día presentó resultados después del cierre: su efecto se verá en la siguiente sesión.');

  const deLaSesion = noticiasDeLaSesion(noticias, fecha)
    .map((n) => ({ n, orden: (n.opinion ? 2 : 0) + (n.tipo === 'Otras' ? 1 : 0) }))
    .sort((a, b) => a.orden - b.orden || b.n.d - a.n.d)
    .slice(0, 3)
    .map((x) => x.n);

  if (nivel !== 'tranquilo' && !resultado && !deLaSesion.length) {
    frases.push(
      'No hemos encontrado resultados ni noticias suyas ese día. A veces una acción se mueve sin un motivo claro, por ejemplo cuando grandes fondos compran o venden mucho a la vez.',
    );
  }
  if (nivel !== 'tranquilo' && deLaSesion.length) {
    const tipos = [...new Set(deLaSesion.map((n) => n.tipo).filter((t) => t !== 'Otras' && t !== 'La acción en bolsa'))].map((t) => t.toLowerCase());
    frases.push(
      `Ese día se publicaron noticias sobre la empresa${tipos.length ? ` (${enumerar(tipos)})` : ''}; las tienes justo debajo.`,
    );
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const proximo = [...resultados].filter((r) => r.d > fecha && r.d >= hoy).sort((a, b) => a.d.localeCompare(b.d))[0] ?? null;

  const breve =
    nivel === 'tranquilo'
      ? 'Día tranquilo.'
      : resultado
        ? `Presentó resultados${{ mejor: ' mejores de lo esperado', peor: ' peores de lo esperado', igual: ' en línea con lo esperado', no: '' }[sorpresa(resultado) ?? 'no']}.`
        : nivel === 'sector'
          ? `Se movió con su sector (${s !== null ? pctSigno(s) : '—'}).`
          : nivel === 'mercado'
            ? 'Se movió con toda la bolsa.'
            : deLaSesion.length
              ? 'Algo propio de la empresa: hubo noticias suyas.'
              : 'Algo propio de la empresa; sin noticia clara.';

  return { nivel, cambio: c, fecha, mercado: m, sector: s, frases, breve, noticias: deLaSesion, resultado, proximo };
}
