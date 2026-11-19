// FASE 4: SECTORES. Agrupa las empresas del S&P 500 por sector y muestra cómo le va a cada uno.
// Sale de los datos de empresas que ya tenemos (empresas.json): no necesita ninguna fuente nueva.
// Las medias dan más peso a las empresas más grandes, igual que el propio índice.

import { useEffect, useMemo, useState } from 'react';
import { enumerar, numero, pct, pctSigno } from './datos';
import { type DatosEmpresas, type EmpresaBolsa, cargarEmpresas } from './empresas';
import { QUE_HACE, type Sector, cambioMercado, resumenSectores } from './mercado';
import { BarraCambio } from './Noticias';

const Color = ({ v, dec = 1 }: { v: number | null | undefined; dec?: number }) =>
  typeof v === 'number' ? <span className={v >= 0 ? 'sube' : 'baja'}>{pctSigno(v, dec)}</span> : <span className="tenue">—</span>;

const enlaceSector = (nombre: string) => `#/sectores/${encodeURIComponent(nombre)}`;

export function PantallaSectores({ experto, sector }: { experto: boolean; sector: string | null }) {
  const [datos, setDatos] = useState<DatosEmpresas | null | undefined>(undefined);
  useEffect(() => {
    cargarEmpresas().then(setDatos);
  }, []);
  const sectores = useMemo(() => (datos ? resumenSectores(datos) : []), [datos]);

  if (datos === undefined) return <section className="panel tenue">Cargando sectores…</section>;
  if (!datos) {
    return (
      <section className="panel">
        <h1>Sectores</h1>
        <p className="aviso">Todavía no hay datos de empresas.</p>
      </section>
    );
  }
  const mercado = cambioMercado(datos);
  if (sector) {
    const s = sectores.find((x) => x.nombre === sector);
    return s ? (
      <FichaSector s={s} mercado={mercado} experto={experto} />
    ) : (
      <section className="panel">
        <h1>Sector no encontrado</h1>
        <p>
          <a href="#/sectores">Volver a sectores</a>
        </p>
      </section>
    );
  }

  const conHoy = sectores.filter((s) => s.hoy !== null);
  const mejor = [...conHoy].sort((a, b) => b.hoy! - a.hoy!)[0];
  const peor = [...conHoy].sort((a, b) => a.hoy! - b.hoy!)[0];
  const tope = Math.max(1, ...conHoy.map((s) => Math.abs(s.hoy!)));
  const fecha = datos.empresas.find((e) => e.fecha)?.fecha;

  return (
    <div className="ficha">
      <header>
        <h1>Sectores</h1>
        <p className="tenue">
          Las 500 mayores empresas de EE. UU. agrupadas por lo que hacen.
          {fecha ? ` Datos del cierre del ${new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.` : ''}
        </p>
      </header>

      <section className="panel">
        <h2>Resumen del día</h2>
        <p className="resumen">
          {mercado !== null && <>La bolsa de EE. UU. (S&P 500) {mercado >= 0 ? 'subió' : 'bajó'} un {pct(Math.abs(mercado), 1)}. </>}
          {mejor && peor && mejor !== peor && (
            <>
              El sector al que mejor le fue es <a href={enlaceSector(mejor.nombre)}>{mejor.nombre.toLowerCase()}</a> ({pctSigno(mejor.hoy!)}) y al que peor,{' '}
              <a href={enlaceSector(peor.nombre)}>{peor.nombre.toLowerCase()}</a> ({pctSigno(peor.hoy!)}).
            </>
          )}
        </p>
        {!experto && (
          <p className="tenue pequeño con-margen-pequeño">
            Un sector es un grupo de empresas que se dedican a lo mismo. Suelen moverse juntas porque les afectan las mismas
            noticias: el precio del petróleo a las energéticas, los tipos de interés a los bancos…
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Cómo le va a cada sector</h2>
        <p className="tenue subtitulo">
          {experto
            ? 'Variaciones medias ponderadas por peso en el índice. PER: mediana del sector.'
            : 'Ordenados de mayor a menor peso en la bolsa. Pulsa uno para ver sus empresas.'}
        </p>
        <div className="tabla-caja">
          <table className="tabla tabla-sectores">
            <thead>
              <tr>
                <th>Sector</th>
                <th className="num">{experto ? 'Peso' : 'Parte de la bolsa'}</th>
                <th className="num">Hoy</th>
                <th className="col-barra" aria-hidden="true" />
                <th className="num">{experto ? 'YTD' : 'En el año'}</th>
                {experto && <th className="num">PER</th>}
                {experto && <th className="num">Div.</th>}
                {experto && <th className="num">Nº</th>}
              </tr>
            </thead>
            <tbody>
              {sectores.map((s) => (
                <tr key={s.nombre}>
                  <td>
                    <a href={enlaceSector(s.nombre)} className="fondo-enlace">
                      {s.nombre}
                    </a>
                    {!experto && <p className="tenue pequeño">{QUE_HACE[s.nombre] ?? ''}</p>}
                  </td>
                  <td className="num">
                    {pct(s.peso, 1)}
                    <div className="barra-fondo barra-fina">
                      <div className="barra-relleno" style={{ width: `${Math.min(100, (s.peso / sectores[0].peso) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="num">
                    <Color v={s.hoy} dec={2} />
                  </td>
                  <td className="col-barra">
                    <BarraCambio v={s.hoy} tope={tope} />
                  </td>
                  <td className="num">
                    <Color v={s.año} />
                  </td>
                  {experto && <td className="num">{s.perMediano ? numero(s.perMediano, 1) : '—'}</td>}
                  {experto && <td className="num">{s.dividendoMedio !== null ? pct(s.dividendoMedio, 1) : '—'}</td>}
                  {experto && <td className="num">{s.empresas.length}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tenue pequeño fuente">
          Calculado por Atlas con el precio de cada empresa (Finnhub) y su peso en el S&P 500 (iShares). «En el año» = desde
          el 1 de enero, sin contar dividendos.
        </p>
      </section>
    </div>
  );
}

function FilaEmpresa({ e, experto }: { e: EmpresaBolsa; experto: boolean }) {
  return (
    <li>
      <a href={`#/empresa/${e.t}`}>{experto ? `${e.t} · ${e.n}` : e.n}</a>
      <Color v={e.cambio} dec={2} />
    </li>
  );
}

function FichaSector({ s, mercado, experto }: { s: Sector; mercado: number | null; experto: boolean }) {
  const con = s.empresas.filter((e) => typeof e.cambio === 'number');
  const orden = [...con].sort((a, b) => b.cambio! - a.cambio!);
  const suben = orden.filter((e) => e.cambio! > 0).slice(0, 5);
  const bajan = orden.filter((e) => e.cambio! < 0).slice(-5).reverse();
  const grandes = s.empresas.slice(0, 10);
  const quienesSuben = con.filter((e) => e.cambio! > 0).length;

  const frases: string[] = [];
  frases.push(`${QUE_HACE[s.nombre] ?? ''} Las más grandes son ${enumerar(s.empresas.slice(0, 3).map((e) => e.n))}.`);
  frases.push(`Es el ${pct(s.peso, 1)} de la bolsa de EE. UU.: de cada 100 $ invertidos en un fondo del S&P 500, unos ${numero(s.peso, 0)} van a este sector.`);
  if (s.hoy !== null) {
    let comparado = '';
    if (mercado !== null) {
      const dif = s.hoy - mercado;
      comparado = Math.abs(dif) < 0.3 ? ', casi igual que la bolsa en general' : dif > 0 ? `, mejor que la bolsa en general (${pctSigno(mercado)})` : `, peor que la bolsa en general (${pctSigno(mercado)})`;
    }
    frases.push(`En la última sesión ${s.hoy >= 0 ? 'subió' : 'bajó'} un ${pct(Math.abs(s.hoy), 2)}${comparado}. Subieron ${quienesSuben} de sus ${con.length} empresas.`);
  }
  if (s.año !== null) frases.push(`En lo que va de año ha ${s.año >= 0 ? 'subido' : 'bajado'} un ${pct(Math.abs(s.año), 1)}.`);

  return (
    <div className="ficha">
      <header>
        <a href="#/sectores" className="volver">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver a sectores
        </a>
        <h1 className="ficha-nombre fondo-nombre">{s.nombre}</h1>
        <p className="tenue">{s.empresas.length} empresas del S&P 500</p>
      </header>

      <div className="cifras">
        <div className="cifra">
          <div className="cifra-rotulo">{experto ? 'Peso en el índice' : 'Parte de la bolsa'}</div>
          <div className="cifra-valor">{pct(s.peso, 1)}</div>
        </div>
        <div className="cifra">
          <div className="cifra-rotulo">Última sesión</div>
          <div className="cifra-valor">
            <Color v={s.hoy} dec={2} />
          </div>
        </div>
        <div className="cifra">
          <div className="cifra-rotulo">En el año</div>
          <div className="cifra-valor">
            <Color v={s.año} />
          </div>
        </div>
        <div className="cifra">
          <div className="cifra-rotulo">{experto ? 'PER mediano' : '¿Caro o barato? (PER)'}</div>
          <div className="cifra-valor">{s.perMediano ? numero(s.perMediano, 1) : '—'}</div>
          {!experto && <div className="cifra-pie">El de una empresa típica del sector. Cuanto más alto, más crecimiento se espera.</div>}
        </div>
      </div>

      <section className="panel">
        <h2>El sector en 30 segundos</h2>
        <p className="resumen">{frases.join(' ')}</p>
      </section>

      <div className="dos-columnas">
        <section className="panel">
          <h2>Hoy suben más</h2>
          {suben.length ? <ul className="lista-simple">{suben.map((e) => <FilaEmpresa key={e.t} e={e} experto={experto} />)}</ul> : <p className="aviso">Ninguna subió.</p>}
        </section>
        <section className="panel">
          <h2>Hoy bajan más</h2>
          {bajan.length ? <ul className="lista-simple">{bajan.map((e) => <FilaEmpresa key={e.t} e={e} experto={experto} />)}</ul> : <p className="aviso">Ninguna bajó.</p>}
        </section>
      </div>

      <section className="panel">
        <h2>Las que más pesan</h2>
        <p className="tenue subtitulo">Las 10 mayores del sector. Son las que más mueven la media.</p>
        <ul className="lista-simple">
          {grandes.map((e) => (
            <FilaEmpresa key={e.t} e={e} experto={experto} />
          ))}
        </ul>
        <p className="tenue pequeño fuente">
          <a href="#/empresas">Ver todas las empresas en el buscador</a> (puedes filtrar por sector).
        </p>
      </section>
    </div>
  );
}
