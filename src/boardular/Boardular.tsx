import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Dashboard, PRESET_COLS } from './Dashboard';
import { idsOf, signatureOf, toPreset, toSources, type DashboardItem } from './items';

const promises = new WeakMap<object, number>();
let promiseCount = 0;
/** Uma impressão do dado, para saber se ele mudou. */
function fingerprint(data: unknown): string {
  if (typeof data === 'function') return `f:${data.toString()}`;
  if (data instanceof Promise) {
    if (!promises.has(data)) promises.set(data, ++promiseCount);
    return `p:${promises.get(data)}`;
  }
  try {
    return `d:${JSON.stringify(data)}`;
  } catch {
    return `x:${Math.random()}`;
  }
}

/** Os temas da biblioteca. */
export type Theme = 'default' | 'dark' | 'glass' | 'clay';
export const THEMES: readonly Theme[] = ['default', 'dark', 'glass', 'clay'];

export interface BoardularProps {
  /** Os cards do painel, na ordem em que entram na grade. */
  items: DashboardItem[];
  title: string;
  subtitle?: string;
  /** 'default' (claro, chapado; o de fábrica), 'dark' (grafite, chapado), 'glass' (escuro, translúcido) ou 'clay' (claro, estufado). Vale para a página toda (fica no <html>). */
  theme?: Theme;
  /** Desenha atrás da página o fundo do tema (luzes de cor no vidro, manchas pastel na argila). Padrão: true. */
  backdrop?: boolean;
  /** Identifica o painel no armazenamento do navegador, onde fica a personalização do usuário. Sem ele, vale o título. */
  id?: string;
  /** Controles da faixa de filtros do cabeçalho. */
  filters?: ReactNode;
  /** Quando muda, os itens cujos dados são funções são chamados de novo. */
  refresh?: unknown;
  /** Classe e estilo do painel (no elemento `.bd`): ficam acima dos estilos da biblioteca. */
  className?: string;
  style?: CSSProperties;
}

/**
 * O painel montado a partir de uma lista de itens: cada um com título, tipo de informação (indicador, distribuicao, serie, lista) e
 * dados. A biblioteca escolhe a forma de exibição e o tamanho de cada card e os arruma na grade; o usuário pode mover, redimensionar,
 * trocar a forma, tirar e devolver cards, e isso fica guardado no navegador.
 */
export function Boardular({ items, title, subtitle, theme = 'default', backdrop = true, id, filters, refresh, className, style }: BoardularProps) {
  // o tema fica no <html>: assim alcança o painel, o catálogo e o balão de dica (pendurados direto no <body>)
  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.bdTema;
    root.dataset.bdTema = theme;
    return () => {
      if (before === undefined) delete root.dataset.bdTema;
      else root.dataset.bdTema = before;
    };
  }, [theme]);

  // os dados mais recentes, lidos na hora de carregar: trocar só os dados não recria as fontes (nem reinicia os cards)
  const latest = useRef(items);
  latest.current = items;

  // as fontes só mudam quando muda o que identifica os itens (id, título, descrição, tipo, classe e estilo)
  const shape = JSON.stringify(items.map((it, i) => [idsOf(items)[i], it.title, it.description, it.type, it.className, it.style]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sources = useMemo(() => toSources(items, i => latest.current[i]), [shape]);

  const layout = JSON.stringify(items.map(it => [it.id, it.title, it.type, it.display, it.width, it.height]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preset = useMemo(() => toPreset(items, PRESET_COLS), [layout]);

  // dados novos recarregam os cards, como um `refresh`. Compara pelo conteúdo (itens escritos direto no JSX são objetos novos a cada
  // render, e nem por isso os números devem girar de novo); uma função, pelo código; uma Promise, por ela mesma
  const prints = useRef('');
  const version = useRef(0);
  const print = items.map(it => fingerprint(it.data)).join('\u0000');
  if (print !== prints.current) {
    prints.current = print;
    version.current++;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useMemo(() => ({}), [refresh, version.current]);

  // a personalização guardada vale para este conjunto de itens: entrou, saiu ou mudou um item no código, o painel volta ao de fábrica
  const storage = `${id ?? title}:${signatureOf(preset)}`;

  return (
    <>
      {backdrop && <div className="bd-fundo" aria-hidden="true" />}
      <Dashboard
        key={storage}
        id={storage}
        title={title}
        subtitle={subtitle}
        sources={sources}
        preset={preset}
        filters={filters}
        refresh={reload}
        className={className}
        style={style}
      />
    </>
  );
}
