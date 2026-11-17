// EL MAPA: fronteras reales de Natural Earth (paquete world-atlas) dibujadas con D3.
// Tiene zoom (rueda del ratón, pellizco o botones), desplazamiento (arrastrar),
// etiqueta al pasar el ratón y selección al hacer clic.

import { type MouseEvent, memo, useEffect, useRef } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { feature } from 'topojson-client';
import mundo from 'world-atlas/countries-50m.json';

const ANCHO = 1000;
const ALTO = 500;

export interface Forma {
  /** Identificador único de la forma dentro del mapa. */
  clave: string;
  /** Número ISO del país (el que usa world-atlas), o null si el territorio no tiene. */
  num: string | null;
  nombreIngles: string;
  d: string;
}

// Las formas se calculan una sola vez al abrir la app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = mundo as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paisesGeo: any[] = (feature(topo, topo.objects.countries) as any).features.filter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (f: any) => f.id !== '010', // sin la Antártida, que no es un país y ocupa mucho sitio
);
const proyeccion = geoNaturalEarth1().fitExtent(
  [
    [6, 6],
    [ANCHO - 6, ALTO - 6],
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { type: 'FeatureCollection', features: paisesGeo } as any,
);
const trazar = geoPath(proyeccion);

export const FORMAS: Forma[] = paisesGeo
  .map((f, i) => ({
    clave: `f${i}`,
    num: f.id ? String(f.id).padStart(3, '0') : null,
    nombreIngles: String(f.properties?.name ?? ''),
    d: trazar(f) ?? '',
  }))
  .filter((f) => f.d);

const POR_CLAVE = new Map(FORMAS.map((f) => [f.clave, f]));

/** Busca la forma de un país por su número ISO. Si hay varias, devuelve la mayor (el territorio principal). */
export function formaDeNum(num: string | null): Forma | null {
  if (!num) return null;
  let mejor: Forma | null = null;
  for (const f of FORMAS) if (f.num === num && (!mejor || f.d.length > mejor.d.length)) mejor = f;
  return mejor;
}

interface PropsFormas {
  rellenos: Record<string, string>;
}

// Los ~240 países solo se vuelven a dibujar cuando cambian los colores, no al mover el ratón.
const Formas = memo(function Formas({ rellenos }: PropsFormas) {
  return (
    <>
      {FORMAS.map((f) => (
        <path key={f.clave} className="pais" data-k={f.clave} d={f.d} fill={rellenos[f.clave]} />
      ))}
    </>
  );
});

interface Props {
  rellenos: Record<string, string>;
  /** Clave de la forma seleccionada (se resalta con borde blanco). */
  seleccion: string | null;
  /** Texto de la etiqueta que sigue al ratón: nombre y dato. */
  etiqueta: (forma: Forma) => { nombre: string; dato: string };
  alElegir: (forma: Forma) => void;
}

export function Mapa({ rellenos, seleccion, etiqueta, alElegir }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const grupoRef = useRef<SVGGElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const etiquetaRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const grupo = grupoRef.current;
    if (!svg || !grupo) return;
    const comportamiento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .translateExtent([
        [0, 0],
        [ANCHO, ALTO],
      ])
      .on('zoom', (ev) => {
        grupo.setAttribute('transform', ev.transform.toString());
      });
    select(svg).call(comportamiento);
    zoomRef.current = comportamiento;
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  const acercar = (factor: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const restablecer = () => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  };

  const formaDe = (objetivo: EventTarget | null): Forma | null => {
    const k = (objetivo as SVGElement | null)?.dataset?.k;
    return k ? (POR_CLAVE.get(k) ?? null) : null;
  };

  const moverEtiqueta = (ev: MouseEvent) => {
    const caja = cajaRef.current;
    const el = etiquetaRef.current;
    if (!caja || !el) return;
    const forma = formaDe(ev.target);
    if (!forma) {
      el.style.opacity = '0';
      return;
    }
    const { nombre, dato } = etiqueta(forma);
    (el.firstElementChild as HTMLElement).textContent = nombre;
    (el.lastElementChild as HTMLElement).textContent = dato;
    const r = caja.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    // Si el ratón está cerca del borde derecho, la etiqueta se pone a la izquierda.
    const aLaIzquierda = x > r.width - 200;
    el.style.left = `${x + (aLaIzquierda ? -14 : 14)}px`;
    el.style.top = `${y + 14}px`;
    el.style.transform = aLaIzquierda ? 'translateX(-100%)' : 'none';
    el.style.opacity = '1';
  };

  const formaSel = seleccion ? POR_CLAVE.get(seleccion) : null;

  return (
    <div className="mapa-caja" ref={cajaRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label="Mapa del mundo. Usa el buscador de países de debajo si no puedes usar el ratón."
        onMouseMove={moverEtiqueta}
        onMouseLeave={() => {
          if (etiquetaRef.current) etiquetaRef.current.style.opacity = '0';
        }}
        onClick={(ev) => {
          const forma = formaDe(ev.target);
          if (forma) alElegir(forma);
        }}
      >
        <g ref={grupoRef}>
          <Formas rellenos={rellenos} />
          {formaSel && <path className="pais-sel" d={formaSel.d} />}
        </g>
      </svg>
      <div className="mapa-etiqueta" ref={etiquetaRef} aria-hidden="true">
        <strong />
        <span />
      </div>
      <div className="mapa-botones">
        <button type="button" onClick={() => acercar(1.8)} aria-label="Acercar el mapa" title="Acercar">
          +
        </button>
        <button type="button" onClick={() => acercar(1 / 1.8)} aria-label="Alejar el mapa" title="Alejar">
          −
        </button>
        <button type="button" onClick={restablecer} aria-label="Ver el mundo entero" title="Ver el mundo entero">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
