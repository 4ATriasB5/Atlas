// Datos de fondos y ETFs (fase 2): tipos, carga y buscador de empresas.

export interface Trozo {
  /** nombre */
  n: string;
  /** peso en % */
  p: number;
}

export interface Fondo {
  isin: string;
  nombre: string;
  gestora: string;
  tipo: 'ETF' | 'Fondo';
  comision: number | null;
  domicilio: string;
  region: string;
  tema: string;
  tradeRepublic: boolean;
  myInvestor: 'si' | 'por confirmar' | 'no';
  web: string | null;
  fechaCartera: string | null;
  nPosiciones: number | null;
  top: Trozo[];
  sectores: Trozo[];
  paises: Trozo[];
}

export interface DatosFondos {
  actualizado: string | null;
  etfsTradeRepublic: number | null;
  fondos: Fondo[];
}

export interface Empresa {
  id: number;
  nombre: string;
  pais: string;
  sector: string;
  simbolo: string;
  /** nombre en minúsculas y sin acentos, para buscar */
  busca: string;
}

export interface Carteras {
  empresas: Empresa[];
  /** ISIN del fondo -> lista de [empresa, peso en %], de mayor a menor */
  deFondo: Record<string, [number, number][]>;
  /** empresa -> lista de [ISIN del fondo, peso en %] */
  deEmpresa: Map<number, [string, number][]>;
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

export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Los archivos se descargan una sola vez, la primera vez que se abre la sección.
let promesaFondos: Promise<DatosFondos | null> | null = null;
let promesaCarteras: Promise<Carteras | null> | null = null;

export function cargarFondos(): Promise<DatosFondos | null> {
  promesaFondos ??= leer<DatosFondos>('fondos.json');
  return promesaFondos;
}

export function cargarCarteras(): Promise<Carteras | null> {
  promesaCarteras ??= leer<{ empresas: [string, string, string, string][]; fondos: Record<string, [number, number][]> }>(
    'carteras.json',
  ).then((c) => {
    if (!c) return null;
    const empresas = c.empresas.map(([nombre, pais, sector, simbolo], id) => ({
      id,
      nombre,
      pais,
      sector,
      simbolo,
      busca: sinAcentos(nombre),
    }));
    const deEmpresa = new Map<number, [string, number][]>();
    for (const [isin, lista] of Object.entries(c.fondos)) {
      for (const [id, peso] of lista) {
        let l = deEmpresa.get(id);
        if (!l) deEmpresa.set(id, (l = []));
        l.push([isin, peso]);
      }
    }
    return { empresas, deFondo: c.fondos, deEmpresa };
  });
  return promesaCarteras;
}

// Nombres por los que la gente conoce a algunas empresas y que no coinciden con su nombre oficial.
const APODOS: Record<string, string> = {
  inditex: 'industria de diseno textil',
  zara: 'industria de diseno textil',
  google: 'alphabet',
  facebook: 'meta platforms',
  tsmc: 'taiwan semiconductor',
  mercedes: 'mercedes-benz',
  louis: 'lvmh',
  bbva: 'banco bilbao vizcaya',
};

/** Empresas cuyo nombre o símbolo coincide con lo escrito, primero las que están en más fondos. */
export function buscarEmpresas(c: Carteras, texto: string, maximo = 8): Empresa[] {
  let q = sinAcentos(texto.trim());
  if (q.length < 2) return [];
  q = APODOS[q] ?? q;
  const simbolo = texto.trim().toUpperCase();
  const nFondos = (e: Empresa) => c.deEmpresa.get(e.id)?.length ?? 0;
  return c.empresas
    .filter((e) => nFondos(e) > 0 && (e.busca.includes(q) || e.simbolo === simbolo))
    .sort((a, b) => {
      const empiezaA = a.busca.startsWith(q) || a.simbolo === simbolo ? 1 : 0;
      const empiezaB = b.busca.startsWith(q) || b.simbolo === simbolo ? 1 : 0;
      return empiezaB - empiezaA || nFondos(b) - nFondos(a);
    })
    .slice(0, maximo);
}

export function comisionTexto(c: number | null): string {
  return c === null ? '—' : `${c.toFixed(2).replace('.', ',')} %`;
}

/** Lo que cuesta al año tener 1.000 € en el fondo. */
export function costeAnual(c: number): string {
  return `${(c * 10).toFixed(2).replace('.', ',').replace(',00', '')} €`;
}
