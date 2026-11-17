// CUENTA Y ALERTAS: botón «Entrar» de la barra superior, panel de avisos de «Mi lista»
// y formulario para crear alertas en la ficha de cada empresa.

import { type FormEvent, useEffect, useState } from 'react';
import { numero } from './datos';
import { type DatosEmpresas, type EmpresaBolsa, cargarEmpresas } from './empresas';
import {
  type Alerta,
  type TipoAlerta,
  borrarAlerta,
  comprobarAlertas,
  crearAlerta,
  enlaceCaducado,
  hayNube,
  marcarAvisosVistos,
  pedirEnlace,
  salir,
  useAlertas,
  useSesion,
} from './nube';

const dolares = (v: number) => `${numero(v, 2)} $`;
const dia = (f: string) => new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/** La condición de la alerta, en una frase. */
function condicion(a: Alerta): string {
  if (a.tipo === 'baja_de') return `Si baja de ${dolares(a.valor ?? 0)}`;
  if (a.tipo === 'sube_de') return `Si sube de ${dolares(a.valor ?? 0)}`;
  if (a.tipo === 'mov_dia') return `Si sube o baja más de un ${numero(a.valor ?? 0, 1)} % en un día`;
  return 'Si se acerca a su precio más bajo del último año';
}

/** Lo que pasó cuando saltó la alerta, en una frase. */
function textoAviso(a: Alerta, nombre: string): string {
  const precio = a.aviso_precio !== null ? dolares(a.aviso_precio) : '—';
  if (a.tipo === 'baja_de') return `${nombre} ha bajado de ${dolares(a.valor ?? 0)}: cerró a ${precio}.`;
  if (a.tipo === 'sube_de') return `${nombre} ha subido de ${dolares(a.valor ?? 0)}: cerró a ${precio}.`;
  if (a.tipo === 'mov_dia') {
    const c = a.aviso_cambio ?? 0;
    return `${nombre} ${c >= 0 ? 'subió' : 'bajó'} un ${numero(Math.abs(c), 1)} % en un solo día y cerró a ${precio}.`;
  }
  return `${nombre} está cerca de su precio más bajo del último año: cerró a ${precio}.`;
}

// ───────────── Barra superior ─────────────

