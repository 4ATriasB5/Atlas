// PANTALLA DE EMPRESAS: buscador con filtros (screener) y «Mi lista».

import { useEffect, useMemo, useState } from 'react';
import { dinero, fechaCorta, numero, pct, pctSigno } from './datos';
import { type DatosEmpresas, type EmpresaBolsa, alternarEnLista, cargarEmpresas, dividendo, per, tamaño, useLista } from './empresas';
import { sinAcentos } from './fondos';
import { useSesion } from './nube';

const TODOS = 'Todos';

/** Estrella para guardar o quitar una empresa de «Mi lista». */
export function BotonLista({ simbolo, conTexto = false }: { simbolo: string; conTexto?: boolean }) {
  const dentro = useLista().includes(simbolo);
  return (
    <button
      type="button"
      className={`estrella ${dentro ? 'dentro' : ''} ${conTexto ? 'con-texto' : ''}`}
      aria-pressed={dentro}
      aria-label={dentro ? `Quitar ${simbolo} de Mi lista` : `Añadir ${simbolo} a Mi lista`}
      title={dentro ? 'Quitar de Mi lista' : 'Añadir a Mi lista'}
      onClick={() => alternarEnLista(simbolo)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={dentro ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z" strokeLinejoin="round" />
      </svg>
      {conTexto && (dentro ? 'En Mi lista' : 'Añadir a Mi lista')}
    </button>
  );
}

type Columna = 'nombre' | 'precio' | 'cambio' | 'tamaño' | 'per' | 'dividendo' | 'margen' | 'rent52';

const valorDe: Record<Columna, (e: EmpresaBolsa) => number | string | null> = {
  nombre: (e) => e.n,
  precio: (e) => e.precio ?? null,
  cambio: (e) => e.cambio ?? null,
  tamaño: (e) => tamaño(e),
  per: (e) => per(e),
  dividendo: (e) => dividendo(e),
  margen: (e) => e.margen ?? null,
  rent52: (e) => e.rent52 ?? null,
};

const Color = ({ v, dec = 1 }: { v: number | null | undefined; dec?: number }) =>
  typeof v === 'number' ? <span className={v >= 0 ? 'sube' : 'baja'}>{pctSigno(v, dec)}</span> : <span className="tenue">—</span>;

export function PantallaEmpresas({ experto, soloLista }: { experto: boolean; soloLista: boolean }) {
  const [datos, setDatos] = useState<DatosEmpresas | null | undefined>(undefined);
  const lista = useLista();
  const sesion = useSesion();
  const [texto, setTexto] = useState('');
  const [sector, setSector] = useState(TODOS);
  const [talla, setTalla] = useState(TODOS);
  const [filtroPer, setFiltroPer] = useState(TODOS);
  const [filtroDiv, setFiltroDiv] = useState('0');
  const [filtroMargen, setFiltroMargen] = useState('0');
  const [filtroAño, setFiltroAño] = useState(TODOS);
  const [orden, setOrden] = useState<{ col: Columna; desc: boolean }>({ col: 'tamaño', desc: true });
  const [cuantas, setCuantas] = useState(50);

  useEffect(() => {
    cargarEmpresas().then(setDatos);
  }, []);
  useEffect(() => setCuantas(50), [texto, sector, talla, filtroPer, filtroDiv, filtroMargen, filtroAño, soloLista]);

  const empresas = datos?.empresas ?? [];
  const sectores = useMemo(() => [...new Set(empresas.map((e) => e.s))].sort((a, b) => a.localeCompare(b, 'es')), [empresas]);

  const visibles = useMemo(() => {
    const q = sinAcentos(texto.trim());
    const minDiv = Number(filtroDiv);
    const minMargen = Number(filtroMargen);
    const filtradas = empresas.filter((e) => {
      if (soloLista && !lista.includes(e.t)) return false;
      if (q && !sinAcentos(e.n).includes(q) && !e.t.toLowerCase().startsWith(q)) return false;
      if (sector !== TODOS && e.s !== sector) return false;
      const v = tamaño(e);
      if (talla === 'Gigantes' && !(v && v >= 2e11)) return false;
      if (talla === 'Grandes' && !(v && v >= 5e10 && v < 2e11)) return false;
      if (talla === 'Medianas' && !(v && v < 5e10)) return false;
      const p = per(e);
      if (filtroPer === 'bajo' && !(p && p <= 15)) return false;
      if (filtroPer === 'medio' && !(p && p > 15 && p <= 30)) return false;
      if (filtroPer === 'alto' && !(p && p > 30)) return false;
      if (filtroPer === 'sin' && p) return false;
      if (minDiv > 0 && !((dividendo(e) ?? 0) >= minDiv)) return false;
      if (minMargen > 0 && !((e.margen ?? -Infinity) >= minMargen)) return false;
      if (filtroAño === 'sube' && !((e.rent52 ?? -1) >= 0)) return false;
      if (filtroAño === 'baja' && !((e.rent52 ?? 1) < 0)) return false;
      return true;
    });
    const f = valorDe[orden.col];
    return filtradas.sort((a, b) => {
      const [x, y] = [f(a), f(b)];
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // sin dato, siempre al final
      const d = typeof x === 'string' ? x.localeCompare(y as string, 'es') : x - (y as number);
      return orden.desc ? -d : d;
    });
  }, [empresas, lista, soloLista, texto, sector, talla, filtroPer, filtroDiv, filtroMargen, filtroAño, orden]);

  if (datos === undefined) return <section className="panel tenue">Cargando empresas…</section>;
  if (datos === null || empresas.length === 0) {
    return (
      <section className="panel">
        <h1>{soloLista ? 'Mi lista' : 'Empresas'}</h1>
        <p className="aviso">Todavía no hay datos de empresas. Se generan con «npm run empresas» (ver LEEME.md).</p>
      </section>
    );
  }

  const hayFiltros = texto || sector !== TODOS || talla !== TODOS || filtroPer !== TODOS || filtroDiv !== '0' || filtroMargen !== '0' || filtroAño !== TODOS;
  const cabecera = (col: Columna, titulo: string, ancha = false) => (
    <th key={col} className={`${col === 'nombre' ? '' : 'num'} ${ancha ? 'col-ancha' : ''}`} aria-sort={orden.col === col ? (orden.desc ? 'descending' : 'ascending') : undefined}>
      <button
        type="button"
        className="ordenar"
        title="Ordenar por esta columna"
        onClick={() => setOrden((o) => ({ col, desc: o.col === col ? !o.desc : col !== 'nombre' }))}
      >
        {titulo}
        {orden.col === col ? (orden.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );

  return (
    <>
      <section className="panel">
        <h1>{soloLista ? 'Mi lista' : 'Empresas'}</h1>
        <p className="tenue subtitulo">
          {soloLista
            ? sesion
              ? 'Las empresas que has marcado con la estrella. Se guardan en tu cuenta y se ven en todos tus dispositivos.'
              : 'Las empresas que has marcado con la estrella. Se guardan solo en este dispositivo.'
            : experto
              ? `Las ${empresas.length} empresas del S&P 500, con precio de cierre e indicadores de los últimos 12 meses.`
              : `Las ${empresas.length} mayores empresas de la bolsa de Estados Unidos. Usa los filtros para encontrar las que buscas y pulsa en una para ver su ficha.`}
        </p>

        <div className="filtros">
          <label>
            <span className="tenue pequeño">Nombre o símbolo</span>
            <input className="campo" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Apple, NVDA…" />
          </label>
          <label>
            <span className="tenue pequeño">Sector</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              {[TODOS, ...sectores].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Tamaño</span>
            <select value={talla} onChange={(e) => setTalla(e.target.value)}>
              <option value={TODOS}>Todos</option>
              <option value="Gigantes">Gigantes (más de 200 mil M $)</option>
              <option value="Grandes">Grandes (50 a 200 mil M $)</option>
              <option value="Medianas">Medianas (menos de 50 mil M $)</option>
            </select>
          </label>
          <label>
            <span className="tenue pequeño">{experto ? 'PER' : '¿Cara o barata? (PER)'}</span>
            <select value={filtroPer} onChange={(e) => setFiltroPer(e.target.value)}>
              <option value={TODOS}>Cualquiera</option>
              <option value="bajo">PER bajo (hasta 15)</option>
              <option value="medio">PER medio (15 a 30)</option>
              <option value="alto">PER alto (más de 30)</option>
              <option value="sin">Sin beneficios</option>
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Dividendo</span>
            <select value={filtroDiv} onChange={(e) => setFiltroDiv(e.target.value)}>
              <option value="0">Cualquiera</option>
              <option value="1">Al menos 1 %</option>
              <option value="2">Al menos 2 %</option>
              <option value="4">Al menos 4 %</option>
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Margen de beneficio</span>
            <select value={filtroMargen} onChange={(e) => setFiltroMargen(e.target.value)}>
              <option value="0">Cualquiera</option>
              <option value="10">Al menos 10 %</option>
              <option value="20">Al menos 20 %</option>
              <option value="30">Al menos 30 %</option>
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Precio en 12 meses</span>
            <select value={filtroAño} onChange={(e) => setFiltroAño(e.target.value)}>
              <option value={TODOS}>Cualquiera</option>
              <option value="sube">Ha subido</option>
              <option value="baja">Ha bajado</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <p className="tenue pequeño cuenta" style={{ marginTop: 0 }}>
          {visibles.length} {visibles.length === 1 ? 'empresa' : 'empresas'}
          {hayFiltros ? ' (con filtros)' : ''} · pulsa en el título de una columna para ordenar
        </p>
        {soloLista && lista.length === 0 ? (
          <p className="aviso">
            Tu lista está vacía. Ve a <a href="#/empresas">Empresas</a> y pulsa la estrella de las que quieras seguir.
          </p>
        ) : (
          <>
            <div className="tabla-caja">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="col-estrella">
                      <span className="oculto">Mi lista</span>
                    </th>
                    {cabecera('nombre', 'Empresa')}
                    {cabecera('precio', 'Precio')}
                    {cabecera('cambio', 'Último día')}
                    {cabecera('tamaño', 'Tamaño', true)}
                    {cabecera('per', 'PER', true)}
                    {cabecera('dividendo', 'Dividendo', true)}
                    {cabecera('margen', 'Margen', true)}
                    {cabecera('rent52', '12 meses')}
                  </tr>
                </thead>
                <tbody>
                  {visibles.slice(0, cuantas).map((e) => {
                    const v = tamaño(e);
                    const p = per(e);
                    const d = dividendo(e);
                    return (
                      <tr key={e.t}>
                        <td className="col-estrella">
                          <BotonLista simbolo={e.t} />
                        </td>
                        <td>
                          <a href={`#/empresa/${e.t}`} className="fondo-enlace">
                            {e.n}
                          </a>
                          <div className="tenue pequeño">
                            {e.t} · {e.s}
                          </div>
                        </td>
                        <td className="num">{e.precio ? `${numero(e.precio, 2)} $` : '—'}</td>
                        <td className="num">
                          <Color v={e.cambio} dec={2} />
                        </td>
                        <td className="num col-ancha">{v ? dinero(v, experto) : '—'}</td>
                        <td className="num col-ancha">{p ? numero(p, 1) : <span className="tenue">—</span>}</td>
                        <td className="num col-ancha">{d !== null ? pct(d, 2) : <span className="tenue">—</span>}</td>
                        <td className="num col-ancha">{typeof e.margen === 'number' ? pct(e.margen, 1) : <span className="tenue">—</span>}</td>
                        <td className="num">
                          <Color v={e.rent52} dec={0} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visibles.length === 0 && <p className="aviso">Ninguna empresa cumple esos filtros.</p>}
            {visibles.length > cuantas && (
              <button type="button" className="boton-capa" style={{ marginTop: 12 }} onClick={() => setCuantas((c) => c + 100)}>
                Ver más empresas
              </button>
            )}
          </>
        )}

        <p className="tenue pequeño fuente">
          Precios e indicadores: Finnhub, cierre del {fechaCorta(datos.actualizado)} (se actualizan una vez al día, no en
          tiempo real). Cuentas anuales: SEC EDGAR. Lista de empresas: cartera del S&P 500 publicada por iShares. De
          momento solo hay empresas que cotizan en Estados Unidos. Atlas no recomienda comprar ni vender ninguna acción.
        </p>
      </section>
    </>
  );
}
