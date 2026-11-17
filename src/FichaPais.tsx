// PANTALLA 2: ficha de país. Es la misma plantilla para todos los países;
// solo cambian los datos que se le pasan.

import { useMemo } from 'react';
import { AZUL, NARANJA } from './capas';
import { type ClaveDato, type Datos, type Pais, PRODUCTOS, dinero, fechaCorta, nombreProducto, paisesConDatos, pct, pctSigno } from './datos';
import { EMPRESAS } from './editorial';
import { resumen } from './textos';

interface Props {
  datos: Datos;
  iso3: string;
  experto: boolean;
}

const CIFRAS: { clave: ClaveDato; sencillo: string; experto: string; ayuda: string; formato: (v: number, x: boolean) => string }[] = [
  { clave: 'pib', sencillo: 'Tamaño de la economía', experto: 'PIB (USD corrientes)', ayuda: 'Todo lo que produce el país en un año.', formato: (v, x) => dinero(v, x) },
  { clave: 'crecimiento', sencillo: 'Crecimiento', experto: 'Crecimiento real del PIB', ayuda: 'Cuánto ha crecido su economía en un año.', formato: (v, x) => pctSigno(v, x ? 2 : 1) },
  { clave: 'inflacion', sencillo: 'Subida de precios', experto: 'Inflación (IPC)', ayuda: 'Cuánto se ha encarecido la vida en un año.', formato: (v, x) => pct(v, x ? 2 : 1) },
  { clave: 'paro', sencillo: 'Paro', experto: 'Tasa de paro', ayuda: 'De cada 100 personas que quieren trabajar, cuántas no encuentran empleo.', formato: (v, x) => pct(v, x ? 2 : 1) },
];

