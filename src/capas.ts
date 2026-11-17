// Las "capas" son las métricas con las que se puede colorear el mapa.
// Cada capa dice de dónde saca el valor de un país y qué color le toca según el tramo.

import { type Datos, pct, pctSigno } from './datos';

export type ClaveCapa = 'bolsa' | 'crecimiento' | 'inflacion' | 'exportaciones';

export interface Tramo {
  /** El tramo se aplica a valores mayores o iguales que este. */
  desde: number;
  color: string;
  /** true si el color es claro y el texto encima debe ser oscuro. */
  claro: boolean;
  texto: string;
}

export interface Capa {
  clave: ClaveCapa;
  boton: string;
  titulo: (experto: boolean) => string;
  leyenda: string;
  tramos: Tramo[];
  valor: (d: Datos, iso3: string) => number | null;
  año: (d: Datos, iso3: string) => number | null;
  formato: (v: number, experto: boolean) => string;
}

export const AZUL = '#4C9AFF';
export const AZUL_OSCURO = '#24456E';
export const NEUTRO = '#2A313B';
export const NARANJA_OSCURO = '#6B4318';
export const NARANJA = '#F59E42';
export const SIN_DATOS = '#1A212B';

const divergente = (limites: [number, number, number, number], textos: string[]): Tramo[] => [
  { desde: limites[0], color: AZUL, claro: true, texto: textos[0] },
  { desde: limites[1], color: AZUL_OSCURO, claro: false, texto: textos[1] },
  { desde: limites[2], color: NEUTRO, claro: false, texto: textos[2] },
  { desde: limites[3], color: NARANJA_OSCURO, claro: false, texto: textos[3] },
  { desde: -Infinity, color: NARANJA, claro: true, texto: textos[4] },
];

export const CAPAS: Capa[] = [
  {
    clave: 'bolsa',
    boton: 'Bolsa hoy',
    titulo: (x) => (x ? 'Variación diaria del ETF del país (USD)' : 'Bolsa del país hoy'),
    leyenda: 'Bolsa del país hoy:',
    tramos: divergente([1, 0.3, -0.3, -1], ['sube fuerte', 'sube', 'plano', 'cae', 'cae fuerte']),
    valor: (d, iso3) => d.bolsas[iso3]?.cambioPct ?? null,
    año: () => null,
    formato: (v, x) => pctSigno(v, x ? 2 : 1),
  },
  {
    clave: 'crecimiento',
    boton: 'Crecimiento PIB',
    titulo: (x) => (x ? 'Crecimiento real del PIB (% anual)' : 'Cuánto crece su economía en un año'),
    leyenda: 'Crecimiento de la economía:',
    tramos: divergente([5, 2, 0, -2], ['más del 5 %', '2 a 5 %', '0 a 2 %', 'cae hasta 2 %', 'cae más del 2 %']),
    valor: (d, iso3) => d.paises[iso3]?.d.crecimiento?.v ?? null,
    año: (d, iso3) => d.paises[iso3]?.d.crecimiento?.a ?? null,
    formato: (v, x) => pctSigno(v, x ? 2 : 1),
  },
  {
    clave: 'inflacion',
    boton: 'Inflación',
    titulo: (x) => (x ? 'Inflación, IPC (% anual)' : 'Cuánto suben los precios en un año'),
    leyenda: 'Subida de precios:',
    tramos: [
      { desde: 20, color: NARANJA, claro: true, texto: 'más del 20 %' },
      { desde: 8, color: '#B8702A', claro: true, texto: '8 a 20 %' },
      { desde: 4, color: NARANJA_OSCURO, claro: false, texto: '4 a 8 %' },
      { desde: 2, color: NEUTRO, claro: false, texto: '2 a 4 %' },
      { desde: -Infinity, color: AZUL_OSCURO, claro: false, texto: 'menos del 2 %' },
    ],
    valor: (d, iso3) => d.paises[iso3]?.d.inflacion?.v ?? null,
    año: (d, iso3) => d.paises[iso3]?.d.inflacion?.a ?? null,
    formato: (v, x) => pct(v, x ? 2 : 1),
  },
  {
    clave: 'exportaciones',
    boton: 'Exportaciones',
    titulo: (x) =>
      x ? 'Exportaciones de bienes y servicios (% del PIB)' : 'Cuánto de lo que produce lo vende a otros países',
    leyenda: 'Lo que vende fuera, sobre su PIB:',
    tramos: [
      { desde: 80, color: '#9CC7FF', claro: true, texto: 'más del 80 %' },
      { desde: 50, color: AZUL, claro: true, texto: '50 a 80 %' },
      { desde: 30, color: '#3068B0', claro: false, texto: '30 a 50 %' },
      { desde: 15, color: AZUL_OSCURO, claro: false, texto: '15 a 30 %' },
      { desde: -Infinity, color: '#1B2D45', claro: false, texto: 'menos del 15 %' },
    ],
    valor: (d, iso3) => d.paises[iso3]?.d.exportPctPib?.v ?? null,
    año: (d, iso3) => d.paises[iso3]?.d.exportPctPib?.a ?? null,
    formato: (v, x) => pct(v, x ? 1 : 0),
  },
];

export function tramoDe(capa: Capa, v: number | null): Tramo | null {
  if (v === null || Number.isNaN(v)) return null;
  return capa.tramos.find((t) => v >= t.desde) ?? null;
}

export function colorDe(capa: Capa, v: number | null): string {
  return tramoDe(capa, v)?.color ?? SIN_DATOS;
}
