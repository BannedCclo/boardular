import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { AddDialog } from './AddDialog';
import { place, resolve, sameBoxes, type Box, type Sized } from './layout';
import { CSS_EASE_OUT, EASE_OUT, EASE_STANDARD, SLIDE, calm } from './motion';
import type { Preset, Source, ViewDef, Widget } from './types';
import { useDashboard } from './useDashboard';
import { viewById } from './views';
import { WidgetBody } from './WidgetBody';
import { useStyles } from './styles';

gsap.registerPlugin(Draggable);

/** Altura de uma célula (px). A grade tem 4 colunas a partir de 1000px de largura, 2 a partir de 600px e 1 abaixo disso. */
const ROW = 160;
export const PRESET_COLS = 4;
const colsFor = (width: number) => (width < 600 ? 1 : width < 1000 ? 2 : 4);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Entrada da página: cada bloco sobe e aparece em sequência, de cima para baixo e da esquerda para a direita. */
const LANDING = { duration: 560, first: 80, step: 55, max: 520, revealed: 100 };

/** As oito alças de redimensionar: para onde cada uma puxa (-1 esquerda/cima, 1 direita/baixo). */
const HANDLES = [
  { dx: 1, dy: 0, name: 'd', label: 'Largura (borda direita)' },
  { dx: -1, dy: 0, name: 'e', label: 'Largura (borda esquerda)' },
  { dx: 0, dy: 1, name: 'b', label: 'Altura (borda de baixo)' },
  { dx: 0, dy: -1, name: 'c', label: 'Altura (borda de cima)' },
  { dx: 1, dy: 1, name: 'db', label: 'Largura e altura (canto inferior direito)' },
  { dx: -1, dy: -1, name: 'ec', label: 'Largura e altura (canto superior esquerdo)' },
  { dx: 1, dy: -1, name: 'dc', label: 'Largura e altura (canto superior direito)' },
  { dx: -1, dy: 1, name: 'eb', label: 'Largura e altura (canto inferior esquerdo)' },
] as const;

interface Props {
  /** Identifica o painel no armazenamento do navegador. */
  id: string;
  title: string;
  subtitle?: string;
  sources: Source[];
  preset: Preset;
  /** Controles da faixa de filtros do cabeçalho. */
  filters?: ReactNode;
  /** Quando muda, todas as fontes são recarregadas (um filtro que troca os dados). */
  refresh?: unknown;
  /** Classe e estilo do painel (no elemento `.bd`): ficam acima dos estilos da biblioteca. */
  className?: string;
  style?: CSSProperties;
}

interface Live {
  id: string;
  mode: 'move' | 'resize';
  /** O que está na tela durante o gesto. Ao mover, já é onde tudo vai assentar (o card segurado segue o ponteiro por cima). */
  boxes: Box[];
  /** Onde tudo assenta quando o card for solto: é o que fica guardado. */
  landed: Box[];
  /** Onde o card arrastado estava quando o gesto começou: ele fica nessa célula (seguindo o ponteiro) até ser solto. */
  origin: Box;
}

interface Item {
  widget: Widget;
  source: Source;
  view: ViewDef;
}

const IconPencil = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

/** Faixa do modo de edição: abre e fecha deslizando a altura. */
function EditBar({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      gsap.fromTo(el, { height: 0, opacity: 0, marginBottom: 0 }, { height: 'auto', opacity: 1, marginBottom: '1.25rem', duration: calm() ? 0 : 0.3, ease: EASE_OUT, clearProps: 'height,opacity,marginBottom' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, marginBottom: 0, duration: calm() ? 0 : 0.22, ease: EASE_STANDARD, onComplete: () => setMounted(false) });
    }
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div className="bd-edicao" ref={ref} role="status">
      <div className="bd-edicao__dentro">{children}</div>
    </div>
  );
}

