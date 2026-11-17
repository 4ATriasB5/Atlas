// FICHA DE FONDO: qué lleva dentro, cuánto cuesta y dónde se puede comprar.

import { useEffect, useMemo, useState } from 'react';
import { fechaCorta, numero } from './datos';
import { type Carteras, type DatosFondos, type Trozo, cargarCarteras, cargarFondos, comisionTexto, costeAnual, sinAcentos } from './fondos';
import { type DatosEmpresas, cargarEmpresas, enlaceEmpresa } from './empresas';
import { Brokers } from './PantallaFondos';

function Barras({ trozos, decimales = 1 }: { trozos: Trozo[]; decimales?: number }) {
  const mayor = Math.max(...trozos.map((t) => t.p), 0.01);
  return (
    <div className="barras">
      {trozos.map((t) => (
        <div key={t.n}>
          <div className="barra-texto">
            <span>{t.n}</span>
            <span className="tenue">{numero(t.p, decimales)} %</span>
          </div>
          <div className="barra-fondo">
            <div className="barra-relleno" style={{ width: `${(t.p / mayor) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FichaFondo({ isin, experto }: { isin: string; experto: boolean }) {
  const [datos, setDatos] = useState<DatosFondos | null | undefined>(undefined);
  const [carteras, setCarteras] = useState<Carteras | null>(null);
  const [bolsa, setBolsa] = useState<DatosEmpresas | null>(null);
  const [filtro, setFiltro] = useState('');
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    cargarFondos().then(setDatos);
    cargarCarteras().then(setCarteras);
    cargarEmpresas().then(setBolsa);
  }, []);
  useEffect(() => {
    setFiltro('');
    setTodas(false);
  }, [isin]);

  const fondo = datos?.fondos.find((f) => f.isin === isin);
  const posiciones = useMemo(() => {
    const lista = carteras?.deFondo[isin] ?? [];
    const q = sinAcentos(filtro.trim());
    return lista
      .map(([id, peso]) => ({ e: carteras!.empresas[id], peso }))
      .filter((x) => !q || x.e.busca.includes(q) || sinAcentos(`${x.e.pais} ${x.e.sector}`).includes(q));
  }, [carteras, isin, filtro]);

  if (datos === undefined) return <section className="panel tenue">Cargando el fondo…</section>;
  if (!fondo) {
    return (
      <section className="panel">
        <h1>Fondo no encontrado</h1>
        <p>
          Atlas no tiene datos del ISIN {isin}. <a href="#/fondos">Volver a la lista de fondos</a>.
        </p>
      </section>
    );
  }

  const diez = fondo.top.reduce((s, t) => s + t.p, 0);
  const frases: string[] = [];
  if (fondo.nPosiciones && fondo.top[0]) {
    frases.push(
      `Al comprar este ${fondo.tipo === 'ETF' ? 'ETF' : 'fondo'} compras de golpe un trocito de ${numero(fondo.nPosiciones)} empresas.`,
      `Las 10 mayores se llevan ${numero(diez, 0)} de cada 100 € que inviertes; la primera es ${fondo.top[0].n} (${numero(fondo.top[0].p, 1)} €).`,
    );
    if (fondo.paises[0]) frases.push(`${numero(fondo.paises[0].p, 0)} de cada 100 € están en ${fondo.paises[0].n}.`);
  }
  if (fondo.comision !== null) {
    frases.push(`Cuesta ${comisionTexto(fondo.comision)} al año: unos ${costeAnual(fondo.comision)} por cada 1.000 € invertidos.`);
  }
  const visibles = todas || filtro ? posiciones : posiciones.slice(0, 25);

  return (
    <div className="ficha">
      <header className="ficha-cabecera">
        <div>
          <a href="#/fondos" className="volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver a fondos
          </a>
          <h1 className="ficha-nombre fondo-nombre">{fondo.nombre}</h1>
          <p className="tenue">
            {fondo.tipo} · {fondo.gestora} · ISIN {fondo.isin}
          </p>
          <Brokers fondo={fondo} />
        </div>
        <div className="cifras">
          <div className="cifra">
            <div className="cifra-rotulo">{experto ? 'Gastos corrientes (TER)' : 'Comisión anual'}</div>
            <div className="cifra-valor">{comisionTexto(fondo.comision)}</div>
            <div className="cifra-pie">
              {fondo.comision !== null ? `Unos ${costeAnual(fondo.comision)} al año por cada 1.000 €. Dato escrito a mano: compruébalo.` : 'Sin dato: mira la web de la gestora.'}
            </div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">Empresas dentro</div>
            <div className="cifra-valor">{fondo.nPosiciones ? numero(fondo.nPosiciones) : '—'}</div>
            <div className="cifra-pie">{fondo.fechaCartera ? `Cartera del ${fechaCorta(fondo.fechaCartera)}.` : 'Cartera no disponible todavía.'}</div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">Dónde invierte</div>
            <div className="cifra-valor cifra-texto">{fondo.region}</div>
            <div className="cifra-pie">{fondo.tema === 'General' ? 'Todos los sectores.' : `Tema: ${fondo.tema}.`}</div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">Domicilio</div>
            <div className="cifra-valor cifra-texto">{fondo.domicilio}</div>
            <div className="cifra-pie">{experto ? 'Según el prefijo del ISIN.' : 'País donde está registrado el fondo.'}</div>
          </div>
        </div>
      </header>

      <section className="panel">
        <h2>{fondo.nombre} en 30 segundos</h2>
        {frases.length > 0 ? <p className="resumen">{frases.join(' ')}</p> : <p className="tenue">Sin datos suficientes para resumirlo.</p>}
        {!fondo.nPosiciones && (
          <p className="aviso">
            Atlas todavía no tiene la cartera de este fondo: su gestora ({fondo.gestora}) no la ofrece en un archivo
            descargable que hayamos podido usar. Por eso no aparece en el buscador inverso.
          </p>
        )}
        <p className="tenue pequeño">
          Resumen compuesto automáticamente con la cartera publicada por la gestora. No es una recomendación.
          {fondo.web && (
            <>
              {' '}
              <a href={fondo.web} target="_blank" rel="noreferrer">
                Ver la página oficial del fondo
              </a>
              .
            </>
          )}
        </p>
      </section>

      {fondo.nPosiciones ? (
        <>
          <div className="dos-columnas">
            <section className="panel">
              <h2>Las 10 mayores posiciones</h2>
              <p className="tenue subtitulo">Suman el {numero(diez, 1)} % del fondo</p>
              <Barras trozos={fondo.top} decimales={2} />
            </section>
            <section className="panel">
              <h2>Por sectores</h2>
              <p className="tenue subtitulo">Qué parte del dinero va a cada tipo de negocio</p>
              <Barras trozos={fondo.sectores} />
            </section>
          </div>

          <div className="dos-columnas">
            <section className="panel">
              <h2>Por países</h2>
              <p className="tenue subtitulo">Dónde cotizan las empresas del fondo</p>
              <Barras trozos={fondo.paises} />
            </section>
            <section className="panel">
              <h2>Todas las posiciones</h2>
              <p className="tenue subtitulo">
                {carteras ? `${numero(posiciones.length)} ${filtro ? 'coinciden' : 'con peso apreciable'}` : 'Cargando…'}
              </p>
              <input
                className="campo"
                type="search"
                placeholder="Filtra por empresa, país o sector"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                aria-label="Filtrar posiciones"
              />
              <ol className="posiciones">
                {visibles.slice(0, 400).map((x) => (
                  <li key={x.e.id}>
                    <span>
                      <a href={enlaceEmpresa(x.e.nombre, bolsa)}>{x.e.nombre}</a>
                      <span className="tenue pequeño">
                        {' '}
                        · {x.e.pais}
                        {experto && ` · ${x.e.sector}`}
                      </span>
                    </span>
                    <span className="tenue">{numero(x.peso, 2)} %</span>
                  </li>
                ))}
              </ol>
              {!todas && !filtro && posiciones.length > 25 && (
                <button type="button" className="boton-capa" onClick={() => setTodas(true)}>
                  Ver más posiciones
                </button>
              )}
              {visibles.length > 400 && <p className="tenue pequeño">Se muestran las 400 primeras. Usa el filtro para encontrar el resto.</p>}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
