// La nube de Atlas (fase 3, parte B): cuenta por correo, «Mi lista» sincronizada y alertas.
// Todo se guarda en Supabase. Si nube-config.ts está vacío, nada de esto se activa.

import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { type DatosEmpresas, type EmpresaBolsa, escribirLista, ganchosLista, leerLista } from './empresas';
import { NUBE_CLAVE_PUBLICA, NUBE_URL } from './nube-config';

// Si el enlace del correo ha caducado, Supabase vuelve a Atlas con el error en la dirección.
const hashInicial = window.location.hash;
export const enlaceCaducado = hashInicial.startsWith('#error') && hashInicial.includes('otp_expired');
if (hashInicial.startsWith('#error')) window.history.replaceState(null, '', window.location.pathname + window.location.search);

const nube: SupabaseClient | null = NUBE_URL && NUBE_CLAVE_PUBLICA ? createClient(NUBE_URL, NUBE_CLAVE_PUBLICA) : null;

/** ¿Está configurada la nube? Si no, no se enseña nada de cuentas ni alertas. */
export const hayNube = nube !== null;

// ───────────── Sesión ─────────────

let sesion: Session | null = null;
const oyentesSesion = new Set<() => void>();

const CLAVE_FUSION = 'atlas-lista-cuenta';
const recordar = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const guardar = (clave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* sin permiso para guardar: no pasa nada */
  }
};

let ultimoUsuario: string | null = null;

nube?.auth.onAuthStateChange((evento, nueva) => {
  sesion = nueva;
  oyentesSesion.forEach((f) => f());
  const usuario = nueva?.user.id ?? null;
  if (evento === 'SIGNED_OUT') {
    guardar(CLAVE_FUSION, null);
    ponerAlertas([]);
  }
  // Solo se sincroniza al abrir la app o al cambiar de cuenta, no cada vez que se renueva la sesión.
  if (usuario && usuario !== ultimoUsuario) {
    // Dentro de este aviso no se puede llamar a Supabase directamente: se deja para justo después.
    setTimeout(() => {
      void sincronizarLista(usuario);
      void cargarAlertas();
    }, 0);
  }
  ultimoUsuario = usuario;
});

/** La sesión abierta, o null. El componente se repinta al entrar o salir. */
export function useSesion(): Session | null {
  const [, repintar] = useState(0);
  useEffect(() => {
    const f = () => repintar((n) => n + 1);
    oyentesSesion.add(f);
    return () => void oyentesSesion.delete(f);
  }, []);
  return sesion;
}

