// Frases que Atlas compone automáticamente a partir de los datos (sin IA, sin inventar nada).

import { type Datos, type Pais, dinero, enumerar, nombreProducto, numero, pct, pctSigno, personas, PRODUCTOS } from './datos';

/** El número ISO que usa el mapa para Kosovo no existe: se reconoce por el nombre. */
export function paisDeForma(d: Datos, num: string | null, nombreIngles: string): Pais | null {
  if (num && d.porNum[num]) return d.porNum[num];
  if (nombreIngles === 'Kosovo') return d.paises.XKX ?? null;
  return null;
}

/** «De qué vive»: los principales productos que vende al exterior. */
export function deQueVive(d: Datos, p: Pais, experto: boolean): string | null {
  const c = d.comercio[p.iso3];
  if (!c || !c.total) return null;
  const top = c.productos.slice(0, 3).filter((x) => x.v / c.total >= 0.03);
  if (!top.length) return null;
  if (experto) {
    return `${top.map((x) => `${nombreProducto(x.id)} ${pct((x.v / c.total) * 100, 1)}`).join(' · ')} de las exportaciones de mercancías (${c.a}).`;
  }
  const partes = top.map((x) => {
    const info = PRODUCTOS[x.id];
    return info ? `${info.nombre.toLowerCase()} (${info.ejemplos})` : x.id;
  });
  return `Lo que más vende al mundo: ${enumerar(partes)}.`;
}

/** «El país en 30 segundos»: resumen automático con las cifras clave. */
export function resumen(d: Datos, p: Pais, experto: boolean): string[] {
  const frases: string[] = [];
  const { pib, pibPerCapita, crecimiento, inflacion, paro, exportPctPib, poblacion } = p.d;

  if (pib) {
    let f = p.rangoPib ? `Es la economía n.º ${p.rangoPib} del mundo por tamaño` : 'Su economía';
    f += p.rangoPib ? `: produce ${dinero(pib.v, experto)} al año` : ` produce ${dinero(pib.v, experto)} al año`;
    if (poblacion && pibPerCapita) {
      f += `, con ${personas(poblacion.v)} de habitantes (unos ${numero(Math.round(pibPerCapita.v / 100) * 100)} $ por persona)`;
    }
    frases.push(`${f}.`);
  }
  if (crecimiento) {
    const v = crecimiento.v;
    const como = v >= 4 ? 'creció con fuerza' : v >= 1.5 ? 'creció a buen ritmo' : v >= 0 ? 'creció poco' : 'se encogió';
    let f = experto
      ? `PIB real ${pctSigno(v, 2)} en ${crecimiento.a}`
      : `En ${crecimiento.a} su economía ${como} (${pctSigno(v)})`;
    if (inflacion) {
      f += experto
        ? `; IPC ${pct(inflacion.v, 2)} (${inflacion.a})`
        : ` y los precios subieron un ${pct(inflacion.v)}${inflacion.a !== crecimiento.a ? ` en ${inflacion.a}` : ''}`;
    }
    if (paro) f += experto ? `; paro ${pct(paro.v, 2)} (${paro.a})` : `. El paro es del ${pct(paro.v)}`;
    frases.push(`${f}.`);
  }
  const c = d.comercio[p.iso3];
  if (exportPctPib) {
    const v = exportPctPib.v;
    const como =
      v >= 60 ? 'Vive muy volcada hacia el exterior' : v >= 30 ? 'Depende bastante de vender fuera' : 'Depende sobre todo de su mercado interno';
    frases.push(
      experto
        ? `Exportaciones de bienes y servicios: ${pct(v, 1)} del PIB (${exportPctPib.a}).`
        : `${como}: lo que exporta equivale al ${pct(v, 0)} de todo lo que produce.`,
    );
  }
  if (c?.socios.length) {
    const cliente = d.paises[c.socios[0].iso3]?.nombre;
    const top = c.productos[0];
    if (cliente && top) {
      frases.push(
        `Su principal cliente es ${cliente} y su producto estrella son ${nombreProducto(top.id).toLowerCase()} (${pct((top.v / c.total) * 100, 0)} de las mercancías que exporta).`,
      );
    }
  }
  return frases;
}
