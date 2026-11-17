// Tipos de los datos que genera el recolector y funciones para cargarlos y darles formato.

export type ClaveDato =
  | 'pib'
  | 'pibPerCapita'
  | 'crecimiento'
  | 'inflacion'
  | 'paro'
  | 'exportaciones'
  | 'exportPctPib'
  | 'poblacion';

/** Un dato con su año: { v: valor, a: año }. */
export interface Dato {
  v: number;
  a: number;
}

export interface Pais {
  iso3: string;
  iso2: string | null;
  num: string | null;
  nombre: string;
  region: string | null;
  ingreso: string | null;
  capital: string | null;
  rangoPib: number | null;
  d: Partial<Record<ClaveDato, Dato>>;
  serie: Dato[];
}

export interface Bolsa {
  simbolo: string;
  nombre: string;
  cierre: number;
  cambioPct: number;
  fecha: string | null;
}

export interface Comercio {
  a: number;
  total: number;
  productos: { id: string; v: number }[];
  socios: { iso3: string; v: number }[];
}

export interface Datos {
  actualizado: string | null;
  indicadores: Record<string, string>;
  paises: Record<string, Pais>;
  /** Mismo contenido que `paises`, pero buscando por el número ISO que usa el mapa. */
  porNum: Record<string, Pais>;
  bolsas: Record<string, Bolsa>;
  bolsasExtra: Record<string, Bolsa>;
  bolsasActualizado: string | null;
  comercio: Record<string, Comercio>;
}

async function leer<T>(archivo: string): Promise<T | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}datos/${archivo}`, { cache: 'no-cache' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function cargarDatos(): Promise<Datos> {
  const [p, b, c] = await Promise.all([
    leer<{ actualizado: string; indicadores: Record<string, string>; paises: Record<string, Pais> }>('paises.json'),
    leer<{ actualizado: string | null; paises: Record<string, Bolsa>; extra: Record<string, Bolsa> }>('bolsas.json'),
    leer<{ comercio: Record<string, Comercio> }>('comercio.json'),
  ]);
  if (!p) throw new Error('No se encuentran los datos. Ejecuta primero «npm run datos».');
  const porNum: Record<string, Pais> = {};
  for (const pais of Object.values(p.paises)) if (pais.num) porNum[pais.num] = pais;
  return {
    actualizado: p.actualizado,
    indicadores: p.indicadores ?? {},
    paises: p.paises,
    porNum,
    bolsas: b?.paises ?? {},
    bolsasExtra: b?.extra ?? {},
    bolsasActualizado: b?.actualizado ?? null,
    comercio: c?.comercio ?? {},
  };
}

/** Países de los que hay algún dato, ordenados alfabéticamente. Son los que salen en los buscadores. */
export function paisesConDatos(d: Datos): Pais[] {
  return Object.values(d.paises)
    .filter((p) => p.d.pib || d.bolsas[p.iso3] || d.comercio[p.iso3])
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ───────────── Formato de números en español ─────────────

const nf = (dec: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function numero(v: number, dec = 0): string {
  return nf(dec).format(v);
}

/** Porcentaje con signo: +0,7 % / −1,2 % */
export function pctSigno(v: number, dec = 1): string {
  const redondeado = Number(v.toFixed(dec));
  const signo = redondeado > 0 ? '+' : redondeado < 0 ? '−' : '';
  return `${signo}${nf(dec).format(Math.abs(redondeado))} %`;
}

export function pct(v: number, dec = 1): string {
  return `${nf(dec).format(v).replace('-', '−')} %`;
}

/** Dinero en dólares, con las palabras que usamos en español (1 billón = un millón de millones). */
export function dinero(v: number, experto = false): string {
  const abs = Math.abs(v);
  const sufijo = experto ? ' USD' : ' $';
  if (abs >= 1e12) return `${nf(2).format(v / 1e12)} billones${sufijo}`;
  if (abs >= 1e9) return `${nf(abs >= 1e11 ? 0 : 1).format(v / 1e9)} mil M${sufijo}`;
  if (abs >= 1e6) return `${nf(0).format(v / 1e6)} M${sufijo}`;
  return `${nf(0).format(v)}${sufijo}`;
}

export function personas(v: number): string {
  if (v >= 1e6) return `${nf(v >= 1e7 ? 0 : 1).format(v / 1e6)} millones`;
  if (v >= 1e3) return `${nf(0).format(v / 1e3)} mil`;
  return nf(0).format(v);
}

export function fechaCorta(isoFecha: string | null): string {
  if (!isoFecha) return '—';
  return new Date(isoFecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ───────────── Grupos de productos (capítulos del comercio internacional) ─────────────

export const PRODUCTOS: Record<string, { nombre: string; ejemplos: string }> = {
  '01-05_Animal': { nombre: 'Productos animales', ejemplos: 'carne, pescado, lácteos' },
  '06-15_Vegetable': { nombre: 'Productos vegetales', ejemplos: 'fruta, cereales, café, aceites' },
  '16-24_FoodProd': { nombre: 'Alimentos elaborados y bebidas', ejemplos: 'conservas, vino, tabaco' },
  '25-26_Minerals': { nombre: 'Minerales', ejemplos: 'mineral de hierro, cobre, cemento' },
  '27-27_Fuels': { nombre: 'Combustibles', ejemplos: 'petróleo, gas, carbón' },
  '28-38_Chemicals': { nombre: 'Química y farmacia', ejemplos: 'medicamentos, fertilizantes' },
  '39-40_PlastiRub': { nombre: 'Plásticos y caucho', ejemplos: 'envases, neumáticos' },
  '41-43_HidesSkin': { nombre: 'Cuero y pieles', ejemplos: 'bolsos, marroquinería' },
  '44-49_Wood': { nombre: 'Madera y papel', ejemplos: 'celulosa, cartón, muebles sin montar' },
  '50-63_TextCloth': { nombre: 'Textil y ropa', ejemplos: 'tejidos, prendas de vestir' },
  '64-67_Footwear': { nombre: 'Calzado', ejemplos: 'zapatos, sombreros' },
  '68-71_StoneGlas': { nombre: 'Piedra, vidrio y metales preciosos', ejemplos: 'oro, diamantes, cerámica' },
  '72-83_Metals': { nombre: 'Metales', ejemplos: 'acero, aluminio, cobre refinado' },
  '84-85_MachElec': { nombre: 'Maquinaria y electrónica', ejemplos: 'chips, móviles, máquinas' },
  '86-89_Transport': { nombre: 'Vehículos y transporte', ejemplos: 'coches, aviones, barcos' },
  '90-99_Miscellan': { nombre: 'Otros productos', ejemplos: 'instrumentos médicos, muebles, juguetes' },
};

export function nombreProducto(id: string): string {
  return PRODUCTOS[id]?.nombre ?? id;
}

/** Lista en español: «a, b y c». */
export function enumerar(elementos: string[]): string {
  if (elementos.length <= 1) return elementos.join('');
  return `${elementos.slice(0, -1).join(', ')} y ${elementos[elementos.length - 1]}`;
}