/** Envía al correo un enlace para entrar. Devuelve un mensaje de error, o null si ha ido bien. */
export async function pedirEnlace(correo: string): Promise<string | null> {
  if (!nube) return 'La nube no está configurada.';
  const { error } = await nube.auth.signInWithOtp({
    email: correo,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (!error) return null;
  if (error.status === 429) return 'Se han pedido demasiados enlaces seguidos. Espera unos minutos y vuelve a intentarlo.';
  return 'No se ha podido enviar el enlace. Comprueba el correo y vuelve a intentarlo.';
}

export async function salir() {
  await nube?.auth.signOut();
}

// ───────────── Mi lista en la nube ─────────────

async function sincronizarLista(usuario: string) {
  if (!nube) return;
  const { data, error } = await nube.from('lista').select('simbolo');
  if (error || !data) return;
  const enNube = data.map((f) => f.simbolo as string);
  if (recordar(CLAVE_FUSION) === usuario) {
    // Este dispositivo ya estaba unido a la cuenta: manda lo que hay en la nube.
    escribirLista(enNube);
    return;
  }
  // Primera vez con esta cuenta en este dispositivo: se junta lo de aquí con lo de la nube.
  const local = leerLista();
  const faltan = local.filter((s) => !enNube.includes(s));
  if (faltan.length) {
    const { error: e2 } = await nube.from('lista').upsert(
      faltan.map((simbolo) => ({ usuario, simbolo })),
      { onConflict: 'usuario,simbolo', ignoreDuplicates: true },
    );
    if (e2) return;
  }
  escribirLista([...new Set([...enNube, ...local])]);
  guardar(CLAVE_FUSION, usuario);
}

ganchosLista.alAlternar = (simbolo, dentro) => {
  if (!nube || !sesion) return;
  const usuario = sesion.user.id;
  if (dentro) void nube.from('lista').upsert({ usuario, simbolo }, { onConflict: 'usuario,simbolo', ignoreDuplicates: true }).then();
  else void nube.from('lista').delete().eq('simbolo', simbolo).then();
};

// ───────────── Alertas ─────────────

export type TipoAlerta = 'baja_de' | 'sube_de' | 'mov_dia' | 'cerca_min';

export interface Alerta {
  id: string;
  simbolo: string;
  tipo: TipoAlerta;
  valor: number | null;
  creada: string;
  /** fecha de los últimos datos con los que se comprobó */
  comprobada: string | null;
  /** si la condición se cumplía en esa comprobación */
  cumplida: boolean;
  aviso_fecha: string | null;
  aviso_precio: number | null;
  aviso_cambio: number | null;
  aviso_visto: boolean;
}

let alertas: Alerta[] = [];
const oyentesAlertas = new Set<() => void>();

function ponerAlertas(nuevas: Alerta[]) {
  alertas = nuevas;
  oyentesAlertas.forEach((f) => f());
}

export function useAlertas(): Alerta[] {
  const [, repintar] = useState(0);
  useEffect(() => {
    const f = () => repintar((n) => n + 1);
    oyentesAlertas.add(f);
    return () => void oyentesAlertas.delete(f);
  }, []);
  return alertas;
}

async function cargarAlertas() {
  if (!nube || !sesion) return;
  const { data, error } = await nube.from('alertas').select('*').order('creada', { ascending: false });
  if (error || !data) return;
  ponerAlertas(data.map((a) => ({ ...a, valor: a.valor === null ? null : Number(a.valor) })) as Alerta[]);
  if (datosParaComprobar) void comprobarAlertas(datosParaComprobar);
}

/** Crea una alerta. Devuelve un mensaje de error, o null si ha ido bien. */
export async function crearAlerta(simbolo: string, tipo: TipoAlerta, valor: number | null): Promise<string | null> {
  if (!nube || !sesion) return 'Entra con tu correo para crear alertas.';
  if (alertas.length >= 100) return 'Has llegado al máximo de 100 alertas. Borra alguna para crear otra.';
  const { error } = await nube.from('alertas').insert({ usuario: sesion.user.id, simbolo, tipo, valor });
  if (error) return 'No se ha podido guardar la alerta. Inténtalo de nuevo.';
  await cargarAlertas();
  return null;
}

export async function borrarAlerta(id: string) {
  if (!nube) return;
  ponerAlertas(alertas.filter((a) => a.id !== id));
  await nube.from('alertas').delete().eq('id', id);
}

export async function marcarAvisosVistos() {
  if (!nube || !alertas.some((a) => !a.aviso_visto)) return;
  const ids = alertas.filter((a) => !a.aviso_visto).map((a) => a.id);
  ponerAlertas(alertas.map((a) => ({ ...a, aviso_visto: true })));
  await nube.from('alertas').update({ aviso_visto: true }).in('id', ids);
}

function seCumple(a: Alerta, e: EmpresaBolsa): boolean {
  if (!e.precio) return false;
  if (a.tipo === 'baja_de') return a.valor !== null && e.precio <= a.valor;
  if (a.tipo === 'sube_de') return a.valor !== null && e.precio >= a.valor;
  if (a.tipo === 'mov_dia') return a.valor !== null && typeof e.cambio === 'number' && Math.abs(e.cambio) >= a.valor;
  return !!e.min52 && e.precio <= e.min52 * 1.05; // cerca_min: a menos de un 5 % del mínimo del año
}

let datosParaComprobar: DatosEmpresas | null = null;
let comprobando = false;

/**
 * Compara cada alerta con los precios del día. Se hace al abrir la app, una vez por cada día de datos.
 * Las alertas de precio saltan al cruzar el límite (no todos los días que siguen por debajo o por encima);
 * la de «se mueve mucho en un día» salta cada día que ocurre.
 */
export async function comprobarAlertas(datos: DatosEmpresas) {
  datosParaComprobar = datos;
  if (!nube || !sesion || comprobando || alertas.length === 0) return;
  comprobando = true;
  try {
    const cambiadas = new Map<string, Alerta>();
    for (const a of [...alertas]) {
      const e = datos.porSimbolo.get(a.simbolo);
      const dia = e?.fecha?.slice(0, 10);
      if (!e || !e.precio || !dia || a.comprobada === dia) continue;
      const cumple = seCumple(a, e);
      const salta = cumple && (a.tipo === 'mov_dia' || !a.cumplida);
      const cambios: Partial<Alerta> = { comprobada: dia, cumplida: cumple };
      if (salta) Object.assign(cambios, { aviso_fecha: dia, aviso_precio: e.precio, aviso_cambio: e.cambio ?? null, aviso_visto: false });
      const { error } = await nube.from('alertas').update(cambios).eq('id', a.id);
      if (!error) cambiadas.set(a.id, { ...a, ...cambios });
    }
    // Se parte de la lista de ahora mismo, por si se ha creado o borrado alguna alerta mientras tanto.
    if (cambiadas.size) ponerAlertas(alertas.map((a) => cambiadas.get(a.id) ?? a));
  } finally {
    comprobando = false;
  }
}
