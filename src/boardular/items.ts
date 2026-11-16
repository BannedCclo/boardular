import type { CSSProperties } from 'react';
import { pack, toPositions } from './layout';
import type { DataByKind, Kind, ListData, ListItem, Preset, SeriesData, Slice, Source, StatData, Widget } from './types';
import { VIEWS, viewById } from './views';

/**
 * A forma declarativa de montar um painel: cada item diz o título, o tipo de informação e os dados; a biblioteca escolhe a forma de
 * exibição, o tamanho e o lugar de cada card.
 */

/** O tipo de informação de um item. Os nomes em inglês são sinônimos. */
export type ItemType = 'indicador' | 'distribuicao' | 'serie' | 'lista' | Kind;

const KIND_OF: Record<ItemType, Kind> = {
  indicador: 'stat',
  distribuicao: 'breakdown',
  serie: 'series',
  lista: 'list',
  stat: 'stat',
  breakdown: 'breakdown',
  series: 'series',
  list: 'list',
};

/** Os dados de um item: o valor em si, uma Promise ou uma função que o devolve (chamada de novo a cada `refresh`). */
export type Loadable<T> = T | Promise<T> | (() => T | Promise<T>);

/** O que cada tipo aceita como dado, além do formato completo. */
export interface ItemDataByType {
  /** Um número basta; o formato completo traz legenda, variação, texto e dinheiro. */
  indicador: StatData | number;
  /** Lista de partes, ou um objeto `{ rótulo: valor }`. */
  distribuicao: Slice[] | Record<string, number>;
  serie: SeriesData;
  /** Os itens já bastam (o total passa a ser quantos são). */
  lista: ListData | ListItem[];
}

interface ItemBase {
  /** Identifica o item (para guardar a personalização do usuário). Sem ele, vale o título. */
  id?: string;
  title: string;
  /** Aparece no catálogo de "Adicionar elemento". */
  description?: string;
  /** Força uma forma de exibição (ex.: 'pizza', 'serie-area'); sem ela a biblioteca escolhe pela forma dos dados. */
  display?: string;
  /** Largura e altura iniciais do card, em células da grade (4 colunas); sem elas vale o tamanho da forma de exibição. */
  width?: number;
  height?: number;
  /** Classe e estilo do card: aplicados no elemento `.bd-card` e sempre acima dos estilos da biblioteca. */
  className?: string;
  style?: CSSProperties;
}

export type DashboardItem =
  | (ItemBase & { type: 'indicador' | 'stat'; data: Loadable<ItemDataByType['indicador']> })
  | (ItemBase & { type: 'distribuicao' | 'breakdown'; data: Loadable<ItemDataByType['distribuicao']> })
  | (ItemBase & { type: 'serie' | 'series'; data: Loadable<ItemDataByType['serie']> })
  | (ItemBase & { type: 'lista' | 'list'; data: Loadable<ItemDataByType['lista']> });

export const kindOf = (type: ItemType): Kind => {
  const kind = KIND_OF[type];
  if (!kind) throw new Error(`boardular: tipo de item desconhecido "${type}". Use indicador, distribuicao, serie ou lista.`);
  return kind;
};

/** Leva o dado do formato curto para o completo de cada tipo. */
export function normalize<K extends Kind>(kind: K, data: unknown): DataByKind[K] {
  if (kind === 'stat' && typeof data === 'number') return { value: data } as DataByKind[K];
  if (kind === 'breakdown' && data && !Array.isArray(data) && typeof data === 'object') {
    return Object.entries(data as Record<string, number>).map(([label, value]) => ({ label, value })) as DataByKind[K];
  }
  if (kind === 'list' && Array.isArray(data)) return { total: data.length, items: data as ListItem[] } satisfies ListData as DataByKind[K];
  return data as DataByKind[K];
}

