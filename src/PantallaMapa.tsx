// PANTALLA 1: mapa mundial con selector de métrica y panel del país elegido.

import { useMemo } from 'react';
import { CAPAS, type Capa, type ClaveCapa, SIN_DATOS, colorDe, tramoDe } from './capas';
import { type Datos, type Pais, dinero, fechaCorta, paisesConDatos, pct, pctSigno } from './datos';
import { EMPRESAS } from './editorial';
import { FORMAS, type Forma, Mapa, formaDeNum } from './Mapa';
import { deQueVive, paisDeForma } from './textos';

interface Props {
  datos: Datos;
  experto: boolean;
  capa: ClaveCapa;
  alCambiarCapa: (c: ClaveCapa) => void;
  seleccion: string;
  alSeleccionar: (iso3: string) => void;
}

export function PantallaMapa({ datos, experto, capa: claveCapa, alCambiarCapa, seleccion, alSeleccionar }: Props) {
  const hayBolsa = Object.keys(datos.bolsas).length > 0;
  const capa = CAPAS.find((c) => c.clave === claveCapa) ?? CAPAS[1];

  // Color de cada forma del mapa según la métrica elegida.
  const rellenos = useMemo(() => {
    const r: Record<string, string> = {};
    for (const f of FORMAS) {
      const p = paisDeForma(datos, f.num, f.nombreIngles);
      r[f.clave] = p ? colorDe(capa, capa.valor(datos, p.iso3)) : SIN_DATOS;
    }
    return r;
  }, [datos, capa]);

  const pais = datos.paises[seleccion] ?? null;
  const formaSel = pais ? formaDeNum(pais.num) : null;

  const etiqueta = (f: Forma) => {
    const p = paisDeForma(datos, f.num, f.nombreIngles);
    if (!p) return { nombre: f.nombreIngles, dato: 'Sin datos' };
    const v = capa.valor(datos, p.iso3);
    const año = capa.año(datos, p.iso3);
    return {
      nombre: p.nombre,
      dato: v === null ? 'Sin datos para esta métrica' : `${capa.formato(v, experto)}${año ? ` · ${año}` : ''}`,
    };
  };

  const opciones = useMemo(() => paisesConDatos(datos), [datos]);

  return (
    <section className="panel">
      <div className="cabecera-seccion">
        <div>
          <h1>¿Dónde se mueve la economía?</h1>
          <p className="tenue">
            {experto
              ? `${capa.titulo(true)}. Selecciona un país para ver sus indicadores.`
              : 'Toca un país para ver de qué vive y cómo le va, explicado sin jerga.'}
          </p>
        </div>
        <div className="grupo-botones" role="group" aria-label="Qué mostrar en el mapa">
          {CAPAS.map((c) => (
            <button
              key={c.clave}
              type="button"
              className={`boton-capa${c.clave === capa.clave ? ' activo' : ''}`}
              aria-pressed={c.clave === capa.clave}
              onClick={() => alCambiarCapa(c.clave)}
            >
              {c.boton}
            </button>
          ))}
        </div>
      </div>

      <div className="mapa-y-panel">
        <div className="mapa-columna">
          <Mapa
            rellenos={rellenos}
            seleccion={formaSel?.clave ?? null}
            etiqueta={etiqueta}
            alElegir={(f) => {
              const p = paisDeForma(datos, f.num, f.nombreIngles);
              if (p) alSeleccionar(p.iso3);
            }}
          />

          {capa.clave === 'bolsa' && !hayBolsa && (
            <p className="aviso">
              La capa de bolsa todavía no está activada: falta la clave gratuita de Finnhub. Las instrucciones están en
              el archivo LEEME.md. Las otras tres capas ya funcionan con datos reales.
            </p>
          )}

          <div className="bajo-mapa">
            <label htmlFor="pais-mapa" className="tenue pequeño">
              O busca un país:
            </label>
            <select id="pais-mapa" value={seleccion} onChange={(e) => alSeleccionar(e.target.value)}>
              {opciones.map((p) => (
                <option key={p.iso3} value={p.iso3}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <span className="tenue pequeño">Rueda del ratón o botones para acercar · arrastra para moverte</span>
          </div>

          <div className="leyenda">
            <span>{capa.leyenda}</span>
            {[...capa.tramos].reverse().map((t) => (
              <span key={t.texto} className="leyenda-item">
                <i style={{ background: t.color }} />
                {t.texto}
              </span>
            ))}
            <span className="leyenda-item">
              <i style={{ background: SIN_DATOS, outline: '1px solid #2E3742' }} />
              sin datos
            </span>
          </div>
          <p className="tenue pequeño fuente">
            {capa.clave === 'bolsa'
              ? `Fuente: Finnhub. Se mide con el fondo cotizado (ETF) que replica la bolsa de cada país; cotiza en dólares en EE. UU., así que incluye el efecto del cambio de moneda.${datos.bolsasActualizado ? ` Datos del ${fechaCorta(datos.bolsasActualizado)}.` : ''}`
              : 'Fuente: Banco Mundial. Son datos anuales: cada país muestra su último año publicado.'}
          </p>
        </div>

        {pais && <PanelPais datos={datos} pais={pais} capa={capa} experto={experto} />}
      </div>
    </section>
  );
}

function PanelPais({ datos, pais, capa, experto }: { datos: Datos; pais: Pais; capa: Capa; experto: boolean }) {
  const v = capa.valor(datos, pais.iso3);
  const tramo = tramoDe(capa, v);
  const bolsa = datos.bolsas[pais.iso3];
  const vive = deQueVive(datos, pais, experto);
  const empresas = EMPRESAS[pais.iso3];
  const { pib, crecimiento, inflacion, paro } = pais.d;

  return (
    <aside className="panel-pais" aria-live="polite">
      <div className="panel-pais-titulo">
        <h2>{pais.nombre}</h2>
        <span
          className="chip-valor"
          style={{ background: tramo?.color ?? '#2A313B', color: tramo?.claro ? '#0E1116' : '#E6EDF3' }}
        >
          {v === null ? 's/d' : capa.formato(v, experto)}
        </span>
      </div>

      <div>
        <div className="rotulo">Por qué se mueve hoy</div>
        {bolsa ? (
          <p>
            {experto
              ? `${bolsa.nombre} (${bolsa.simbolo}): ${pctSigno(bolsa.cambioPct, 2)}, cierre ${bolsa.cierre.toFixed(2).replace('.', ',')} USD.`
              : `Su bolsa ${bolsa.cambioPct > 0.05 ? 'sube' : bolsa.cambioPct < -0.05 ? 'baja' : 'está plana'} hoy: ${pctSigno(bolsa.cambioPct)}.`}
          </p>
        ) : (
          <p className="tenue">
            {Object.keys(datos.bolsas).length
              ? 'No seguimos la bolsa de este país (no tiene un fondo cotizado propio).'
              : 'Bolsa sin activar todavía.'}
          </p>
        )}
        <p className="tenue pequeño">
          La explicación de las causas llegará en la fase 4, cuando Atlas lea las noticias del día. Hasta entonces no
          se muestra ninguna explicación inventada.
        </p>
      </div>

      <div>
        <div className="rotulo">De qué vive</div>
        <p>{vive ?? <span className="tenue">Sin datos de comercio para este país.</span>}</p>
      </div>

      <div>
        <div className="rotulo">Empresas clave</div>
        {empresas ? (
          <>
            <div className="chips">
              {empresas.map(([nombre, sector]) => (
                <span key={nombre} className="chip" title={sector}>
                  {nombre}
                </span>
              ))}
            </div>
            <p className="tenue pequeño">Selección editorial, no calculada con datos.</p>
          </>
        ) : (
          <p className="tenue pequeño">Llegarán en la fase 3, con los datos de empresas.</p>
        )}
      </div>

      <dl className="mini-cifras">
        <div>
          <dt>{experto ? 'PIB' : 'Tamaño'}</dt>
          <dd>{pib ? dinero(pib.v, experto) : '—'}</dd>
        </div>
        <div>
          <dt>Crecimiento</dt>
          <dd>{crecimiento ? pctSigno(crecimiento.v) : '—'}</dd>
        </div>
        <div>
          <dt>{experto ? 'Inflación' : 'Precios'}</dt>
          <dd>{inflacion ? pct(inflacion.v) : '—'}</dd>
        </div>
        <div>
          <dt>Paro</dt>
          <dd>{paro ? pct(paro.v) : '—'}</dd>
        </div>
      </dl>

      <a className="boton-principal" href={`#/pais/${pais.iso3}`}>
        Abrir ficha completa
      </a>
    </aside>
  );
}