export function Dashboard({ id, title, subtitle, sources, preset, filters, refresh, className, style }: Props) {
  useStyles();
  const { state, editing, setEditing, add, remove, commit, swap, reset, customized } = useDashboard(id, preset, PRESET_COLS);
  const grid = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, { l: number; t: number; w: number; h: number }>());
  const wobbles = useRef(new Map<string, Animation[]>());
  const waiting = useRef(new Map<Element, { arrived: boolean; visible: boolean }>());
  const watcher = useRef<IntersectionObserver | null>(null);
  const known = useRef(new WeakSet<Element>());
  const landed = useRef(false);
  const dropped = useRef<string | null>(null);
  const geometry = useRef('');
  const [metrics, setMetrics] = useState({ width: 0, gap: 0 });
  const [live, setLiveState] = useState<Live | null>(null);
  /** O gesto em curso, também fora do estado: um arrasto rápido solta o card antes de o React redesenhar. */
  const liveNow = useRef<Live | null>(null);
  const setLive = useCallback((next: Live | null) => {
    liveNow.current = next;
    setLiveState(next);
  }, []);
  const [dialog, setDialog] = useState<{ editing: Item | null } | null>(null);
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const read = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setMetrics(m => (m.width === el.clientWidth && m.gap === gap ? m : { width: el.clientWidth, gap }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { width, gap } = metrics;
  const cols = colsFor(width);
  const stepX = (width + gap) / cols;
  const stepY = ROW + gap;

  /** Os cards cuja fonte e forma existem (uma fonte que saiu do catálogo some do painel sem quebrar o resto). */
  const items = useMemo<Item[]>(() => {
    const byId = new Map(sources.map(s => [s.id, s]));
    return state.widgets.flatMap(widget => {
      const source = byId.get(widget.source);
      const view = viewById(widget.view);
      return source && view ? [{ widget, source, view }] : [];
    });
  }, [state.widgets, sources]);

  const sized = useMemo<Sized[]>(() => items.map(i => ({ id: i.widget.id, w: i.widget.w, h: i.widget.h })), [items]);

  /** A fila despejada na grade, com o tamanho guardado de cada card. */
  const committed = useMemo(() => {
    const widest = Math.max(...Object.keys(state.layouts).map(Number), 0);
    return resolve(sized, cols, state.layouts[cols], state.layouts[widest]);
  }, [sized, state.layouts, cols]);

  /** O que vai para a tela: cada card sempre no tamanho que o usuário escolheu; só a posição se ajusta para tapar buracos. */
  const display = live?.boxes ?? committed;

  /** O que os gestos precisam ler na hora, sem recriar os Draggables a cada render. */
  const now = useRef({ committed, display, sized, items, cols, stepX, stepY, gap, live });
  now.current = { committed, display, sized, items, cols, stepX, stepY, gap, live };

  /* ---------- entrada do conteúdo do card: espera o card chegar e aparecer na tela ---------- */
  const release = useCallback((el: Element, change: Partial<{ arrived: boolean; visible: boolean }>) => {
    const flags = waiting.current.get(el);
    if (!flags) return;
    Object.assign(flags, change);
    if (!flags.arrived || !flags.visible) return;
    waiting.current.delete(el);
    watcher.current?.unobserve(el);
    el.classList.remove('is-espera');
    el.dispatchEvent(new Event('bd:liberado'));
  }, []);

  const register = useCallback(
    (widgetId: string, el: HTMLElement | null) => {
      if (!el) {
        cards.current.delete(widgetId);
        return;
      }
      cards.current.set(widgetId, el);
      // a função de ref roda a cada render: o card só entra na fila de espera na primeira vez
      if (known.current.has(el)) return;
      known.current.add(el);
      watcher.current ??= new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && release(e.target, { visible: true })), { threshold: 0.1 });
      waiting.current.set(el, { arrived: landed.current, visible: false });
      watcher.current.observe(el);
    },
    [release]
  );

  useEffect(() => () => watcher.current?.disconnect(), []);

  /* ---------- entrada da página ---------- */
  useLayoutEffect(() => {
    if (landed.current || !width || !items.length) return;
    landed.current = true;
    const blocks = [header.current, ...items.map(i => cards.current.get(i.widget.id))].filter((b): b is HTMLElement => !!b);
    if (calm()) {
      blocks.forEach(b => release(b, { arrived: true }));
      return;
    }
    const placed = blocks.map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => (Math.abs(a.r.top - b.r.top) > 8 ? a.r.top - b.r.top : a.r.left - b.r.left));
    placed.forEach(({ el }, i) => {
      const delay = Math.min(LANDING.first + i * LANDING.step, LANDING.max);
      el.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: LANDING.duration, delay, easing: CSS_EASE_OUT, fill: 'backwards' }
      );
      setTimeout(() => release(el, { arrived: true }), delay + LANDING.revealed);
    });
  }, [width, items, release]);

  /* ---------- cada card desliza do lugar (e do tamanho) antigo para o novo ---------- */
  useLayoutEffect(() => {
    if (!width) return;
    const key = `${cols}|${width}`;
    const jump = geometry.current !== key || calm();
    geometry.current = key;
    const opening = rects.current.size === 0;

    for (const { widget } of items) {
      const el = cards.current.get(widget.id);
      if (!el) continue;
      const held = live?.mode === 'move' && live.id === widget.id;
      // o tamanho que está na tela agora (pode estar no meio de um deslizar) e, sem ele, o tamanho que a grade dá
      const seen = { w: el.offsetWidth, h: el.offsetHeight };
      if (!held && (el.style.width || el.style.height)) {
        gsap.killTweensOf(el, 'width,height');
        el.style.width = el.style.height = '';
      }
      const next = { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      const prev = rects.current.get(widget.id);
      rects.current.set(widget.id, next);

      if (!prev) {
        // card que o usuário acabou de adicionar: aparece crescendo e a página rola até ele
        if (!opening && !jump) {
          gsap.fromTo(el, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: SLIDE, ease: EASE_OUT, clearProps: 'opacity,scale' });
          requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        }
        continue;
      }
      if (held) continue;
      if (jump) {
        gsap.set(el, { x: 0, y: 0 });
        continue;
      }
      const dx = prev.l - next.l + (Number(gsap.getProperty(el, 'x')) || 0);
      const dy = prev.t - next.t + (Number(gsap.getProperty(el, 'y')) || 0);
      const resized = Math.abs(seen.w - next.w) >= 1 || Math.abs(seen.h - next.h) >= 1;
      const isDropped = dropped.current === widget.id;
      if (!isDropped && Math.abs(dx) < 1 && Math.abs(dy) < 1 && !resized) continue;
      if (isDropped) dropped.current = null;
      gsap.fromTo(
        el,
        { x: dx, y: dy, ...(resized ? { width: seen.w, height: seen.h } : {}) },
        {
          x: 0,
          y: 0,
          ...(resized ? { width: next.w, height: next.h } : {}),
          ...(isDropped ? { scale: 1, opacity: 1 } : {}),
          duration: SLIDE,
          ease: isDropped ? EASE_OUT : EASE_STANDARD,
          overwrite: true,
          onComplete: () => {
            gsap.set(el, { clearProps: isDropped ? 'width,height,zIndex,opacity,scale' : 'width,height' });
          },
        }
      );
    }
    for (const known of [...rects.current.keys()]) if (!items.some(i => i.widget.id === known)) rects.current.delete(known);
  }, [display, live, items, cols, width, tick]);

  const finish = useCallback(
    (widgetId: string, mode: Live['mode']) => {
      const current = now.current;
      commit(current.cols, liveNow.current?.landed ?? current.committed, mode === 'resize' ? widgetId : undefined);
      setLive(null);
      setTick(t => t + 1);
    },
    [commit, setLive]
  );

  /* ---------- arrastar e redimensionar (GSAP Draggable), só em edição ---------- */
  const idsKey = items.map(i => `${i.widget.id}:${i.view.id}`).join('|');
  useEffect(() => {
    if (!editing) return;
    const made: Draggable[] = [];

    for (const { widget, view } of now.current.items) {
      const widgetId = widget.id;
      const el = cards.current.get(widgetId);
      const stage = grid.current;
      if (!el || !stage) continue;
      let lastSwap = 0;
      /**
       * Leva o card para a célula onde o canto dele está agora (qualquer uma): quem estiver lá troca com ele, indo para a célula que
       * ele acabou de deixar (ou é empurrado, se não couber), e o resto assenta com a gravidade da grade. Cada passo parte do passo
       * anterior, então atravessar uma linha vai abrindo espaço card a card, sem os cards ficarem trocando de lugar entre si.
       */
      const follow = (x: number, y: number) => {
        const { cols: n, stepX: sx, stepY: sy } = now.current;
        const prev = liveNow.current;
        const base = prev?.landed;
        const me = base?.find(b => b.id === widgetId);
        if (!me || !prev || !base) return;
        // a posição do card dentro da grade (offsetLeft/Top contam a partir da página, com cabeçalho e margens)
        const cell = {
          x: clamp(Math.round((el.offsetLeft - stage.offsetLeft + x) / sx), 0, Math.max(0, n - me.w)),
          y: Math.max(0, Math.round((el.offsetTop - stage.offsetTop + y) / sy)),
        };
        const { landed } = place(base, n, widgetId, { ...me, ...cell });
        if (sameBoxes(prev.landed, landed)) return;
        lastSwap = performance.now();
        setLive({ ...prev, boxes: landed, landed });
      };

      made.push(
        ...Draggable.create(el, {
          type: 'x,y',
          bounds: stage,
          autoScroll: 1,
          zIndexBoost: false,
          dragClickables: false,
          minimumMovement: 3,
          cursor: 'grab',
          activeCursor: 'grabbing',
          onDragStart() {
            const origin = now.current.display.find(b => b.id === widgetId);
            if (!origin) return;
            lastSwap = 0;
            document.body.style.userSelect = 'none';
            gsap.set(el, { zIndex: 20 });
            gsap.to(el, { scale: 1.02, opacity: 0.92, duration: 0.12, overwrite: 'auto' });
            // segurar não muda nada: os outros só se mexem quando o card chega a outra célula
            setLive({ id: widgetId, mode: 'move', boxes: now.current.committed, landed: now.current.committed, origin });
          },
          onDrag() {
            // no máximo uma troca a cada 80 ms: os outros cards têm tempo de deslizar antes da próxima
            if (performance.now() - lastSwap >= 80) follow(this.x, this.y);
          },
          onDragEnd() {
            document.body.style.userSelect = '';
            dropped.current = widgetId;
            // vale o lugar onde o card foi solto, mesmo que o último passo do arrasto não tenha sido aplicado
            follow(this.endX, this.endY);
            finish(widgetId, 'move');
          },
        })
      );

      const limits = view.resize;
      if (!limits) continue;
      for (const handle of HANDLES) {
        const grip = el.querySelector<HTMLElement>(`.bd-alca[data-alca="${handle.name}"]`);
        if (!grip) continue;
        // o que é arrastado é um elemento-fantasma: do gesto só interessa onde o ponteiro está
        const proxy = document.createElement('div');
        let cur: Box | null = null;
        let right = 0;
        let bottom = 0;
        made.push(
          ...Draggable.create(proxy, {
            type: 'x,y',
            trigger: grip,
            cursor: getComputedStyle(grip).cursor,
            onPress() {
              const me = now.current.display.find(b => b.id === widgetId);
              if (!me) return;
              cur = { ...me };
              right = me.x + me.w;
              bottom = me.y + me.h;
              document.body.style.userSelect = 'none';
              el.dataset.redimensionando = '';
              setLive({ id: widgetId, mode: 'resize', boxes: now.current.committed, landed: now.current.committed, origin: me });
            },
            onDrag() {
              if (!cur || !grid.current) return;
              const { committed: base, cols: n, stepX: sx, stepY: sy, gap: g } = now.current;
              const area = grid.current.getBoundingClientRect();
              const px = this.pointerX - scrollX - area.left;
              const py = this.pointerY - scrollY - area.top;
              const minW = Math.min(limits.min.w, n);
              let { x, y, w, h } = cur;
              // o lado oposto ao que é puxado fica parado; o tamanho segue o ponteiro em células inteiras
              if (handle.dx > 0) w = clamp(Math.round((px - x * sx + g) / sx), minW, Math.max(minW, Math.min(limits.max.w, n - x)));
              else if (handle.dx < 0) {
                const maxW = Math.max(minW, Math.min(limits.max.w, right));
                x = clamp(Math.round(px / sx), right - maxW, right - minW);
                w = right - x;
              }
              if (handle.dy > 0) h = clamp(Math.round((py - y * sy + g) / sy), limits.min.h, limits.max.h);
              else if (handle.dy < 0) {
                const maxH = Math.max(limits.min.h, Math.min(limits.max.h, bottom));
                y = clamp(Math.round(py / sy), bottom - maxH, bottom - limits.min.h);
                h = bottom - y;
              }
              if (x === cur.x && y === cur.y && w === cur.w && h === cur.h) return;
              cur = { id: widgetId, x, y, w, h };
              const { held, landed } = place(base, n, widgetId, cur);
              if (liveNow.current) setLive({ ...liveNow.current, boxes: held, landed });
            },
            onRelease() {
              document.body.style.userSelect = '';
              delete el.dataset.redimensionando;
              if (cur) finish(widgetId, 'resize');
              cur = null;
            },
          })
        );
      }
    }
    return () => made.forEach(d => d.kill());
  }, [editing, idsKey, finish, setLive]);

  /* ---------- vibração leve dos cards em edição (o contorno gira ao contrário e fica parado) ---------- */
  const heldId = live?.id ?? null;
  useEffect(() => {
    const running = wobbles.current;
    const stop = (widgetId: string) => {
      running.get(widgetId)?.forEach(a => a.cancel());
      running.delete(widgetId);
    };
    for (const { widget } of now.current.items) {
      const el = cards.current.get(widget.id);
      // durante um arrasto ou redimensionamento todos param: girar os cards enquanto eles deslizam pesa demais (no Firefox, sobretudo)
      if (!el || !editing || calm() || heldId !== null) {
        stop(widget.id);
        continue;
      }
      if (running.has(widget.id)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // o ângulo vem do deslocamento nos cantos (em px): card grande gira menos e todos parecem tremer igual
      const degrees = (Math.atan((0.55 + Math.random() * 0.15) / Math.max(1, Math.hypot(r.width, r.height) / 2)) * 180) / Math.PI;
      const options: KeyframeAnimationOptions = { duration: 130 + Math.random() * 50, delay: -Math.random() * 180, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' };
      const outline = el.querySelector('.bd-contorno');
      const list = [el.animate([{ rotate: `${-degrees}deg` }, { rotate: `${degrees}deg` }], options)];
      if (outline) list.push(outline.animate([{ rotate: `${degrees}deg` }, { rotate: `${-degrees}deg` }], options));
      running.set(widget.id, list);
    }
    for (const known of [...running.keys()]) if (!now.current.items.some(i => i.widget.id === known)) stop(known);
  }, [editing, idsKey, heldId, tick]);

  useEffect(() => () => wobbles.current.forEach(list => list.forEach(a => a.cancel())), []);

  /* ---------- Esc ou Enter concluem a edição ---------- */
  useEffect(() => {
    if (!editing || dialog) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.key !== 'Escape' && e.key !== 'Enter') || e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      if (e.key === 'Enter' && target?.closest('button, a[href], [role="button"]')) return;
      e.preventDefault();
      setEditing(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, dialog, setEditing]);

  const dismiss = (widgetId: string) => {
    const el = cards.current.get(widgetId);
    if (el && !calm()) gsap.to(el, { opacity: 0, scale: 0.96, duration: SLIDE, ease: EASE_STANDARD, onComplete: () => remove(widgetId) });
    else remove(widgetId);
  };

  /** Teclado em edição: setas levam o card uma célula para o lado, Shift + setas redimensionam, Delete remove. */
  const onKey = (e: KeyboardEvent, item: Item) => {
    if (!editing || e.target !== e.currentTarget) return;
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dismiss(item.widget.id);
      return;
    }
    if (!step) return;
    e.preventDefault();
    const me = committed.find(b => b.id === item.widget.id);
    if (!me) return;
    if (e.shiftKey) {
      const limits = item.view.resize;
      if (!limits) return;
      const to = { ...me, w: clamp(me.w + step[0], Math.min(limits.min.w, cols), Math.min(limits.max.w, cols)), h: clamp(me.h + step[1], limits.min.h, limits.max.h) };
      commit(cols, place(committed, cols, me.id, to).landed, me.id);
    } else {
      const to = { ...me, x: clamp(me.x + step[0], 0, Math.max(0, cols - me.w)), y: Math.max(0, me.y + step[1]) };
      commit(cols, place(committed, cols, me.id, to).landed);
    }
  };

  const rows = Math.max(1, ...display.map(b => b.y + b.h), live?.mode === 'move' ? live.origin.y + live.origin.h : 0);
  /** Onde o card que está sendo arrastado vai cair se for solto agora. */
  const target = live?.mode === 'move' ? live.landed.find(b => b.id === live.id) : undefined;

  return (
    <section className={`bd${className ? ` ${className}` : ''}`} style={style} aria-label={title} data-editando={editing ? '' : undefined}>
      <header className="bd-cabecalho" ref={header}>
        <div className="bd-cabecalho__topo">
          <div className="bd-cabecalho__titulo">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="bd-acoes">
            <button type="button" className="bd-botao" onClick={() => window.print()} title="Imprimir ou salvar o dashboard em PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>PDF</span>
            </button>
            <button type="button" className="bd-botao" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              {editing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <IconPencil />
              )}
              <span>{editing ? 'Concluir edição' : 'Editar dashboard'}</span>
            </button>
          </div>
        </div>
        {filters && <div className="bd-cabecalho__filtros">{filters}</div>}
      </header>

      <EditBar open={editing}>
        <span>
          <strong>Editando o dashboard.</strong> Arraste um card para movê-lo, clique no × para tirá-lo ou adicione um novo; Esc ou Enter concluem. A sua personalização fica guardada neste
          navegador.
        </span>
        <span className="bd-edicao__acoes">
          <button type="button" className="bd-edicao__adicionar" aria-haspopup="dialog" onClick={() => setDialog({ editing: null })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar elemento
          </button>
          <button type="button" className="bd-edicao__restaurar" disabled={!customized} onClick={reset}>
            Restaurar padrão
          </button>
          <button type="button" className="bd-edicao__concluir" onClick={() => setEditing(false)}>
            Concluir
          </button>
        </span>
      </EditBar>

      <div ref={grid} className="bd-grade" style={{ '--bd-colunas': cols, minHeight: rows * stepY - gap } as CSSProperties}>
        {target && <div className="bd-alvo" aria-hidden="true" style={{ gridColumn: `${target.x + 1} / span ${target.w}`, gridRow: `${target.y + 1} / span ${target.h}` }} />}
        {width > 0 &&
          items.map(item => {
            const { widget, source, view } = item;
            const box = live?.mode === 'move' && live.id === widget.id ? live.origin : display.find(b => b.id === widget.id);
            if (!box) return null;
            return (
              <div
                key={widget.id}
                className="bd-item is-espera"
                ref={el => register(widget.id, el)}
                data-editando={editing ? '' : undefined}
                style={{ gridColumn: `${box.x + 1} / span ${box.w}`, gridRow: `${box.y + 1} / span ${box.h}` }}
                tabIndex={editing ? 0 : undefined}
                aria-label={editing ? `${source.title}. Setas movem, Shift e setas redimensionam, Delete remove.` : undefined}
                onKeyDown={e => onKey(e, item)}
              >
                <WidgetBody source={source} view={view} size={{ w: box.w, h: box.h }} refresh={refresh} />
                {editing && (
                  <>
                    <div className="bd-contorno" aria-hidden="true" />
                    <div className="bd-controles">
                      <button type="button" onClick={() => setDialog({ editing: item })} aria-label={`Editar ${source.title}`} title="Trocar a forma de exibir">
                        <IconPencil size={14} />
                      </button>
                      <button type="button" onClick={() => dismiss(widget.id)} aria-label={`Remover ${source.title} do painel`} title="Remover do painel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    {view.resize &&
                      HANDLES.map(h => (
                        <div key={h.name} className="bd-alca" data-alca={h.name} data-clickable="true" role="separator" aria-label={`${h.label} do card ${source.title}`}>
                          <i />
                        </div>
                      ))}
                  </>
                )}
              </div>
            );
          })}
        {width > 0 && !items.length && <p className="bd-vazio">O painel está vazio. Use “Editar dashboard” e depois “Adicionar elemento”.</p>}
      </div>

      <AddDialog
        open={!!dialog}
        sources={sources}
        fixed={dialog?.editing?.source ?? null}
        current={dialog?.editing?.view.id}
        refresh={refresh}
        onClose={() => setDialog(null)}
        onPick={(source, view) => {
          if (dialog?.editing) swap(dialog.editing.widget.id, view.id, view.size);
          else add(source.id, view.id, view.size);
          setDialog(null);
        }}
      />
    </section>
  );
}
