import type { ComponentType, CSSProperties } from 'react';
import type { Positions, Size } from './layout';

/** Um valor único: o número, a legenda embaixo e a variação em %. */
export interface StatData {
  value: number;
  /** Valor em texto (uma versão, um nome): aparece no lugar do número. */
  text?: string;
  hint?: string;
  delta?: number;
  /** O valor é dinheiro: aparece em reais. */
  money?: boolean;
}

/** Uma parte de um todo. */
export interface Slice {
  label: string;
  /** Rótulo curto, para as formas apertadas. */
  short?: string;
  value: number;
  /** Cor da parte; sem ela vale a paleta, na ordem. */
  color?: string;
}

/** Série no tempo: os rótulos dos pontos e uma ou mais linhas, cada uma com um valor por ponto. */
export interface SeriesData {
  labels: string[];
  lines: { label: string; color?: string; values: number[] }[];
}

export interface ListItem {
  id: string | number;
  title: string;
  detail?: string;
  /** Texto da pílula ao lado do nome; sem ele valem as iniciais. */
  badge?: string;
  /** Valores das colunas extras da tabela (na ordem de `ListData.columns`, depois do nome). */
  cells?: (string | number)[];
}

export interface ListData {
  /** Total de itens (pode ser maior que os mostrados). */
  total: number;
  items: ListItem[];
  /** Cabeçalho da tabela: a primeira coluna é o nome. */
  columns?: string[];
  subtitle?: string;
}

export interface DataByKind {
  stat: StatData;
  breakdown: Slice[];
  series: SeriesData;
  list: ListData;
}

export type Kind = keyof DataByKind;

/** Uma fonte de dados do catálogo: o que o usuário pode pôr no painel. `load` pode ser síncrono ou devolver uma Promise. */
export type Source = {
  [K in Kind]: {
    id: string;
    title: string;
    description?: string;
    kind: K;
    load: () => DataByKind[K] | Promise<DataByKind[K]>;
    /** Classe e estilo do card (no elemento `.bd-card`): ficam acima dos estilos da biblioteca. */
    className?: string;
    style?: CSSProperties;
  };
}[Kind];

/** O que toda forma de exibição recebe: os dados, o título do card e quantas células ele ocupa agora. */
export interface ViewProps<T = unknown> {
  data: T;
  title: string;
  size: Size;
}

/** Uma forma de exibir um formato de dado. */
export interface ViewDef {
  id: string;
  label: string;
  description: string;
  kind: Kind;
  /** Tamanho com que o card entra no painel, em células. */
  size: Size;
  /** Limites do redimensionar; sem eles o card tem tamanho fixo. */
  resize?: { min: Size; max: Size };
  /** Até quantas partes (ou pontos, ou itens) a forma comporta. */
  maxParts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<ViewProps<any>>;
}

/** Um card no painel: qual fonte, em que forma e com que tamanho. */
export interface Widget extends Size {
  id: string;
  source: string;
  view: string;
}

/** O painel de fábrica: os cards e onde ficam na grade mais larga. */
export interface Preset {
  widgets: Widget[];
  positions: Positions;
}
