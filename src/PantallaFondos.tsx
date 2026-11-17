// PANTALLA 5: fondos y ETFs, con filtros y buscador inverso («¿qué fondos tienen NVIDIA?»).

import { useEffect, useMemo, useState } from 'react';
import { fechaCorta, numero } from './datos';
import {
  type Carteras,
  type DatosFondos,
  type Empresa,
  type Fondo,
  buscarEmpresas,
  cargarCarteras,
  cargarFondos,
  comisionTexto,
  sinAcentos,
} from './fondos';
import { type DatosEmpresas, cargarEmpresas, enlaceEmpresa } from './empresas';

const TODOS = 'Todos';

export function Brokers({ fondo }: { fondo: Fondo }) {
  return (
    <span className="brokers">
      {fondo.tradeRepublic && (
        <span className="broker tr" title="Aparece en la lista oficial de Trade Republic">
          Trade Republic
        </span>
      )}
      {fondo.myInvestor === 'si' && (
        <span className="broker mi" title="Confirmado por ti en tu lista de MyInvestor">
          MyInvestor
        </span>
      )}
      {fondo.myInvestor === 'por confirmar' && (
        <span className="broker duda" title="Propuesto en tu lista de MyInvestor, sin comprobar todavía">
          MyInvestor · por confirmar
        </span>
      )}
      {!fondo.tradeRepublic && fondo.myInvestor === 'no' && <span className="tenue pequeño">sin bróker asignado</span>}
    </span>
  );
}