export function FichaPais({ datos, iso3, experto }: Props) {
  const pais: Pais | undefined = datos.paises[iso3];
  const opciones = useMemo(() => paisesConDatos(datos), [datos]);

  if (!pais) {
    return (
      <section className="panel">
        <h1>País no encontrado</h1>
        <p>
          <a href="#/">Volver al mapa</a>
        </p>
      </section>
    );
  }

  const comercio = datos.comercio[iso3];
  const empresas = EMPRESAS[iso3];
  const frases = resumen(datos, pais, experto);
  const serie = pais.serie.slice(-10);
  const maximo = Math.max(1, ...serie.map((s) => Math.abs(s.v)));
  const contexto = [pais.region, pais.ingreso, pais.rangoPib ? `Economía n.º ${pais.rangoPib} del mundo` : null, pais.capital ? `Capital: ${pais.capital}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="ficha">
      <header className="ficha-cabecera">
        <div>
          <div className="ficha-selector">
            <a href="#/" className="volver">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Volver al mapa
            </a>
            <label htmlFor="pais-ficha" className="tenue pequeño">
              Ver ficha de:
            </label>
            <select id="pais-ficha" value={iso3} onChange={(e) => (window.location.hash = `#/pais/${e.target.value}`)}>
              {opciones.map((p) => (
                <option key={p.iso3} value={p.iso3}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="tenue pequeño">{contexto || 'Sin clasificación del Banco Mundial'}</div>
          <h1 className="ficha-nombre">{pais.nombre}</h1>
        </div>
        <div className="cifras">
          {CIFRAS.map((c) => {
            const dato = pais.d[c.clave];
            return (
              <div key={c.clave} className="cifra">
                <div className="cifra-rotulo">{experto ? c.experto : c.sencillo}</div>
                <div className="cifra-valor">{dato ? c.formato(dato.v, experto) : '—'}</div>
                <div className="cifra-pie">
                  {dato ? (experto ? `${datos.indicadores[c.clave] ?? ''} · ${dato.a}` : `${c.ayuda} Dato de ${dato.a}.`) : 'Sin datos publicados.'}
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <section className="panel">
        <h2>{pais.nombre} en 30 segundos</h2>
        {frases.length ? (
          <p className="resumen">{frases.join(' ')}</p>
        ) : (
          <p className="tenue">No hay datos suficientes para resumir este país.</p>
        )}
        <p className="tenue pequeño">
          Resumen compuesto automáticamente con las cifras del Banco Mundial. Las secciones «depende de», «apuesta por»
          y «riesgos» del diseño necesitan análisis de noticias y llegarán en la fase 4.
        </p>
      </section>

      <div className="dos-columnas">
        <section className="panel">
          <h2>Qué vende al mundo</h2>
          <p className="tenue subtitulo">
            {comercio ? `Peso de cada tipo de producto en sus exportaciones de mercancías (${comercio.a})` : 'Sin datos de comercio para este país'}
          </p>
          {comercio && (
            <>
              <div className="barras">
                {comercio.productos
                  .filter((x) => x.v > 0)
                  .slice(0, 7)
                  .map((x) => {
                    const peso = (x.v / comercio.total) * 100;
                    const mayor = (comercio.productos[0].v / comercio.total) * 100;
                    return (
                      <div key={x.id}>
                        <div className="barra-texto">
                          <span>
                            {nombreProducto(x.id)}
                            {!experto && PRODUCTOS[x.id] && <span className="tenue"> · {PRODUCTOS[x.id].ejemplos}</span>}
                          </span>
                          <span className="tenue">{experto ? `${pct(peso, 1)} · ${dinero(x.v, true)}` : pct(peso, 0)}</span>
                        </div>
                        <div className="barra-fondo">
                          <div className="barra-relleno" style={{ width: `${(peso / mayor) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <p className="tenue pequeño">
                Solo mercancías: los servicios, como el turismo o la banca, no están incluidos en esta fuente.
              </p>
            </>
          )}
        </section>

        <section className="panel">
          <h2>A quién le vende</h2>
          <p className="tenue subtitulo">{comercio?.socios.length ? `Principales clientes de sus mercancías (${comercio.a})` : 'Sin datos de socios comerciales'}</p>
          <div className="socios">
            {comercio?.socios.slice(0, 6).map((s) => {
              const socio = datos.paises[s.iso3];
              if (!socio) return null;
              const peso = (s.v / comercio.total) * 100;
              return (
                <a key={s.iso3} className="socio" href={`#/pais/${s.iso3}`}>
                  <span className="socio-codigo">{socio.iso2 ?? s.iso3}</span>
                  <span className="socio-nombre">{socio.nombre}</span>
                  <span className="tenue">{experto ? `${pct(peso, 1)} · ${dinero(s.v, true)}` : `${pct(peso, 0)} de lo que exporta`}</span>
                </a>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Empresas clave</h2>
        {empresas ? (
          <>
            <p className="tenue subtitulo">Selección editorial: una lista escrita a mano, no calculada con datos</p>
            <div className="empresas">
              {empresas.map(([nombre, sector]) => (
                <div key={nombre} className="empresa">
                  <div className="empresa-sector">{sector}</div>
                  <div className="empresa-nombre">{nombre}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="tenue">Las empresas de este país llegarán en la fase 3, con los datos de empresas.</p>
        )}
      </section>

      <section className="panel">
        <h2>Evolución</h2>
        <p className="tenue subtitulo">
          {experto ? 'Crecimiento real del PIB, % anual' : 'Cuánto ha crecido su economía cada año'} ·{' '}
          <span style={{ color: '#7DB5FF' }}>azul = crece</span> · <span style={{ color: '#F5A55C' }}>naranja = se encoge</span>
        </p>
        {serie.length ? (
          <div className="grafico" role="img" aria-label={`Crecimiento anual del PIB de ${pais.nombre}: ${serie.map((s) => `${s.a}, ${pctSigno(s.v)}`).join('; ')}`}>
            {serie.map((s) => (
              <div key={s.a} className="grafico-columna">
                <span className="grafico-valor">{pctSigno(s.v, experto ? 2 : 1).replace(' %', '')}</span>
                <div
                  className="grafico-barra"
                  style={{ height: `${Math.max(2, (Math.abs(s.v) / maximo) * 100)}%`, background: s.v < 0 ? NARANJA : AZUL }}
                />
                <span className="grafico-año">{s.a}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="tenue">Sin serie histórica publicada.</p>
        )}
        <p className="tenue pequeño">
          La explicación de qué pasó cada año llegará en la fase 4. Datos: Banco Mundial y WITS · actualizados el{' '}
          {fechaCorta(datos.actualizado)}.
        </p>
      </section>
    </div>
  );
}
