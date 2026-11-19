// FASE 4: noticias explicadas y «¿por qué se ha movido?».
// Las noticias vienen de Finnhub con el titular original (en inglés), el medio y el enlace.
// Las etiquetas («Sin confirmar», «Opinión», tipo de noticia) se deciden por palabras clave del titular.

import { useEffect, useMemo, useState } from 'react';
import { pctSigno } from './datos';
import { type DatosEmpresas, type EmpresaBolsa, cargarEmpresas, useLista } from './empresas';
import {
  type DatosNoticias,
  type Explicacion,
  type Noticia,
  cargarNoticias,
  cargarNoticiasEmpresa,
  cuando,
  diaMedio,
  explicarMovimiento,
  fraseResultado,
  sorpresa,
} from './mercado';

const AVISO_RUMOR =
  'Sin confirmar: el titular habla de rumores, de fuentes anónimas o de algo que podría pasar. No lo tomes como un hecho hasta que la empresa o un organismo oficial lo confirme.';
const AVISO_OPINION = 'Opinión: el artículo da la opinión o la recomendación de alguien, no cuenta un hecho.';

function Etiquetas({ n, experto }: { n: Noticia; experto: boolean }) {
  return (
    <span className="etiquetas">
      {n.rumor && (
        <span className="etiqueta etiqueta-rumor" title={AVISO_RUMOR}>
          Sin confirmar
        </span>
      )}
      {n.opinion && (
        <span className="etiqueta etiqueta-opinion" title={AVISO_OPINION}>
          Opinión
        </span>
      )}
      {n.tipo !== 'Otras' && <span className="etiqueta">{n.tipo}</span>}
    </span>
  );
}