export function BotonCuenta() {
  const sesion = useSesion();
  const alertas = useAlertas();
  const [abierto, setAbierto] = useState(enlaceCaducado);
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState<'reposo' | 'enviando' | 'enviado'>('reposo');
  const [error, setError] = useState<string | null>(null);

  // Con la cuenta abierta, al entrar en la app se comparan las alertas con los precios del día.
  const usuario = sesion?.user.id;
  useEffect(() => {
    if (usuario) void cargarEmpresas().then((d) => d && comprobarAlertas(d));
  }, [usuario]);
  useEffect(() => {
    if (usuario) setAbierto(false);
  }, [usuario]);

  if (!hayNube) return null;

  const nuevos = alertas.filter((a) => a.aviso_fecha && !a.aviso_visto).length;
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEstado('enviando');
    setError(null);
    const fallo = await pedirEnlace(correo.trim());
    setError(fallo);
    setEstado(fallo ? 'reposo' : 'enviado');
  };

  return (
    <div className="sesion">
      {sesion && (
        <a href="#/lista" className="campana" aria-label={nuevos ? `Avisos: ${nuevos} sin ver` : 'Avisos: ninguno nuevo'} title="Avisos de tus alertas">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" strokeLinejoin="round" />
          </svg>
          {nuevos > 0 && <b>{nuevos}</b>}
        </a>
      )}
      <button type="button" className="boton-capa" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
        {sesion ? 'Mi cuenta' : 'Entrar'}
      </button>
      {abierto && (
        <div className="sesion-panel">
          {sesion ? (
            <>
              <p>
                Has entrado como <strong>{sesion.user.email}</strong>.
              </p>
              <p className="tenue pequeño">Tu lista y tus alertas se guardan en tu cuenta y se ven en todos tus dispositivos.</p>
              <button type="button" className="boton-capa" onClick={() => void salir()}>
                Salir de la cuenta
              </button>
            </>
          ) : estado === 'enviado' ? (
            <>
              <p>
                Te hemos enviado un enlace a <strong>{correo.trim()}</strong>.
              </p>
              <p className="tenue pequeño">
                Abre ese correo en este mismo dispositivo y pulsa el enlace para entrar. Puede tardar un minuto; si no
                lo ves, mira en la carpeta de correo no deseado.
              </p>
            </>
          ) : (
            <form onSubmit={enviar}>
              {enlaceCaducado && <p className="aviso">Ese enlace había caducado o ya se había usado. Pide uno nuevo.</p>}
              <p>Entra para ver tu lista en todos tus dispositivos y crear alertas.</p>
              <p className="tenue pequeño">Sin contraseña: escribe tu correo y te enviamos un enlace para entrar.</p>
              <label htmlFor="correo-cuenta" className="oculto">
                Tu correo
              </label>
              <input
                id="correo-cuenta"
                className="campo"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              {error && <p className="aviso">{error}</p>}
              <button type="submit" className="boton-capa activo" disabled={estado === 'enviando'}>
                {estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────── Panel de avisos (pantalla «Mi lista») ─────────────

export function PanelAvisos() {
  const sesion = useSesion();
  const alertas = useAlertas();
  const [datos, setDatos] = useState<DatosEmpresas | null>(null);
  useEffect(() => {
    void cargarEmpresas().then(setDatos);
  }, []);

  if (!hayNube) return null;
  if (!sesion) {
    return (
      <section className="panel">
        <h2>Avisos y alertas</h2>
        <p className="tenue">
          Pulsa «Entrar», arriba, para ver esta lista en todos tus dispositivos y crear alertas (por ejemplo, «avísame si
          Apple baja de 200 $»). Sin cuenta, la lista se guarda solo en este dispositivo.
        </p>
      </section>
    );
  }

  const nombre = (s: string) => datos?.porSimbolo.get(s)?.n ?? s;
  const avisos = alertas.filter((a) => a.aviso_fecha).sort((a, b) => b.aviso_fecha!.localeCompare(a.aviso_fecha!));
  const hayNuevos = avisos.some((a) => !a.aviso_visto);

  return (
    <section className="panel">
      <h2>Avisos</h2>
      <p className="tenue subtitulo">Lo que ha pasado con tus alertas. Se comprueban una vez al día, con el precio de cierre.</p>
      {avisos.length === 0 ? (
        <p className="tenue">{alertas.length ? 'Ninguna de tus alertas ha saltado todavía.' : 'Todavía no tienes alertas.'}</p>
      ) : (
        <ul className="avisos">
          {avisos.map((a) => (
            <li key={a.id} className={a.aviso_visto ? '' : 'nuevo'}>
              <span>
                {!a.aviso_visto && <b className="etiqueta-nuevo">Nuevo</b>}
                <a href={`#/empresa/${a.simbolo}`}>{textoAviso(a, nombre(a.simbolo))}</a>
              </span>
              <span className="tenue pequeño">{dia(a.aviso_fecha!)}</span>
            </li>
          ))}
        </ul>
      )}
      {hayNuevos && (
        <button type="button" className="boton-capa" onClick={() => void marcarAvisosVistos()}>
          Marcar como vistos
        </button>
      )}

      <h2 className="con-margen">Mis alertas{alertas.length ? ` · ${alertas.length}` : ''}</h2>
      {alertas.length === 0 ? (
        <p className="tenue">
          Para crear una, abre la ficha de cualquier empresa y baja hasta «Alertas».
        </p>
      ) : (
        <ul className="avisos">
          {alertas.map((a) => (
            <li key={a.id}>
              <span>
                <a href={`#/empresa/${a.simbolo}`}>{nombre(a.simbolo)}</a>
                <span className="tenue"> · {condicion(a)}</span>
              </span>
              <button type="button" className="boton-capa" aria-label={`Borrar la alerta de ${nombre(a.simbolo)}: ${condicion(a)}`} onClick={() => void borrarAlerta(a.id)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────── Alertas de una empresa (ficha de empresa) ─────────────

export function AlertasEmpresa({ e }: { e: EmpresaBolsa }) {
  const sesion = useSesion();
  const alertas = useAlertas().filter((a) => a.simbolo === e.t);
  const [tipo, setTipo] = useState<TipoAlerta>('baja_de');
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Valor propuesto: un 10 % por debajo o por encima del precio de hoy, o un 5 % de movimiento.
  const propuesto = tipo === 'baja_de' ? (e.precio ?? 0) * 0.9 : tipo === 'sube_de' ? (e.precio ?? 0) * 1.1 : 5;
  useEffect(() => {
    setValor(tipo === 'cerca_min' ? '' : String(tipo === 'mov_dia' ? propuesto : Math.round(propuesto)));
    setError(null);
  }, [tipo, e.t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hayNube || !e.precio) return null;

  const crear = async (ev: FormEvent) => {
    ev.preventDefault();
    const n = Number(valor.replace(',', '.'));
    if (tipo !== 'cerca_min' && !(n > 0)) {
      setError('Escribe un número mayor que cero.');
      return;
    }
    setGuardando(true);
    setError(await crearAlerta(e.t, tipo, tipo === 'cerca_min' ? null : n));
    setGuardando(false);
  };

  return (
    <section className="panel">
      <h2>Alertas</h2>
      <p className="tenue subtitulo">
        Atlas te avisa dentro de la app cuando pase lo que elijas. Se comprueba una vez al día, con el precio de cierre.
      </p>
      {!sesion ? (
        <p className="tenue">Pulsa «Entrar», arriba, para crear alertas de esta empresa.</p>
      ) : (
        <>
          <form className="filtros alerta-nueva" onSubmit={crear}>
            <label>
              <span className="tenue pequeño">Avísame…</span>
              <select value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoAlerta)}>
                <option value="baja_de">Si el precio baja de…</option>
                <option value="sube_de">Si el precio sube de…</option>
                <option value="mov_dia">Si sube o baja mucho en un día</option>
                <option value="cerca_min">Si se acerca a su mínimo del año</option>
              </select>
            </label>
            {tipo !== 'cerca_min' && (
              <label>
                <span className="tenue pequeño">{tipo === 'mov_dia' ? 'Más de este % en un día' : `Precio en $ (hoy: ${dolares(e.precio)})`}</span>
                <input className="campo" inputMode="decimal" value={valor} onChange={(ev) => setValor(ev.target.value)} />
              </label>
            )}
            <label>
              <span className="tenue pequeño">&nbsp;</span>
              <button type="submit" className="boton-capa activo" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Crear alerta'}
              </button>
            </label>
          </form>
          {error && <p className="aviso">{error}</p>}
          {alertas.length > 0 && (
            <ul className="avisos">
              {alertas.map((a) => (
                <li key={a.id}>
                  <span>{condicion(a)}</span>
                  <button type="button" className="boton-capa" aria-label={`Borrar la alerta: ${condicion(a)}`} onClick={() => void borrarAlerta(a.id)}>
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
