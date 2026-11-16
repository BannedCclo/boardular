import { lazy } from 'react';
import { BarsView, ColumnsView, DonutView, GaugeView, HalfMoonView, MosaicView, NumbersView, PieView, RingsView, SplitLineView, TotalView } from './views/breakdown';
import { AreasView, GroupedColumnsView, LinesView, ListView, SeriesTotalView, StackedColumnsView, StatView } from './views/others';
import type { DataByKind, Kind, Source, ViewDef } from './types';

const Bars3D = lazy(() => import('./views/Bars3D'));

const s = (w: number, h: number) => ({ w, h });

/** As formas de exibição, na ordem em que o catálogo as oferece. Forma nova entra aqui e vale para todas as fontes do mesmo formato. */
export const VIEWS: ViewDef[] = [
  { id: 'indicador', kind: 'stat', label: 'Número', description: 'O valor em destaque, com a legenda e a variação (quando tem).', size: s(1, 1), maxParts: 1, component: StatView },

  { id: 'numero', kind: 'breakdown', label: 'Total em número', description: 'Só o total, em destaque, com a maior parte embaixo.', size: s(1, 1), maxParts: 8, component: TotalView },
  { id: 'linha-dividida', kind: 'breakdown', label: 'Linha dividida', description: 'Total em destaque e uma barra fina dividida na proporção de cada parte.', size: s(1, 1), resize: { min: s(1, 1), max: s(4, 1) }, maxParts: 4, component: SplitLineView },
  { id: 'numeros', kind: 'breakdown', label: 'Números lado a lado', description: 'Cada parte com o seu número grande e o percentual.', size: s(1, 1), resize: { min: s(1, 1), max: s(4, 1) }, maxParts: 4, component: NumbersView },
  { id: 'medidor', kind: 'breakdown', label: 'Medidor', description: 'Arco preenchido com o percentual da primeira parte e o número ao lado: bom para "quantos já têm".', size: s(1, 1), resize: { min: s(1, 1), max: s(4, 8) }, maxParts: 2, component: GaugeView },
  { id: 'barras', kind: 'breakdown', label: 'Barras horizontais', description: 'Uma barra por parte, com número e percentual.', size: s(1, 2), resize: { min: s(1, 1), max: s(4, 8) }, maxParts: 40, component: BarsView },
  { id: 'meia-lua', kind: 'breakdown', label: 'Meia-lua', description: 'Arco dividido com o total embaixo e a legenda ao lado.', size: s(2, 1), resize: { min: s(2, 1), max: s(4, 8) }, maxParts: 5, component: HalfMoonView },
  { id: 'rosca', kind: 'breakdown', label: 'Rosca', description: 'Anel dividido com o total no centro.', size: s(1, 2), resize: { min: s(1, 2), max: s(4, 8) }, maxParts: 8, component: DonutView },
  { id: 'pizza', kind: 'breakdown', label: 'Pizza', description: 'Círculo dividido em fatias, com o percentual de cada uma.', size: s(1, 2), resize: { min: s(1, 2), max: s(4, 8) }, maxParts: 8, component: PieView },
  { id: 'aneis', kind: 'breakdown', label: 'Anéis', description: 'Um anel por parte, um dentro do outro, cada um preenchido pelo seu percentual.', size: s(1, 2), resize: { min: s(1, 2), max: s(4, 8) }, maxParts: 4, component: RingsView },
  { id: 'colunas', kind: 'breakdown', label: 'Colunas', description: 'Uma coluna por parte, na mesma escala, com o número em cima.', size: s(1, 2), resize: { min: s(1, 2), max: s(4, 4) }, maxParts: 8, component: ColumnsView },
  { id: 'mosaico', kind: 'breakdown', label: 'Mosaico de 100', description: '100 quadradinhos: cada um vale 1% do total.', size: s(1, 2), resize: { min: s(1, 2), max: s(4, 8) }, maxParts: 8, component: MosaicView },
  { id: 'barras-3d', kind: 'breakdown', label: 'Barras 3D', description: 'As partes como blocos em 3D que giram devagar.', size: s(2, 2), resize: { min: s(2, 2), max: s(4, 4) }, maxParts: 8, component: Bars3D },

  { id: 'serie-numero', kind: 'series', label: 'Total em número', description: 'A soma de todos os pontos em destaque e a variação do último contra o anterior.', size: s(1, 1), maxParts: 400, component: SeriesTotalView },
  { id: 'serie-colunas', kind: 'series', label: 'Colunas empilhadas', description: 'Uma coluna por ponto, com as séries empilhadas.', size: s(2, 2), resize: { min: s(2, 2), max: s(4, 3) }, maxParts: 24, component: StackedColumnsView },
  { id: 'serie-barras', kind: 'series', label: 'Colunas lado a lado', description: 'Uma coluna por série em cada ponto, lado a lado.', size: s(2, 2), resize: { min: s(2, 2), max: s(4, 3) }, maxParts: 24, component: GroupedColumnsView },
  { id: 'serie-linha', kind: 'series', label: 'Linhas', description: 'Uma linha por série, com um ponto em cada valor: boa para comparar a evolução.', size: s(2, 2), resize: { min: s(2, 2), max: s(4, 3) }, maxParts: 36, component: LinesView },
  { id: 'serie-area', kind: 'series', label: 'Áreas empilhadas', description: 'Linhas preenchidas e empilhadas: o topo mostra o total.', size: s(2, 2), resize: { min: s(2, 2), max: s(4, 3) }, maxParts: 36, component: AreasView },

  { id: 'lista', kind: 'list', label: 'Lista', description: 'Muda de aparência com o tamanho: do contador (1x1) até a tabela (3 colunas ou mais). Puxe as bordas do card, em edição.', size: s(2, 2), resize: { min: s(1, 1), max: s(4, 3) }, maxParts: 10, component: ListView },
];

export const viewById = (id: string) => VIEWS.find(v => v.id === id);

/** Quantas partes (ou pontos, ou itens) os dados têm: decide quais formas os comportam. */
function partsOf(kind: Kind, data: unknown): number {
  if (!data) return 0;
  if (kind === 'breakdown') return (data as DataByKind['breakdown']).length;
  if (kind === 'series') return (data as DataByKind['series']).labels.length;
  if (kind === 'list') return (data as DataByKind['list']).items.length;
  return 1;
}

/** As formas que comportam a fonte; enquanto os dados não chegam, todas as do formato dela. */
export const viewsFor = (source: Source, data?: unknown) => VIEWS.filter(v => v.kind === source.kind && partsOf(source.kind, data) <= v.maxParts);
