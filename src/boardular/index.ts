// API principal: o painel montado a partir de uma lista de itens (título, tipo e dados)
export { Boardular, THEMES, type Theme, type BoardularProps } from './Boardular';
export { autoView, normalize, toPreset, toSources, type DashboardItem, type ItemDataByType, type ItemType, type Loadable } from './items';
export { boardularCss } from './styles';

// API avançada: fontes que carregam sob demanda, painel de fábrica feito à mão e o catálogo de formas
export { Dashboard, PRESET_COLS } from './Dashboard';
export { useDashboard } from './useDashboard';
export { VIEWS, viewById, viewsFor } from './views';
export * from './layout';
export type * from './types';