export function ListaNoticias({ noticias, experto, empresa }: { noticias: Noticia[]; experto: boolean; empresa?: (n: Noticia) => EmpresaBolsa | undefined }) {
  return (
    <ul className="noticias">
      {noticias.map((n) => {
        const de = empresa?.(n);
        return (
          <li key={`${n.u}-${n.d}`} className="noticia">
            <Etiquetas n={n} experto={experto} />
            <a href={n.u} target="_blank" rel="noreferrer" lang="en" className="noticia-titular">
              {n.t}
            </a>
            <span className="tenue pequeño">
              {de && (
                <>
                  <a href={`#/empresa/${de.t}`}>{experto ? de.t : de.n}</a> ·{' '}
                </>
              )}
              {n.f || 'Medio sin identificar'} · {cuando(n.d)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function LeyendaNoticias() {
  return (
    <p className="tenue pequeño leyenda-noticias">
      Titulares en inglés, tal como los publica cada medio; pulsa uno para leer la noticia original.{' '}
      <span className="etiqueta etiqueta-rumor">Sin confirmar</span> = rumores o fuentes anónimas.{' '}
      <span className="etiqueta etiqueta-opinion">Opinión</span> = alguien opina o recomienda; no es un hecho. Las etiquetas
      se ponen solas buscando palabras en el titular y alguna vez pueden fallar. Fuente: Finnhub.
    </p>
  );
}

// ───────────── En la ficha de empresa ─────────────

export function PorQueYNoticias({ e, datos, experto }: { e: EmpresaBolsa; datos: DatosEmpresas; experto: boolean }) {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const [indice, setIndice] = useState<DatosNoticias | null | undefined>(undefined);
  useEffect(() => {
    let vigente = true;
    setNoticias(null);
    cargarNoticiasEmpresa(e.t).then((n) => vigente && setNoticias(n));
    cargarNoticias().then((x) => vigente && setIndice(x));
    return () => {
      vigente = false;
    };
  }, [e.t]);

  const exp = useMemo(
    () => (noticias && indice !== undefined ? explicarMovimiento(e, datos, noticias, indice?.resultados[e.t] ?? [], experto) : null),
    [e, datos, noticias, indice, experto],
  );

  return (
    <>
      {exp && <CajaPorQue exp={exp} experto={experto} />}
      <section className="panel">
        <h2>Noticias</h2>
        <p className="tenue subtitulo">Lo último que han publicado los medios sobre {e.n} (última semana)</p>
        {noticias === null ? (
          <p className="tenue">Cargando noticias…</p>
        ) : noticias.length ? (
          <>
            <ListaNoticias noticias={noticias} experto={experto} />
            <LeyendaNoticias />
          </>
        ) : (
          <p className="aviso">No hemos encontrado noticias de esta empresa en la última semana.</p>
        )}
      </section>
    </>
  );
}

function CajaPorQue({ exp, experto }: { exp: Explicacion; experto: boolean }) {
  return (
    <section className={`panel porque porque-${exp.nivel}`}>
      <div className="porque-cabecera">
        <h2>¿Por qué se ha movido?</h2>
        <strong className={exp.cambio >= 0 ? 'sube' : 'baja'}>{pctSigno(exp.cambio, 2)}</strong>
      </div>
      {experto && (
        <div className="porque-barras" aria-hidden="true">
          <Comparacion nombre="Esta empresa" v={exp.cambio} />
          {exp.sector !== null && <Comparacion nombre="Su sector" v={exp.sector} />}
          {exp.mercado !== null && <Comparacion nombre="S&P 500" v={exp.mercado} />}
        </div>
      )}
      <p className="resumen">{exp.frases.join(' ')}</p>
      {exp.noticias.length > 0 && exp.nivel !== 'tranquilo' && (
        <>
          <p className="rotulo con-margen-pequeño">Noticias de ese día</p>
          <ListaNoticias noticias={exp.noticias} experto={experto} />
        </>
      )}
      {exp.proximo && (
        <p className="tenue pequeño con-margen-pequeño">
          Próximos resultados: {diaMedio(exp.proximo.d)}
          {exp.proximo.h === 'bmo' ? ', antes de abrir la bolsa' : exp.proximo.h === 'amc' ? ', después del cierre' : ''}.
        </p>
      )}
      <p className="tenue pequeño con-margen-pequeño">
        Son posibles causas, calculadas automáticamente comparando la empresa con su sector y con la bolsa. Ninguna noticia
        explica del todo un movimiento, y esto no es una recomendación.
      </p>
    </section>
  );
}

/** Barra horizontal que crece hacia la derecha (sube) o hacia la izquierda (baja). */
export function BarraCambio({ v, tope }: { v: number | null; tope: number }) {
  if (v === null) return <span className="barra-cambio" />;
  const ancho = Math.min(50, (Math.abs(v) / (tope || 1)) * 50);
  return (
    <span className="barra-cambio">
      <i className={v >= 0 ? 'positiva' : 'negativa'} style={v >= 0 ? { left: '50%', width: `${ancho}%` } : { right: '50%', width: `${ancho}%` }} />
    </span>
  );
}

function Comparacion({ nombre, v }: { nombre: string; v: number }) {
  return (
    <div className="comparacion">
      <span className="tenue pequeño">{nombre}</span>
      <BarraCambio v={v} tope={Math.max(3, Math.abs(v))} />
      <span className={`pequeño ${v >= 0 ? 'sube' : 'baja'}`}>{pctSigno(v, 2)}</span>
    </div>
  );
}

// ───────────── Pantalla «Noticias» ─────────────

export function PantallaNoticias({ experto }: { experto: boolean }) {
  const [datos, setDatos] = useState<DatosEmpresas | null | undefined>(undefined);
  const [indice, setIndice] = useState<DatosNoticias | null | undefined>(undefined);
  const [deEmpresas, setDeEmpresas] = useState<Map<string, Noticia[]>>(new Map());
  const [soloHechos, setSoloHechos] = useState(false);
  const lista = useLista();

  useEffect(() => {
    cargarEmpresas().then(setDatos);
    cargarNoticias().then(setIndice);
  }, []);

  // Las que más se han movido: 5 que más suben y 5 que más bajan.
  const movidas = useMemo(() => {
    if (!datos) return { suben: [], bajan: [] };
    const con = datos.empresas.filter((e) => typeof e.cambio === 'number');
    const orden = [...con].sort((a, b) => b.cambio! - a.cambio!);
    return { suben: orden.slice(0, 5), bajan: orden.slice(-5).reverse() };
  }, [datos]);

  const deLista = useMemo(() => (datos ? lista.map((t) => datos.porSimbolo.get(t)).filter((e): e is EmpresaBolsa => !!e).slice(0, 30) : []), [datos, lista]);

  useEffect(() => {
    const simbolos = [...movidas.suben, ...movidas.bajan, ...deLista].map((e) => e.t);
    let vigente = true;
    Promise.all(simbolos.map(async (t) => [t, await cargarNoticiasEmpresa(t)] as const)).then((pares) => vigente && setDeEmpresas(new Map(pares)));
    return () => {
      vigente = false;
    };
  }, [movidas, deLista]);

  if (datos === undefined || indice === undefined) return <section className="panel tenue">Cargando noticias…</section>;
  if (!datos || !indice) {
    return (
      <section className="panel">
        <h1>Noticias</h1>
        <p className="aviso">Todavía no hay noticias descargadas. Se descargan cada noche.</p>
      </section>
    );
  }

  const filtrar = (ns: Noticia[]) => (soloHechos ? ns.filter((n) => !n.opinion && !n.rumor) : ns);
  const noticiasLista = filtrar(
    deLista
      .flatMap((e) => (deEmpresas.get(e.t) ?? []).map((n) => ({ ...n, _t: e.t })))
      .sort((a, b) => b.d - a.d)
      .filter((n, i, todas) => todas.findIndex((x) => x.t === n.t) === i)
      .slice(0, 15),
  );
  const empresaDe = (n: Noticia) => datos.porSimbolo.get((n as Noticia & { _t?: string })._t ?? '');

  const hoy = new Date().toISOString().slice(0, 10);
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const en14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const resultados = Object.entries(indice.resultados).flatMap(([t, rs]) => {
    const e = datos.porSimbolo.get(t);
    return e && t !== 'GOOG' && t !== 'FOX' && t !== 'NWS' ? rs.map((r) => ({ e, r })) : [];
  });
  const presentados = resultados
    .filter(({ r }) => r.d >= hace7 && r.d <= hoy && r.bR !== null)
    .sort((a, b) => b.e.pesoSP - a.e.pesoSP)
    .slice(0, 10);
  const proximos = resultados
    .filter(({ r }) => r.d > hoy && r.d <= en14)
    .sort((a, b) => b.e.pesoSP - a.e.pesoSP)
    .slice(0, 10)
    .sort((a, b) => a.r.d.localeCompare(b.r.d));

  return (
    <div className="ficha">
      <header>
        <h1>Noticias</h1>
        <p className="tenue">
          Qué ha pasado en la bolsa, quién se ha movido más y por qué. Actualizado cada noche
          {indice.actualizado ? ` (último: ${cuando(Date.parse(indice.actualizado) / 1000)})` : ''}.
        </p>
      </header>

      <section className="panel">
        <h2>Las que más se han movido</h2>
        <p className="tenue subtitulo">
          Empresas del S&P 500 que más han subido y bajado en la última sesión, con la causa más probable
        </p>
        <div className="dos-columnas sin-margen">
          {(['suben', 'bajan'] as const).map((lado) => (
            <div key={lado}>
              <p className="rotulo">{lado === 'suben' ? 'Más suben' : 'Más bajan'}</p>
              <ul className="movidas">
                {movidas[lado].map((e) => {
                  const exp = deEmpresas.has(e.t) ? explicarMovimiento(e, datos, deEmpresas.get(e.t)!, indice.resultados[e.t] ?? [], experto) : null;
                  return (
                    <li key={e.t}>
                      <div className="movida-fila">
                        <a href={`#/empresa/${e.t}`}>{experto ? `${e.t} · ${e.n}` : e.n}</a>
                        <strong className={e.cambio! >= 0 ? 'sube' : 'baja'}>{pctSigno(e.cambio!, 1)}</strong>
                      </div>
                      <p className="tenue pequeño">{exp ? exp.breve : '…'}</p>
                      {exp?.noticias[0] && (
                        <a className="pequeño noticia-titular" href={exp.noticias[0].u} target="_blank" rel="noreferrer" lang="en">
                          {exp.noticias[0].t}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="tenue pequeño fuente">Pulsa en una empresa para ver la explicación completa en su ficha.</p>
      </section>

      <div className="grupo-botones filtro-noticias" role="group" aria-label="Qué noticias mostrar">
        <button type="button" className={`boton-capa ${!soloHechos ? 'activo' : ''}`} aria-pressed={!soloHechos} onClick={() => setSoloHechos(false)}>
          Todas las noticias
        </button>
        <button type="button" className={`boton-capa ${soloHechos ? 'activo' : ''}`} aria-pressed={soloHechos} onClick={() => setSoloHechos(true)}>
          Solo hechos (sin opiniones ni rumores)
        </button>
      </div>

      {deLista.length > 0 && (
        <section className="panel">
          <h2>De tu lista</h2>
          <p className="tenue subtitulo">Lo último sobre las empresas que sigues</p>
          {noticiasLista.length ? <ListaNoticias noticias={noticiasLista} experto={experto} empresa={empresaDe} /> : <p className="aviso">No hay noticias recientes de tus empresas.</p>}
        </section>
      )}

      <div className="dos-columnas">
        <section className="panel">
          <h2>Resultados de esta semana</h2>
          <p className="tenue subtitulo">
            {experto ? 'BPA real frente al consenso' : 'Cada tres meses las empresas cuentan cuánto han ganado. Lo importante es si ganan más o menos de lo que se esperaba.'}
          </p>
          {presentados.length ? (
            <ul className="avisos">
              {presentados.map(({ e, r }) => (
                <li key={`${e.t}-${r.d}`}>
                  <span>
                    <a href={`#/empresa/${e.t}`}>{e.n}</a>
                    <span className="tenue pequeño"> · {diaMedio(r.d)}</span>
                    <br />
                    <span className="tenue pequeño">{fraseResultado(r, experto)}</span>
                  </span>
                  <span className={{ mejor: 'sube', peor: 'baja', igual: 'tenue' }[sorpresa(r) ?? 'igual']}>
                    {{ mejor: 'Mejor', peor: 'Peor', igual: 'Igual', no: '—' }[sorpresa(r) ?? 'no']}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aviso">Ninguna gran empresa ha presentado resultados en los últimos 7 días.</p>
          )}
        </section>
        <section className="panel">
          <h2>Próximos resultados</h2>
          <p className="tenue subtitulo">Las mayores empresas que presentan en las próximas dos semanas</p>
          {proximos.length ? (
            <ul className="avisos">
              {proximos.map(({ e, r }) => (
                <li key={`${e.t}-${r.d}`}>
                  <span>
                    <a href={`#/empresa/${e.t}`}>{e.n}</a>
                    {experto && <span className="tenue pequeño"> · BPA esperado {r.bE !== null ? `${r.bE.toFixed(2).replace('.', ',')} $` : '—'}</span>}
                  </span>
                  <span className="tenue pequeño">
                    {diaMedio(r.d)}
                    {r.h === 'bmo' ? ' · antes de abrir' : r.h === 'amc' ? ' · tras el cierre' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aviso">Ninguna gran empresa presenta resultados en las próximas dos semanas.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Noticias del mercado</h2>
        <p className="tenue subtitulo">Economía, política y bolsa en general</p>
        <ListaNoticias noticias={filtrar(indice.mercado)} experto={experto} />
        <LeyendaNoticias />
      </section>

      <p className="tenue pequeño">
        Atlas solo muestra el titular, el medio y el enlace; el contenido es de cada medio. Nada de esta pantalla es una
        recomendación de compra o venta.
      </p>
    </div>
  );
}
