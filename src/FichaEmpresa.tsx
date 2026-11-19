// FICHA DE EMPRESA: precio, tamaño, cuentas, indicadores explicados y qué fondos la llevan.

import { type PointerEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertasEmpresa } from './Cuenta';
import { dinero, fechaCorta, numero, pct, pctSigno } from './datos';
import {
  type Cuenta,
  type DatosEmpresas,
  type EmpresaBolsa,
  type Historico,
  cargarEmpresas,
  cargarHistorico,
  dividendo,
  palabraTamaño,
  per,
  tamaño,
} from './empresas';
import { type Carteras, type DatosFondos, cargarCarteras, cargarFondos } from './fondos';
import { PorQueYNoticias } from './Noticias';
import { BotonLista } from './PantallaEmpresas';

const AZUL = '#4C9AFF';
const NARANJA = '#F59E42';

const dolares = (v: number, dec = 2) => `${numero(v, dec)} $`;
const diaCorto = (f: string) => new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

function Volver() {
  return (
    <a href="#/empresas" className="volver">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Volver a empresas
    </a>
  );
}

// ───────────── Gráfico del precio ─────────────

function GraficoPrecio({ puntos }: { puntos: [string, number][] }) {
  const [años, setAños] = useState(5);
  const [sobre, setSobre] = useState<number | null>(null);
  const serie = useMemo(() => puntos.slice(-(años * 52 + 1)), [puntos, años]);
  const n = serie.length;
  const valores = serie.map((p) => p[1]);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const ANCHO = 1000;
  const ALTO = 260;
  const x = (i: number) => (i / (n - 1)) * ANCHO;
  const y = (v: number) => 10 + (1 - (v - min) / (max - min || 1)) * (ALTO - 20);
  const linea = serie.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const variacion = (valores[n - 1] / valores[0] - 1) * 100;
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    setSobre(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - caja.left) / caja.width) * (n - 1)))));
  };
  const punto = sobre !== null && sobre < n ? serie[sobre] : null;
  const disponibles = Math.floor((puntos.length - 1) / 52);

  return (
    <div>
      <div className="precio-cabecera">
        <p>
          {punto ? (
            <>
              <strong>{dolares(punto[1])}</strong> <span className="tenue">· semana del {diaCorto(punto[0])}</span>
            </>
          ) : (
            <>
              Desde el {diaCorto(serie[0][0])}: <strong className={variacion >= 0 ? 'sube' : 'baja'}>{pctSigno(variacion, 0)}</strong>
            </>
          )}
        </p>
        <div className="grupo-botones" role="group" aria-label="Periodo del gráfico">
          {[1, 3, 5]
            .filter((a) => a === 1 || a <= Math.max(disponibles, 1))
            .map((a) => (
              <button key={a} type="button" className={`boton-capa ${a === años ? 'activo' : ''}`} aria-pressed={a === años} onClick={() => setAños(a)}>
                {a} {a === 1 ? 'año' : 'años'}
              </button>
            ))}
        </div>
      </div>
      <div
        className="precio-grafico"
        onPointerMove={mover}
        onPointerLeave={() => setSobre(null)}
        role="img"
        aria-label={`Precio de la acción: de ${dolares(valores[0])} el ${diaCorto(serie[0][0])} a ${dolares(valores[n - 1])} el ${diaCorto(serie[n - 1][0])}`}
      >
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="relleno-precio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={AZUL} stopOpacity="0.28" />
              <stop offset="1" stopColor={AZUL} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${linea} L${ANCHO} ${ALTO} L0 ${ALTO} Z`} fill="url(#relleno-precio)" />
          <path d={linea} fill="none" stroke={AZUL} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <span className="precio-tope arriba">{dolares(max, 0)}</span>
        <span className="precio-tope abajo">{dolares(min, 0)}</span>
        {punto && sobre !== null && (
          <>
            <i className="precio-raya" style={{ left: `${(sobre / (n - 1)) * 100}%` }} />
            <i className="precio-punto" style={{ left: `${(sobre / (n - 1)) * 100}%`, top: `${(y(punto[1]) / ALTO) * 100}%` }} />
          </>
        )}
      </div>
      <div className="precio-fechas tenue pequeño">
        <span>{diaCorto(serie[0][0])}</span>
        <span>{diaCorto(serie[n - 1][0])}</span>
      </div>
    </div>
  );
}

// ───────────── Barras de ingresos y beneficios ─────────────

function BarrasAnuales({ titulo, cuentas }: { titulo: string; cuentas: Cuenta[] }) {
  const mayor = Math.max(...cuentas.map((c) => Math.abs(c.v)), 1);
  const enMiles = mayor >= 1e10;
  const divisor = enMiles ? 1e9 : 1e6;
  return (
    <div>
      <p className="rotulo">
        {titulo} · {enMiles ? 'miles de millones de $' : 'millones de $'}
      </p>
      <div
        className="grafico grafico-bajo"
        role="img"
        aria-label={`${titulo}: ${cuentas.map((c) => `${c.a}, ${dinero(c.v)}`).join('; ')}`}
      >
        {cuentas.map((c) => (
          <div key={c.a} className="grafico-columna">
            <span className="grafico-valor">{numero(c.v / divisor, Math.abs(c.v / divisor) < 10 ? 1 : 0).replace('-', '−')}</span>
            <div className="grafico-barra" style={{ height: `${Math.max(2, (Math.abs(c.v) / mayor) * 100)}%`, background: c.v < 0 ? NARANJA : AZUL }} />
            <span className="grafico-año">{c.a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Indicador({ nombre, valor, explicacion }: { nombre: string; valor: ReactNode; explicacion: string }) {
  return (
    <div className="indicador">
      <div className="indicador-fila">
        <span>{nombre}</span>
        <strong>{valor}</strong>
      </div>
      <p className="tenue pequeño">{explicacion}</p>
    </div>
  );
}

// ───────────── Fondos que llevan la empresa ─────────────

function FondosQueLaLlevan({ nombre, carteras, fondos }: { nombre: string; carteras: Carteras | null; fondos: DatosFondos | null }) {
  const lista = useMemo(() => {
    const empresa = carteras?.empresas.find((x) => x.nombre === nombre);
    if (!empresa || !carteras) return [];
    return [...(carteras.deEmpresa.get(empresa.id) ?? [])].sort((a, b) => b[1] - a[1]);
  }, [carteras, nombre]);
  const mayor = Math.max(...lista.map((x) => x[1]), 0.01);
  return (
    <section className="panel">
      <h2>Fondos que la llevan dentro</h2>
      <p className="tenue subtitulo">
        {!carteras
          ? 'Cargando las carteras…'
          : lista.length
            ? `Está en ${lista.length} de los fondos y ETFs analizados. El peso es qué parte del dinero del fondo va a esta empresa.`
            : 'Ninguno de los fondos analizados la tiene en cartera.'}
      </p>
      {lista.length > 0 && (
        <ol className="posiciones">
          {lista.map(([isin, peso]) => (
            <li key={isin}>
              <span>
                <a href={`#/fondo/${isin}`}>{fondos?.fondos.find((f) => f.isin === isin)?.nombre ?? isin}</a>
                <div className="barra-fondo barra-fina">
                  <div className="barra-relleno" style={{ width: `${(peso / mayor) * 100}%` }} />
                </div>
              </span>
              <span className="tenue">{numero(peso, 2)} %</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ───────────── Ficha ─────────────

export function FichaEmpresa({ clave, experto }: { clave: string; experto: boolean }) {
  const [datos, setDatos] = useState<DatosEmpresas | null | undefined>(undefined);
  const [carteras, setCarteras] = useState<Carteras | null>(null);
  const [fondos, setFondos] = useState<DatosFondos | null>(null);
  const [historico, setHistorico] = useState<Historico | null | undefined>(undefined);

  const porNombre = clave.startsWith('~');
  const nombreBuscado = porNombre ? clave.slice(1) : null;
  const e: EmpresaBolsa | undefined = porNombre ? datos?.porNombre.get(nombreBuscado!) : datos?.porSimbolo.get(clave.toUpperCase());

  useEffect(() => {
    cargarEmpresas().then(setDatos);
    cargarCarteras().then(setCarteras);
    cargarFondos().then(setFondos);
  }, []);
  useEffect(() => {
    setHistorico(undefined);
    if (!e) return;
    let vigente = true;
    (e.h ? cargarHistorico(e.t) : Promise.resolve(null)).then((h) => vigente && setHistorico(h));
    return () => {
      vigente = false;
    };
  }, [e]);

  // Al historial semanal se le añade el precio de hoy como último punto.
  const puntos = useMemo(() => {
    if (!historico || !e) return [];
    const p = [...historico.puntos];
    if (e.precio && e.fecha && p.length && e.fecha > p[p.length - 1][0]) p.push([e.fecha, e.precio]);
    return p;
  }, [historico, e]);

  if (datos === undefined) return <section className="panel tenue">Cargando la empresa…</section>;

  // Empresa sin precio en Atlas (por ejemplo, las que no cotizan en EE. UU.): ficha reducida.
  if (!e) {
    const deCartera = nombreBuscado ? carteras?.empresas.find((x) => x.nombre === nombreBuscado) : undefined;
    if (porNombre && !carteras) return <section className="panel tenue">Cargando la empresa…</section>;
    if (!deCartera) {
      return (
        <section className="panel">
          <h1>Empresa no encontrada</h1>
          <p>
            Atlas no tiene datos de «{nombreBuscado ?? clave}». <a href="#/empresas">Volver a la lista de empresas</a>.
          </p>
        </section>
      );
    }
    return (
      <div className="ficha">
        <header>
          <Volver />
          <h1 className="ficha-nombre fondo-nombre">{deCartera.nombre}</h1>
          <p className="tenue">
            {deCartera.pais} · {deCartera.sector}
            {deCartera.simbolo && experto ? ` · ${deCartera.simbolo}` : ''}
          </p>
        </header>
        <section className="panel">
          <p className="aviso">
            Atlas todavía no tiene el precio ni las cuentas de esta empresa. Las fuentes gratuitas que usamos solo
            cubren, de momento, las 500 mayores empresas que cotizan en Estados Unidos.
          </p>
        </section>
        <FondosQueLaLlevan nombre={deCartera.nombre} carteras={carteras} fondos={fondos} />
      </div>
    );
  }

  const valor = tamaño(e);
  const suPer = per(e);
  const suDividendo = dividendo(e);
  const puesto = datos ? datos.empresas.indexOf(e) + 1 : 0;
  const ingresos = (e.ingresos ?? []).slice(-6);
  const beneficios = (e.beneficios ?? []).slice(-6);
  const ultIngreso = ingresos[ingresos.length - 1];
  const ultBeneficio = beneficios.find((b) => b.a === ultIngreso?.a);

  const frases: string[] = [`${e.n} es una empresa de Estados Unidos del sector «${e.s}».`];
  if (valor) frases.push(`Toda la empresa vale en bolsa ${dinero(valor)}: es la número ${puesto} por tamaño de las ${datos!.empresas.length} que sigue Atlas.`);
  if (ultIngreso && ultBeneficio && ultIngreso.v > 0) {
    frases.push(
      ultBeneficio.v >= 0
        ? `En ${ultIngreso.a} ingresó ${dinero(ultIngreso.v)} y ganó ${dinero(ultBeneficio.v)}: de cada 100 $ que vendió, le quedaron ${numero((ultBeneficio.v / ultIngreso.v) * 100, 0)} $ de beneficio.`
        : `En ${ultIngreso.a} ingresó ${dinero(ultIngreso.v)} y perdió ${dinero(-ultBeneficio.v)}.`,
    );
  }
  if (suPer) frases.push(`Su acción cuesta ${numero(suPer, 0)} veces lo que la empresa gana por acción en un año.`);
  if (suDividendo !== null) {
    frases.push(suDividendo > 0 ? `Reparte a sus accionistas un dividendo de alrededor del ${pct(suDividendo, 1)} al año.` : 'No reparte dividendo.');
  }
  if (typeof e.rent52 === 'number') {
    frases.push(`En los últimos 12 meses su precio ha ${e.rent52 >= 0 ? 'subido' : 'bajado'} un ${pct(Math.abs(e.rent52), 0)}.`);
  }

  const enRango = e.min52 && e.max52 && e.precio ? Math.max(0, Math.min(100, ((e.precio - e.min52) / (e.max52 - e.min52 || 1)) * 100)) : null;

  return (
    <div className="ficha">
      <header className="ficha-cabecera">
        <div>
          <Volver />
          <h1 className="ficha-nombre fondo-nombre">{e.n}</h1>
          <p className="tenue">
            {e.t} · {e.s}
            {experto && e.ind ? ` · ${e.ind}` : ''}
            {experto && e.salida ? ` · en bolsa desde ${e.salida.slice(0, 4)}` : ''}
          </p>
          <BotonLista simbolo={e.t} conTexto />
        </div>
        <div className="cifras">
          <div className="cifra">
            <div className="cifra-rotulo">Precio de una acción</div>
            <div className="cifra-valor">{e.precio ? dolares(e.precio) : '—'}</div>
            <div className="cifra-pie">
              {typeof e.cambio === 'number' && <span className={e.cambio >= 0 ? 'sube' : 'baja'}>{pctSigno(e.cambio, 2)}</span>}
              {e.fecha ? ` · cierre del ${diaCorto(e.fecha)}` : ''}
            </div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">{experto ? 'Capitalización bursátil' : 'Tamaño (valor en bolsa)'}</div>
            <div className="cifra-valor cifra-texto">{valor ? dinero(valor, experto) : '—'}</div>
            <div className="cifra-pie">{valor ? `${palabraTamaño(valor)}. Lo que costaría comprar todas sus acciones.` : 'Sin dato.'}</div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">{experto ? 'PER (últimos 12 meses)' : '¿Cara o barata? (PER)'}</div>
            <div className="cifra-valor">{suPer ? numero(suPer, 1) : '—'}</div>
            <div className="cifra-pie">
              {suPer
                ? 'Años de beneficios actuales que pagas al comprarla. Cuanto más alto, más crecimiento se espera de ella.'
                : 'No se calcula: en los últimos 12 meses no ha tenido beneficios.'}
            </div>
          </div>
          <div className="cifra">
            <div className="cifra-rotulo">{experto ? 'Rentabilidad por dividendo' : 'Dividendo'}</div>
            <div className="cifra-valor">{suDividendo !== null ? pct(suDividendo, 2) : '—'}</div>
            <div className="cifra-pie">
              {suDividendo
                ? `Parte de sus beneficios que reparte en efectivo: unos ${dolares((suDividendo / 100) * 1000, 0)} al año por cada 1.000 $.`
                : suDividendo === 0
                  ? 'No reparte dinero a sus accionistas.'
                  : 'Sin dato.'}
            </div>
          </div>
        </div>
      </header>

      <section className="panel">
        <h2>{e.n} en 30 segundos</h2>
        <p className="resumen">{frases.join(' ')}</p>
        <p className="tenue pequeño">
          Resumen compuesto automáticamente con los datos de esta ficha. No es una recomendación de compra ni de venta.
          {e.web && (
            <>
              {' '}
              <a href={e.web} target="_blank" rel="noreferrer">
                Web de la empresa
              </a>
              .
            </>
          )}
        </p>
      </section>

      {datos && <PorQueYNoticias e={e} datos={datos} experto={experto} />}

      <section className="panel">
        <h2>Precio de la acción</h2>
        <p className="tenue subtitulo">{experto ? 'Cierres semanales en dólares, ajustados por desdoblamientos' : 'Cuánto ha costado una acción cada semana, en dólares'}</p>
        {historico === undefined && e.h ? (
          <p className="tenue">Cargando el gráfico…</p>
        ) : puntos.length > 2 ? (
          <GraficoPrecio key={e.t} puntos={puntos} />
        ) : (
          <p className="aviso">Atlas todavía no ha descargado el historial de precios de esta empresa.</p>
        )}
        {enRango !== null && (
          <div className="rango">
            <p className="tenue pequeño">Dónde está hoy entre su precio más bajo y más alto del último año</p>
            <div className="rango-fila">
              <span>{dolares(e.min52!)}</span>
              <div className="barra-fondo rango-barra">
                <i style={{ left: `${enRango}%` }} />
              </div>
              <span>{dolares(e.max52!)}</span>
            </div>
          </div>
        )}
      </section>

      <div className="dos-columnas">
        <section className="panel">
          <h2>Ingresos y beneficios</h2>
          <p className="tenue subtitulo">
            {experto ? 'Cifras anuales declaradas a la SEC (formulario 10-K)' : 'Lo que vende y lo que le queda limpio cada año'} ·{' '}
            <span style={{ color: '#F5A55C' }}>naranja = pérdidas</span>
          </p>
          {ingresos.length || beneficios.length ? (
            <>
              {ingresos.length > 0 && <BarrasAnuales titulo="Ingresos" cuentas={ingresos} />}
              {beneficios.length > 0 && <BarrasAnuales titulo="Beneficio neto" cuentas={beneficios} />}
              <p className="tenue pequeño fuente">
                Fuente: SEC EDGAR, el registro oficial de EE. UU. Cada empresa cierra su año en un mes distinto; se
                asigna al año natural más cercano.
              </p>
            </>
          ) : (
            <p className="aviso">Atlas todavía no tiene las cuentas anuales de esta empresa.</p>
          )}
        </section>

        <section className="panel">
          <h2>{experto ? 'Indicadores' : 'Cómo le va, en números'}</h2>
          <p className="tenue subtitulo">Calculados con sus últimos 12 meses</p>
          <div className="indicadores">
            {typeof e.margen === 'number' && (
              <Indicador
                nombre={experto ? 'Margen neto' : 'Margen de beneficio'}
                valor={pct(e.margen, 1)}
                explicacion="De cada 100 $ que vende, cuántos le quedan de beneficio después de pagarlo todo."
              />
            )}
            {typeof e.crecIngresos === 'number' && (
              <Indicador
                nombre="Crecimiento de las ventas"
                valor={<span className={e.crecIngresos >= 0 ? 'sube' : 'baja'}>{pctSigno(e.crecIngresos, 1)}</span>}
                explicacion={`Cuánto más (o menos) ha vendido que un año antes.${typeof e.crecIngresos5 === 'number' ? ` Media de los últimos 5 años: ${pctSigno(e.crecIngresos5, 1)} al año.` : ''}`}
              />
            )}
            {typeof e.roe === 'number' && (
              <Indicador
                nombre={experto ? 'ROE' : 'Rentabilidad para sus dueños (ROE)'}
                valor={pct(e.roe, 1)}
                explicacion="Cuánto gana al año por cada 100 $ de dinero propio de los accionistas. Sale muy alto en empresas que recompran muchas acciones."
              />
            )}
            {typeof e.deuda === 'number' && (
              <Indicador
                nombre={experto ? 'Deuda / fondos propios' : 'Deuda'}
                valor={`${numero(e.deuda, 2)} veces`}
                explicacion="Cuántos dólares debe por cada dólar propio. Por debajo de 1 debe menos de lo que tiene; los bancos siempre salen altos."
              />
            )}
            {typeof e.beta === 'number' && (
              <Indicador
                nombre={experto ? 'Beta' : 'Cuánto se mueve (beta)'}
                valor={numero(e.beta, 2)}
                explicacion="1 significa que sube y baja como la bolsa en general; más de 1, que sus movimientos son más bruscos."
              />
            )}
            {experto && typeof e.perFuturo === 'number' && e.perFuturo > 0 && (
              <Indicador nombre="PER estimado" valor={numero(e.perFuturo, 1)} explicacion="El PER calculado con los beneficios que los analistas esperan para el próximo año." />
            )}
            {typeof e.rentAño === 'number' && (
              <Indicador
                nombre="Precio en lo que va de año"
                valor={<span className={e.rentAño >= 0 ? 'sube' : 'baja'}>{pctSigno(e.rentAño, 1)}</span>}
                explicacion="Cuánto ha cambiado el precio de la acción desde el 1 de enero, sin contar dividendos."
              />
            )}
          </div>
          <p className="tenue pequeño fuente">Fuente: Finnhub{datos?.actualizado ? `, datos del ${fechaCorta(datos.actualizado)}` : ''}.</p>
        </section>
      </div>

      <AlertasEmpresa e={e} />

      <FondosQueLaLlevan nombre={e.n} carteras={carteras} fondos={fondos} />
    </div>
  );
}
