// Armazón de la app: barra superior, cinta de mercados, menú lateral y la pantalla que toque.
// La pantalla se decide por la dirección: "#/" es el mapa y "#/pais/ESP" es la ficha de España.

import { useEffect, useMemo, useState } from 'react';
import type { ClaveCapa } from './capas';
import { type Datos, cargarDatos, fechaCorta, paisesConDatos, pctSigno } from './datos';
import { BotonCuenta, PanelAvisos } from './Cuenta';
import { useLista } from './empresas';
import { FichaEmpresa } from './FichaEmpresa';
import { FichaFondo } from './FichaFondo';
import { FichaPais } from './FichaPais';
import { PantallaEmpresas } from './PantallaEmpresas';
import { PantallaFondos } from './PantallaFondos';
import { PantallaMapa } from './PantallaMapa';

function recordar(clave: string, porDefecto: string): string {
  try {
    return localStorage.getItem(clave) ?? porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* si el navegador no deja guardar, simplemente no se recuerda */
  }
}

function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const alCambiar = () => {
      setRuta(window.location.hash.replace(/^#/, '') || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

const PROXIMAS = [
  ['Sectores', 'Fase 4'],
  ['Radar de emergentes', 'Fase 5'],
];

export function App() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [experto, setExperto] = useState(() => recordar('atlas-modo', 'sencillo') === 'experto');
  const [capa, setCapa] = useState<ClaveCapa | null>(null);
  const [seleccion, setSeleccion] = useState(() => recordar('atlas-pais', 'ESP'));
  const [busqueda, setBusqueda] = useState('');
  const ruta = useRuta();
  const miLista = useLista();

  useEffect(() => {
    cargarDatos()
      .then(setDatos)
      .catch((e: Error) => setError(e.message));
  }, []);

  const cambiarModo = (x: boolean) => {
    setExperto(x);
    guardar('atlas-modo', x ? 'experto' : 'sencillo');
  };
  const seleccionar = (iso3: string) => {
    setSeleccion(iso3);
    guardar('atlas-pais', iso3);
  };

  const nombres = useMemo(() => (datos ? paisesConDatos(datos) : []), [datos]);

  const buscar = (texto: string) => {
    setBusqueda(texto);
    const limpio = texto.trim().toLocaleLowerCase('es');
    const encontrado = nombres.find((p) => p.nombre.toLocaleLowerCase('es') === limpio);
    if (encontrado) {
      seleccionar(encontrado.iso3);
      window.location.hash = `#/pais/${encontrado.iso3}`;
      setBusqueda('');
    }
  };

  const enFicha = ruta.startsWith('/pais/');
  const isoFicha = enFicha ? ruta.split('/')[2]?.toUpperCase() : null;
  const enFondos = ruta === '/fondos' || ruta.startsWith('/fondo/');
  const isinFondo = ruta.startsWith('/fondo/') ? ruta.split('/')[2]?.toUpperCase() : null;
  const enEmpresas = ruta === '/empresas' || ruta.startsWith('/empresa/');
  // La ficha de empresa va por símbolo (#/empresa/AAPL) o, si Atlas no tiene su precio, por nombre (#/empresa/~Nombre).
  let claveEmpresa: string | null = null;
  if (ruta.startsWith('/empresa/')) {
    try {
      claveEmpresa = decodeURIComponent(ruta.slice('/empresa/'.length));
    } catch {
      claveEmpresa = ruta.slice('/empresa/'.length);
    }
  }
  const enLista = ruta === '/lista';
  const sinDatosGenerales = enFondos || enEmpresas || enLista; // estas pantallas cargan sus propios datos
  const enMapa = !enFicha && !sinDatosGenerales;
  const hayBolsa = !!datos && Object.keys(datos.bolsas).length > 0;
  // Si hay datos de bolsa, el mapa arranca con esa capa; si no, con el crecimiento del PIB.
  const capaActiva: ClaveCapa = capa ?? (hayBolsa ? 'bolsa' : 'crecimiento');

  const cinta = datos
    ? [
        ...(['USA', 'ESP', 'DEU', 'JPN', 'CHN'] as const).map((k) => [datos.paises[k]?.nombre ?? k, datos.bolsas[k]] as const),
        ...Object.values(datos.bolsasExtra).map((b) => [b.nombre, b] as const),
      ].filter(([, b]) => b)
    : [];

  return (
    <div className="app">
      <header className="barra">
        <a href="#/" className="logo" aria-label="Atlas, ir al mapa">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7DB5FF" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
          </svg>
          <span>Atlas</span>
        </a>
        <label htmlFor="buscador" className="oculto">
          Buscar un país
        </label>
        <input
          id="buscador"
          className="buscador"
          type="search"
          list="lista-paises"
          placeholder="Busca un país: España, Japón, Brasil…"
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          autoComplete="off"
        />
        <datalist id="lista-paises">
          {nombres.map((p) => (
            <option key={p.iso3} value={p.nombre} />
          ))}
        </datalist>
        <div className="modo" role="group" aria-label="Nivel de explicación">
          <button type="button" className={!experto ? 'activo' : ''} aria-pressed={!experto} onClick={() => cambiarModo(false)}>
            Modo sencillo
          </button>
          <button type="button" className={experto ? 'activo' : ''} aria-pressed={experto} onClick={() => cambiarModo(true)}>
            Modo experto
          </button>
        </div>
        <BotonCuenta />
        <span className="actualizado">
          <i />
          {datos ? `Datos del ${fechaCorta(datos.actualizado)}` : 'Cargando…'}
        </span>
      </header>

      {cinta.length > 0 && (
        <div className="cinta" aria-label="Mercados hoy">
          {cinta.map(([nombre, b]) => (
            <span key={nombre} className="cinta-item" title={experto ? `${b.nombre} (${b.simbolo})` : undefined}>
              <span className="tenue">{experto ? b.simbolo : nombre}</span>
              <strong>{b.cierre.toFixed(2).replace('.', ',')}</strong>
              <span className={b.cambioPct >= 0 ? 'sube' : 'baja'}>{pctSigno(b.cambioPct)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="cuerpo">
        <nav className="menu" aria-label="Secciones">
          <a href="#/" className={enMapa ? 'activo' : ''} aria-current={enMapa ? 'page' : undefined}>
            Mapa del mundo
          </a>
          <a href={`#/pais/${seleccion}`} className={enFicha ? 'activo' : ''} aria-current={enFicha ? 'page' : undefined}>
            Países
          </a>
          <a href="#/fondos" className={enFondos ? 'activo' : ''} aria-current={enFondos ? 'page' : undefined}>
            Fondos y ETFs
          </a>
          <a href="#/empresas" className={enEmpresas ? 'activo' : ''} aria-current={enEmpresas ? 'page' : undefined}>
            Empresas
          </a>
          <a href="#/lista" className={enLista ? 'activo' : ''} aria-current={enLista ? 'page' : undefined}>
            Mi lista
            {miLista.length > 0 && <small> · {miLista.length}</small>}
          </a>
          {PROXIMAS.map(([nombre, fase]) => (
            <span key={nombre} className="menu-proximo" aria-disabled="true">
              {nombre}
              <small>{fase}</small>
            </span>
          ))}
        </nav>

        <main className="principal">
          {error && (
            <section className="panel">
              <h1>No se han podido cargar los datos</h1>
              <p>{error}</p>
            </section>
          )}
          {!datos && !error && !sinDatosGenerales && <section className="panel tenue">Cargando datos…</section>}
          {datos && enFicha && isoFicha && <FichaPais datos={datos} iso3={isoFicha} experto={experto} />}
          {enFondos && !error && (isinFondo ? <FichaFondo isin={isinFondo} experto={experto} /> : <PantallaFondos experto={experto} />)}
          {enEmpresas && !error && (claveEmpresa ? <FichaEmpresa clave={claveEmpresa} experto={experto} /> : <PantallaEmpresas experto={experto} soloLista={false} />)}
          {enLista && !error && <PanelAvisos />}
          {enLista && !error && <PantallaEmpresas experto={experto} soloLista />}
          {datos && enMapa && (
            <PantallaMapa
              datos={datos}
              experto={experto}
              capa={capaActiva}
              alCambiarCapa={setCapa}
              seleccion={seleccion}
              alSeleccionar={seleccionar}
            />
          )}
        </main>
      </div>
    </div>
  );
}
