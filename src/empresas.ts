// Datos de empresas (fase 3): tipos, carga, cálculos sencillos y «Mi lista».

import { useEffect, useState } from 'react';

export interface Cuenta {
  /** año */
  a: number;
  /** importe en dólares */
  v: number;
}

export interface EmpresaBolsa {
  /** símbolo en bolsa (AAPL) */
  t: string;
  /** nombre, igual que en las carteras de los fondos */
  n: string;
  pais: string;
  /** sector, en español */
  s: string;
  /** peso en el S&P 500, en % */
  pesoSP: number;
  precio?: number | null;
  /** variación del último día, en % */
  cambio?: number | null;
  fecha?: string | null;
  ind?: string | null;
  web?: string | null;
  salida?: string | null;
  /** acciones en circulación, en millones */
  acciones?: number | null;
  /** beneficio por acción de los últimos 12 meses */
  bpa?: number | null;
  perFuturo?: number | null;
  /** dividendo anual por acción, en dólares */
  divAnual?: number | null;
  margen?: number | null;
  roe?: number | null;
  crecIngresos?: number | null;
  crecIngresos5?: number | null;
  deuda?: number | null;
  beta?: number | null;
  max52?: number | null;
  min52?: number | null;
  rent52?: number | null;
  rentAño?: number | null;
  ingresos?: Cuenta[];
  beneficios?: Cuenta[];
  /** fecha del historial de precios, si lo hay */
  h?: string | null;
}

export interface DatosEmpresas {
  actualizado: string | null;
  cuentasActualizado: string | null;
  empresas: EmpresaBolsa[];
  porSimbolo: Map<string, EmpresaBolsa>;
  porNombre: Map<string, EmpresaBolsa>;
}

export interface Historico {
  t: string;
  actualizado: string;
  /** [fecha, precio de cierre], del más antiguo al más reciente */
  puntos: [string, number][];
}

export async function leer<T>(archivo: string): Promise<T | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}datos/${archivo}`, { cache: 'no-cache' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

let promesa: Promise<DatosEmpresas | null> | null = null;

export function cargarEmpresas(): Promise<DatosEmpresas | null> {
  promesa ??= leer<{ actualizado: string | null; cuentasActualizado: string | null; empresas: EmpresaBolsa[] }>('empresas.json').then(
    (d) =>
      d && {
        ...d,
        porSimbolo: new Map(d.empresas.map((e) => [e.t, e])),
        porNombre: new Map(d.empresas.map((e) => [e.n, e])),
      },
  );
  return promesa;
}

export function cargarHistorico(simbolo: string): Promise<Historico | null> {
  return leer<Historico>(`historicos/${simbolo}.json`);
}

// ───────────── Cálculos ─────────────

/** Valor en bolsa de toda la empresa, en dólares. */
export function tamaño(e: EmpresaBolsa): number | null {
  return e.acciones && e.precio ? e.acciones * 1e6 * e.precio : null;
}

/** PER: cuántos años de beneficios se pagan al comprar la acción. Solo tiene sentido si gana dinero. */
export function per(e: EmpresaBolsa): number | null {
  return e.bpa && e.bpa > 0 && e.precio ? e.precio / e.bpa : null;
}

/** Dividendo anual como % del precio. 0 si no reparte. */
export function dividendo(e: EmpresaBolsa): number | null {
  if (!e.precio) return null;
  if (e.divAnual === null || e.divAnual === undefined) return null;
  return (e.divAnual / e.precio) * 100;
}

export function palabraTamaño(dolares: number): string {
  if (dolares >= 1e12) return 'Gigante';
  if (dolares >= 2e11) return 'Muy grande';
  if (dolares >= 5e10) return 'Grande';
  return 'Mediana';
}

/** Dirección de la ficha de una empresa: por símbolo si Atlas tiene su precio; si no, por nombre. */
export function enlaceEmpresa(nombre: string, datos: DatosEmpresas | null): string {
  const e = datos?.porNombre.get(nombre);
  return e ? `#/empresa/${e.t}` : `#/empresa/~${encodeURIComponent(nombre)}`;
}

// ───────────── Mi lista (se guarda en este dispositivo; con cuenta, también en la nube) ─────────────

const CLAVE_LISTA = 'atlas-lista';
const oyentes = new Set<() => void>();

export function leerLista(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_LISTA) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function escribirLista(nueva: string[]) {
  try {
    localStorage.setItem(CLAVE_LISTA, JSON.stringify(nueva));
  } catch {
    /* si el navegador no deja guardar, la lista no se recuerda */
  }
  oyentes.forEach((f) => f());
}

/** Si hay una cuenta abierta, nube.ts se apunta aquí para copiar cada cambio a la nube. */
export const ganchosLista: { alAlternar: ((simbolo: string, dentro: boolean) => void) | null } = { alAlternar: null };

export function alternarEnLista(simbolo: string) {
  const lista = leerLista();
  const dentro = !lista.includes(simbolo);
  escribirLista(dentro ? [...lista, simbolo] : lista.filter((x) => x !== simbolo));
  ganchosLista.alAlternar?.(simbolo, dentro);
}

/** La lista del usuario; el componente se repinta cuando cambia. */
export function useLista(): string[] {
  const [lista, setLista] = useState(leerLista);
  useEffect(() => {
    const f = () => setLista(leerLista());
    oyentes.add(f);
    window.addEventListener('storage', f);
    return () => {
      oyentes.delete(f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return lista;
}