/** Quantas partes, pontos ou itens o dado tem (quando ele já está à mão). */
function countOf(kind: Kind, data: unknown): number | null {
  if (data === undefined || data === null || typeof data === 'function' || data instanceof Promise) return null;
  const d = normalize(kind, data);
  if (kind === 'breakdown') return (d as Slice[]).length;
  if (kind === 'series') return (d as SeriesData).labels.length;
  if (kind === 'list') return (d as ListData).items.length;
  return 1;
}

/**
 * A forma de exibição que a biblioteca escolhe para um item:
 * indicador → número; distribuição de 2 partes → linha dividida, até 5 → rosca, mais → barras horizontais;
 * série de uma linha → linhas, de várias com até 12 pontos → colunas lado a lado, com mais → linhas; lista → lista.
 * Com os dados ainda por chegar (função ou Promise), vale a escolha mais versátil do tipo.
 */
export function autoView(kind: Kind, data?: unknown): string {
  if (kind === 'stat') return 'indicador';
  if (kind === 'list') return 'lista';
  if (kind === 'breakdown') {
    const n = countOf(kind, data);
    if (n === null) return 'rosca';
    return n <= 2 ? 'linha-dividida' : n <= 5 ? 'rosca' : 'barras';
  }
  if (data === undefined || typeof data === 'function' || data instanceof Promise) return 'serie-linha';
  const s = normalize('series', data);
  return s.lines.length > 1 && s.labels.length <= 12 ? 'serie-barras' : 'serie-linha';
}

const warned = new Set<string>();

/** A forma pedida pelo item, se existir e for do tipo dele; senão, a escolhida pela biblioteca. */
export function viewOf(item: DashboardItem): string {
  const kind = kindOf(item.type);
  if (item.display) {
    const v = viewById(item.display);
    if (v && v.kind === kind) return v.id;
    // avisa uma vez só por item: esta função roda a cada montagem do painel (e duas vezes no StrictMode)
    const key = `${item.title}\u0000${item.type}\u0000${item.display}`;
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`boardular: a forma "${item.display}" não existe para o tipo "${item.type}" (item "${item.title}"). Formas possíveis: ${VIEWS.filter(x => x.kind === kind).map(x => x.id).join(', ')}.`);
    }
  }
  return autoView(kind, item.data);
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

/** O id de cada item: o declarado, ou o título; repetidos ganham um número. */
export function idsOf(items: DashboardItem[]): string[] {
  const seen = new Map<string, number>();
  return items.map(item => {
    const base = item.id ?? slug(item.title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Cada item vira uma fonte do catálogo; `read(i)` devolve o item atual (os dados podem mudar sem a fonte mudar). */
export function toSources(items: DashboardItem[], read: (i: number) => DashboardItem): Source[] {
  const ids = idsOf(items);
  return items.map((item, i) => {
    const kind = kindOf(item.type);
    const load = async () => {
      const d = read(i).data;
      return normalize(kind, await (typeof d === 'function' ? d() : d));
    };
    return { id: ids[i], title: item.title, description: item.description, kind, load, className: item.className, style: item.style } as Source;
  });
}

/** O painel de fábrica: um card por item, na ordem declarada, despejados na grade de `cols` colunas. */
export function toPreset(items: DashboardItem[], cols: number): Preset {
  const ids = idsOf(items);
  const widgets: Widget[] = items.map((item, i) => {
    const view = viewById(viewOf(item))!;
    const limits = view.resize ?? { min: view.size, max: view.size };
    const clamp = (v: number | undefined, d: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v ?? d)));
    return {
      id: `c-${ids[i]}`,
      source: ids[i],
      view: view.id,
      w: clamp(item.width, view.size.w, limits.min.w, Math.min(limits.max.w, cols)),
      h: clamp(item.height, view.size.h, limits.min.h, limits.max.h),
    };
  });
  return { widgets, positions: toPositions(pack(widgets, cols)) };
}

/** Uma impressão curta do que forma o painel de fábrica: muda quando um item entra, sai ou muda de forma ou tamanho. */
export function signatureOf(preset: Preset): string {
  const text = preset.widgets.map(w => `${w.source}:${w.view}:${w.w}x${w.h}`).join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