export function PantallaFondos({ experto }: { experto: boolean }) {
  const [datos, setDatos] = useState<DatosFondos | null | undefined>(undefined);
  const [carteras, setCarteras] = useState<Carteras | null>(null);
  const [bolsa, setBolsa] = useState<DatosEmpresas | null>(null);
  const [texto, setTexto] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [nombre, setNombre] = useState('');
  const [tema, setTema] = useState(TODOS);
  const [region, setRegion] = useState(TODOS);
  const [tope, setTope] = useState('0');
  const [broker, setBroker] = useState(TODOS);

  useEffect(() => {
    cargarFondos().then(setDatos);
    cargarCarteras().then(setCarteras);
    cargarEmpresas().then(setBolsa);
  }, []);

  const fondos = datos?.fondos ?? [];
  const temas = useMemo(() => [...new Set(fondos.map((f) => f.tema))].sort((a, b) => a.localeCompare(b, 'es')), [fondos]);
  const regiones = useMemo(() => [...new Set(fondos.map((f) => f.region))].sort((a, b) => a.localeCompare(b, 'es')), [fondos]);
  const sugerencias = useMemo(() => (carteras && !empresa ? buscarEmpresas(carteras, texto) : []), [carteras, texto, empresa]);

  // Peso de la empresa elegida en cada fondo (ISIN -> %).
  const pesos = useMemo(() => {
    if (!empresa || !carteras) return null;
    return new Map(carteras.deEmpresa.get(empresa.id) ?? []);
  }, [empresa, carteras]);

  const visibles = useMemo(() => {
    const q = sinAcentos(nombre.trim());
    const max = Number(tope);
    const lista = fondos.filter(
      (f) =>
        (!pesos || pesos.has(f.isin)) &&
        (tema === TODOS || f.tema === tema) &&
        (region === TODOS || f.region === region) &&
        (max === 0 || (f.comision !== null && f.comision <= max)) &&
        (broker === TODOS ||
          (broker === 'Trade Republic' && f.tradeRepublic) ||
          (broker === 'MyInvestor' && f.myInvestor !== 'no')) &&
        (!q || sinAcentos(`${f.nombre} ${f.gestora} ${f.isin}`).includes(q)),
    );
    if (pesos) lista.sort((a, b) => (pesos.get(b.isin) ?? 0) - (pesos.get(a.isin) ?? 0));
    return lista;
  }, [fondos, pesos, nombre, tema, region, tope, broker]);

  if (datos === undefined) return <section className="panel tenue">Cargando fondos…</section>;
  if (datos === null || fondos.length === 0) {
    return (
      <section className="panel">
        <h1>Fondos y ETFs</h1>
        <p className="aviso">Todavía no hay datos de fondos. Se generan con «npm run fondos» (ver LEEME.md).</p>
      </section>
    );
  }

  const conCartera = fondos.filter((f) => f.nPosiciones).length;
  const mayorPeso = pesos ? Math.max(...visibles.map((f) => pesos.get(f.isin) ?? 0), 0.01) : 1;
  const hayFiltros = nombre || tema !== TODOS || region !== TODOS || tope !== '0' || broker !== TODOS;
  const elegir = (e: Empresa) => {
    setEmpresa(e);
    setTexto(e.nombre);
  };
  const soltar = () => {
    setEmpresa(null);
    setTexto('');
  };

  return (
    <>
      <section className="panel">
        <h1>Fondos y ETFs</h1>
        <p className="tenue subtitulo">
          {experto
            ? `${fondos.length} fondos y ETFs de Trade Republic y MyInvestor; ${conCartera} con cartera completa publicada por su gestora.`
            : 'Un fondo es una cesta con muchas empresas dentro. Aquí puedes ver qué lleva cada cesta y cuánto cuesta.'}
        </p>

        <div className="inverso">
          <label htmlFor="empresa" className="rotulo">
            Buscador inverso: ¿qué fondos tienen esta empresa?
          </label>
          <div className="inverso-fila">
            <input
              id="empresa"
              className="buscador"
              type="search"
              placeholder="Escribe una empresa: NVIDIA, Inditex, Samsung…"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setEmpresa(null);
              }}
              autoComplete="off"
            />
            {empresa && (
              <button type="button" className="boton-capa" onClick={soltar}>
                Quitar
              </button>
            )}
          </div>
          {!carteras && texto.length >= 2 && <p className="tenue pequeño">Cargando las carteras…</p>}
          {sugerencias.length > 0 && (
            <div className="sugerencias">
              {sugerencias.map((e) => (
                <button key={e.id} type="button" className="sugerencia" onClick={() => elegir(e)}>
                  <strong>{e.nombre}</strong>
                  <span className="tenue">
                    {e.pais} · {e.sector} · en {carteras?.deEmpresa.get(e.id)?.length ?? 0} fondos
                  </span>
                </button>
              ))}
            </div>
          )}
          {carteras && !empresa && texto.trim().length >= 2 && sugerencias.length === 0 && (
            <p className="tenue pequeño">
              Ninguna empresa con ese nombre en las carteras analizadas. Prueba con el nombre oficial en inglés.
            </p>
          )}
          {empresa && pesos && (
            <p className="resultado-inverso">
              <strong>{empresa.nombre}</strong> ({empresa.pais}, {empresa.sector.toLowerCase()}) está en{' '}
              <strong>{pesos.size}</strong> de los {conCartera} fondos con cartera publicada.
              {!experto && ' El «peso» es qué parte del dinero del fondo está invertida en ella.'}{' '}
              <a href={enlaceEmpresa(empresa.nombre, bolsa)}>Ver la ficha de la empresa</a>.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="filtros">
          <label>
            <span className="tenue pequeño">Nombre o ISIN</span>
            <input className="campo" type="search" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="MSCI World, IE00…" />
          </label>
          <label>
            <span className="tenue pequeño">{experto ? 'Sector o tema' : 'En qué invierte'}</span>
            <select value={tema} onChange={(e) => setTema(e.target.value)}>
              {[TODOS, ...temas].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Región</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {[TODOS, ...regiones].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Comisión anual</span>
            <select value={tope} onChange={(e) => setTope(e.target.value)}>
              <option value="0">Cualquiera</option>
              <option value="0.1">Hasta 0,10 %</option>
              <option value="0.2">Hasta 0,20 %</option>
              <option value="0.3">Hasta 0,30 %</option>
            </select>
          </label>
          <label>
            <span className="tenue pequeño">Bróker</span>
            <select value={broker} onChange={(e) => setBroker(e.target.value)}>
              {[TODOS, 'Trade Republic', 'MyInvestor'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="tenue pequeño cuenta">
          {visibles.length} {visibles.length === 1 ? 'fondo' : 'fondos'}
          {empresa ? `, ordenados por el peso de ${empresa.nombre}` : ''}
          {hayFiltros ? ' (con filtros)' : ''}
        </p>

        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fondo</th>
                {pesos && <th className="num">Peso de la empresa</th>}
                <th className="num">Comisión</th>
                <th className="col-ancha">Región · {experto ? 'tema' : 'en qué invierte'}</th>
                <th className="num col-ancha">Empresas</th>
                {!pesos && <th className="col-ancha">Mayor posición</th>}
                <th>Dónde</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const peso = pesos?.get(f.isin) ?? 0;
                return (
                  <tr key={f.isin}>
                    <td>
                      <a href={`#/fondo/${f.isin}`} className="fondo-enlace">
                        {f.nombre}
                      </a>
                      <div className="tenue pequeño">
                        {f.tipo} · {experto ? `${f.isin} · ${f.domicilio}` : f.gestora}
                      </div>
                    </td>
                    {pesos && (
                      <td className="num">
                        <strong>{numero(peso, 2)} %</strong>
                        <div className="barra-fondo">
                          <div className="barra-relleno" style={{ width: `${(peso / mayorPeso) * 100}%` }} />
                        </div>
                      </td>
                    )}
                    <td className="num">{comisionTexto(f.comision)}</td>
                    <td className="col-ancha">
                      {f.region}
                      <div className="tenue pequeño">{f.tema}</div>
                    </td>
                    <td className="num col-ancha">{f.nPosiciones ? numero(f.nPosiciones) : <span className="tenue">sin cartera</span>}</td>
                    {!pesos && (
                      <td className="col-ancha">
                        {f.top[0] ? (
                          <>
                            {f.top[0].n} <span className="tenue">{numero(f.top[0].p, 1)} %</span>
                          </>
                        ) : (
                          <span className="tenue">—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <Brokers fondo={f} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibles.length === 0 && <p className="aviso">Ningún fondo cumple esos filtros.</p>}

        <p className="tenue pequeño fuente">
          Carteras: archivos públicos de iShares, Xtrackers y SPDR (actualizado el {fechaCorta(datos.actualizado)}). Trade
          Republic: su lista oficial «Universo de inversión»
          {datos.etfsTradeRepublic ? `, con ${numero(datos.etfsTradeRepublic)} ETFs; Atlas analiza de momento ${fondos.length}` : ''}.
          MyInvestor: lista mantenida a mano, porque no publica su catálogo. Las comisiones están escritas a mano y pueden
          haber cambiado: compruébalas en el documento oficial del fondo antes de invertir. Atlas no recomienda ningún
          fondo.
        </p>
      </section>
    </>
  );
}
