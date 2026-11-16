import { colorOf } from './motion';
import type { Kind, SeriesData, Slice } from './types';

/** Cores escolhidas pelo usuário para um card: o rótulo da parte (ou da linha da série) e a cor. */
export type Colors = Record<string, string>;

/** O que dá para colorir num dado: as partes de uma distribuição ou as linhas de uma série, com a cor que têm sem escolha nenhuma. */
export function colorEntries(kind: Kind, data: unknown): { label: string; color: string }[] {
  if (!data) return [];
  const named: { label: string; color?: string }[] = kind === 'breakdown' ? (data as Slice[]) : kind === 'series' ? (data as SeriesData).lines : [];
  const seen = new Set<string>();
  return named.flatMap((n, i) => {
    if (seen.has(n.label)) return [];
    seen.add(n.label);
    return [{ label: n.label, color: colorOf(n, i) }];
  });
}

/** O dado com as cores escolhidas no lugar das originais; sem escolha, devolve o próprio dado. */
export function applyColors<T>(kind: Kind, data: T, colors?: Colors): T {
  if (!data || !colors || !Object.keys(colors).length) return data;
  const paint = <N extends { label: string; color?: string }>(n: N): N => (colors[n.label] ? { ...n, color: colors[n.label] } : n);
  if (kind === 'breakdown') return (data as unknown as Slice[]).map(paint) as unknown as T;
  if (kind === 'series') return { ...(data as unknown as SeriesData), lines: (data as unknown as SeriesData).lines.map(paint) } as unknown as T;
  return data;
}

let probe: CanvasRenderingContext2D | null | undefined;
/** Qualquer cor de CSS em `#rrggbb`, que é o que o seletor de cor do navegador aceita. */
export function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map(c => c + c).join('')}`.toLowerCase();
  if (probe === undefined) probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!probe) return '#000000';
  probe.fillStyle = '#000000';
  probe.fillStyle = color;
  const out = probe.fillStyle;
  if (/^#[0-9a-f]{6}$/i.test(out)) return out;
  const rgb = out.match(/[\d.]+/g)?.slice(0, 3).map(n => Math.round(+n).toString(16).padStart(2, '0'));
  return rgb?.length === 3 ? `#${rgb.join('')}` : '#000000';
}
