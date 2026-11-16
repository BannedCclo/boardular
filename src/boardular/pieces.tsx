import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { calm } from './motion';

/* ------------------------------------------------------------------ */
/* Número em roleta                                                    */
/* ------------------------------------------------------------------ */

interface Reel {
  key: string;
  /** Caractere que não é dígito: fica parado. */
  fixed: string | null;
  /** Linha da pilha 0-9 0-9 que está à mostra. */
  line: number;
  spinning: boolean;
  delay: number;
}

const STACK = Array.from({ length: 20 }, (_, i) => i % 10);
const STEP_MS = 70;

function reels(text: string, previous: Reel[], mode: 'zero' | 'final' | 'snap' | 'target'): Reel[] {
  const chars = [...text];
  let digit = 0;
  const out: Reel[] = [];
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    const key = `r${chars.length - 1 - i}`;
    if (ch < '0' || ch > '9') {
      out.unshift({ key, fixed: ch, line: 0, spinning: false, delay: 0 });
      continue;
    }
    const d = +ch;
    const old = previous.find(p => p.key === key && p.fixed === null);
    const base = old ? old.line % 10 : 0;
    // sempre para a frente: se o dígito novo é menor que o atual, o rolo dá a volta pela segunda metade da pilha
    const line = mode === 'zero' ? 0 : mode === 'final' ? d : mode === 'snap' ? base : d >= base ? d : d + 10;
    out.unshift({ key, fixed: null, line, spinning: mode === 'target', delay: digit++ * STEP_MS });
  }
  return out;
}

/**
 * Número que gira como uma roleta: cada dígito é um rolo 0-9 que roda para a frente até o valor novo, da direita para a esquerda; o que
 * não é dígito (separador, %, R$) fica parado. Na primeira exibição gira a partir do zero, quando o card aparece na tela.
 */
export function Roulette({ value }: { value: string | number }) {
  const text = String(value ?? '');
  const host = useRef<HTMLSpanElement>(null);
  const [cols, setCols] = useState<Reel[]>(() => reels(text, [], calm() ? 'final' : 'zero'));
  const current = useRef(cols);
  current.current = cols;
  const shown = useRef<string | null>(calm() ? text : null);

  const spinTo = useCallback((next: string) => {
    shown.current = next;
    const snapped = reels(next, current.current, 'snap');
    setCols(snapped);
    // dois quadros: o rolo assenta na posição de partida sem transição e só então gira
    requestAnimationFrame(() => requestAnimationFrame(() => setCols(reels(next, snapped, 'target'))));
  }, []);

  useEffect(() => {
    if (calm()) {
      shown.current = text;
      setCols(reels(text, [], 'final'));
      return;
    }
    if (shown.current === text) return;
    if (shown.current !== null) {
      spinTo(text);
      return;
    }
    // entrada: gira a partir do zero quando o card termina de chegar e aparece na tela (a grade avisa com `bd:liberado`)
    const item = host.current?.closest('.bd-item');
    if (!item || !item.classList.contains('is-espera')) {
      const frame = requestAnimationFrame(() => spinTo(text));
      return () => cancelAnimationFrame(frame);
    }
    const go = () => spinTo(text);
    item.addEventListener('bd:liberado', go, { once: true });
    return () => item.removeEventListener('bd:liberado', go);
  }, [text, spinTo]);

  return (
    <span className="bd-roleta" ref={host} role="img" aria-label={text}>
      {cols.map(c =>
        c.fixed !== null ? (
          <span key={c.key} className="bd-roleta__fixo" aria-hidden="true" data-d={c.fixed} />
        ) : (
          <span key={c.key} className="bd-roleta__rolo" aria-hidden="true">
            <span
              className={`bd-roleta__pilha${c.spinning ? ' is-girando' : ''}`}
              style={{ transform: `translateY(calc(var(--bd-rolo) * -${c.line}))`, transitionDelay: `${c.delay}ms` }}
            >
              {STACK.map((d, i) => (
                <span key={i} className="bd-roleta__digito" data-d={d} />
              ))}
            </span>
          </span>
        )
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Texto rolante                                                       */
/* ------------------------------------------------------------------ */

/**
 * Texto de uma linha que não cabe: em vez de reticências a borda esmaece e, ao passar o mouse no card (ou no ancestral marcado com
 * `data-rolagem`), o texto rola devagar até o fim, como um letreiro; ao sair, volta suave ao começo.
 */
export function Marquee({ children, className = '', ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let run: Animation | undefined;
    const measure = () => {
      if (!run) el.classList.toggle('is-cortado', el.scrollWidth - el.clientWidth > 1);
    };
    const state = () => {
      const cs = getComputedStyle(el);
      return { x: parseFloat(cs.textIndent) || 0, left: parseFloat(cs.getPropertyValue('--bd-fe')) || 0, right: parseFloat(cs.getPropertyValue('--bd-fd')) || 0 };
    };
    const fade = () => parseFloat(getComputedStyle(el).fontSize) * 1.6;

    const enter = () => {
      if (calm()) return;
      const total = el.scrollWidth - el.clientWidth;
      if (total <= 1) return;
      const from = run ? state() : { x: 0, left: 0, right: fade() };
      run?.cancel();
      el.classList.add('is-cortado');
      // ~35px por segundo, no mínimo 1,2s; parte de onde estava se a volta ainda corria
      run = el.animate(
        [
          { textIndent: `${from.x}px`, '--bd-fe': `${from.left}px`, '--bd-fd': `${from.right}px` },
          { textIndent: `${-total}px`, '--bd-fe': `${fade()}px`, '--bd-fd': '0px' },
        ],
        { duration: Math.max(1200, ((total + from.x) / 35) * 1000), delay: from.x ? 0 : 350, easing: 'linear', fill: 'forwards' }
      );
    };
    const leave = () => {
      if (!run) return;
      const from = state();
      run.cancel();
      const back = el.animate(
        [
          { textIndent: `${from.x}px`, '--bd-fe': `${from.left}px`, '--bd-fd': `${from.right}px` },
          { textIndent: '0px', '--bd-fe': '0px', '--bd-fd': `${fade()}px` },
        ],
        { duration: 400, easing: 'ease', fill: 'forwards' }
      );
      run = back;
      back.onfinish = () => {
        if (run !== back) return;
        back.cancel();
        run = undefined;
        measure();
      };
    };

    const area = el.closest<HTMLElement>('[data-rolagem], .bd-card') ?? el;
    area.addEventListener('pointerenter', enter);
    area.addEventListener('pointerleave', leave);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      area.removeEventListener('pointerenter', enter);
      area.removeEventListener('pointerleave', leave);
      observer.disconnect();
      run?.cancel();
    };
  }, []);

  return (
    <span ref={ref} className={`bd-rolante ${className}`} {...rest}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Balão de dica                                                       */
/* ------------------------------------------------------------------ */

export interface Tip {
  label: string;
  value?: number | string;
  pct?: number;
  color?: string;
  detail?: string;
  /** Várias medidas do mesmo ponto: `label` vira o título e cada item ganha a sua linha. */
  items?: { label: string; value: number | string; color?: string }[];
}

let balloon: HTMLElement | undefined;
const fmt = (v: number | string) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v);

function draw(tip: Tip): HTMLElement {
  if (!balloon) {
    balloon = document.createElement('div');
    balloon.className = 'bd-dica';
    balloon.setAttribute('role', 'tooltip');
    document.body.appendChild(balloon);
  }
  const b = balloon;
  b.replaceChildren();
  const head = document.createElement('div');
  head.className = 'bd-dica__linha';
  if (tip.color && !tip.items?.length) {
    const dot = document.createElement('i');
    dot.style.background = tip.color;
    head.appendChild(dot);
  }
  const text = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = tip.label;
  text.appendChild(name);
  if (!tip.items?.length) {
    const rest = [tip.value !== undefined ? fmt(tip.value) : undefined, tip.pct !== undefined ? `${tip.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : undefined].filter(Boolean);
    if (rest.length) text.appendChild(document.createTextNode(` · ${rest.join(' · ')}`));
  }
  head.appendChild(text);
  b.appendChild(head);
  for (const item of tip.items ?? []) {
    const row = document.createElement('div');
    row.className = 'bd-dica__linha bd-dica__item';
    const dot = document.createElement('i');
    dot.style.background = item.color ?? 'transparent';
    const label = document.createElement('span');
    label.textContent = item.label;
    const value = document.createElement('strong');
    value.textContent = fmt(item.value);
    row.append(dot, label, value);
    b.appendChild(row);
  }
  if (tip.detail) {
    const detail = document.createElement('div');
    detail.className = 'bd-dica__detalhe';
    detail.textContent = tip.detail;
    b.appendChild(detail);
  }
  return b;
}

export function showTip(tip: Tip, x: number, y: number): void {
  const b = draw(tip);
  b.style.opacity = '1';
  // acima e à direita do ponteiro; vira para o outro lado quando não cabe na janela
  let left = x + 14;
  let top = y - b.offsetHeight - 12;
  if (left + b.offsetWidth > innerWidth - 8) left = x - b.offsetWidth - 14;
  if (top < 8) top = y + 18;
  b.style.left = `${Math.max(8, left)}px`;
  b.style.top = `${top}px`;
}

export function hideTip(): void {
  if (balloon) balloon.style.opacity = '0';
}

/** Propriedades que fazem um elemento mostrar o balão enquanto o mouse está nele. `null` = sem balão. */
export function tipProps(tip: Tip | null) {
  if (!tip) return {};
  const show = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') showTip(tip, e.clientX, e.clientY);
  };
  return { onPointerEnter: show, onPointerMove: show, onPointerLeave: hideTip };
}

/* ------------------------------------------------------------------ */
/* Moldura do card e carregando                                        */
/* ------------------------------------------------------------------ */

export function Loader() {
  return <span className="bd-loader" role="status" aria-label="Carregando" />;
}

interface FrameProps {
  form: string;
  title: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

/** A moldura comum a todos os cards: borda, raio, respiro e o título em maiúsculas. */
/** A classe e o estilo que quem usa a biblioteca deu a um card: o <Frame> (e o card de espera) os aplicam no `.bd-card`. */
export const CardLook = createContext<{ className?: string; style?: CSSProperties }>({});

export function Frame({ form, title, wide, className = '', children }: FrameProps) {
  const look = useContext(CardLook);
  return (
    <div className={`bd-card is-${form}${wide ? ' is-larga' : ''} ${className}${look.className ? ` ${look.className}` : ''}`} style={look.style}>
      <span className="bd-card__titulo">{title}</span>
      {children}
    </div>
  );
}

/** Largura e altura de um elemento, acompanhando as mudanças de tamanho. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize(s => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/* ------------------------------------------------------------------ */
/* Efeitos dos gráficos por tema                                       */
/* ------------------------------------------------------------------ */

/**
 * A receita de luz e sombra de cada tema, em pixels de tela. É a mesma das sombras CSS (--bd-g-* em boardular.css): uma barra em HTML
 * e um arco em SVG saem com o brilho, o relevo e o sulco do mesmo tamanho. Mudou aqui, muda lá.
 */
const FX = {
  /** argila, partes: luz por dentro em cima à esquerda, sombra por dentro embaixo à direita e sombra macia no chão */
  relevo: { borda: 1.5, macio: 1, luz: 0.6, sombra: 0.28, chao: { dx: 1.5, dy: 2.5, macio: 2, opacidade: 0.3 } },
  /** argila, trilhos: o contrário, cavado na massa */
  sulco: { borda: 1.5, macio: 1.5, sombra: 0.22, luz: 0.85 },
  /** vidro, linhas: a própria cor desfocada por baixo */
  brilho: { macio: 3 },
  /**
   * vidro, partes: vidro colorido por cima do vidro do card, sem luz própria (nada brilha). O corpo é a cor translúcida; o aro de 1px é
   * branco e discreto; em cima, um fio de reflexo e uma faixa fraca; embaixo, a borda um pouco mais escura (a espessura do vidro); por
   * fora, só uma sombra neutra.
   */
  vidro: {
    aro: { largura: 1, opacidade: 0.28 },
    fio: { dy: 1, macio: 0.4, opacidade: 0.4 },
    faixa: { dy: 5, macio: 2, opacidade: 0.09 },
    base: { dy: 1.5, macio: 0.6, opacidade: 0.22 },
    sombra: { dy: 3, macio: 3, opacidade: 0.3 },
  },
};

/** O vão entre duas partes vizinhas e o raio das partes no vidro, em pixels: os mesmos do CSS (--bd-g-vao, --bd-g-raio). */
export const GAP_PX = 2;
export const RADIUS_PX = 3;

/** Sombra por dentro de uma borda: a forma menos ela mesma deslocada, pintada de uma cor. */
function Inner({ dx, dy, blur, color, opacity, result }: { dx: number; dy: number; blur: number; color: string; opacity: number; result: string }) {
  return (
    <>
      <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result={`${result}-m`} />
      <feOffset in={`${result}-m`} dx={dx} dy={dy} result={`${result}-d`} />
      <feComposite in="SourceAlpha" in2={`${result}-d`} operator="out" result={`${result}-r`} />
      <feFlood floodColor={color} floodOpacity={opacity} />
      <feComposite in2={`${result}-r`} operator="in" result={result} />
    </>
  );
}

interface View {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

/**
 * Os filtros de um gráfico em SVG, calculados na escala em que ele aparece: `k` converte os pixels da receita para as unidades do
 * viewBox. Devolve o `ref` e o `style` para pôr no <svg> e os <defs> para pôr dentro dele; o CSS de cada tema escolhe qual filtro usar
 * pelas variáveis --bd-f-relevo, --bd-f-sulco e --bd-f-brilho.
 */
export function useChartFx(view: View) {
  const id = `bdfx${useId().replace(/[^\w-]/g, '')}`;
  const ref = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      // o desenho cabe no <svg> mantendo a proporção: vale o lado que limita
      const s = Math.min(el.clientWidth / view.width, el.clientHeight / view.height);
      if (s > 0) setScale(old => (Math.abs(old - s) > 0.02 ? s : old));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view.width, view.height]);

  const k = 1 / scale;
  const { x = 0, y = 0, width, height } = view;
  const area = { filterUnits: 'userSpaceOnUse' as const, x: x - width * 0.15, y: y - height * 0.15, width: width * 1.3, height: height * 1.3 };
  const { relevo: r, sulco: g, brilho: b, vidro: v } = FX;
  const defs = (
    <defs>
      <filter id={`${id}-relevo`} {...area} colorInterpolationFilters="sRGB">
        <Inner dx={r.borda * k} dy={r.borda * k} blur={r.macio * k} color="#ffffff" opacity={r.luz} result="luz" />
        <Inner dx={-r.borda * k} dy={-r.borda * k} blur={r.macio * k} color="#2a1a6e" opacity={r.sombra} result="sombra" />
        <feGaussianBlur in="SourceAlpha" stdDeviation={r.chao.macio * k} result="espalhado" />
        <feOffset in="espalhado" dx={r.chao.dx * k} dy={r.chao.dy * k} result="caido" />
        <feFlood floodColor="#5a43b8" floodOpacity={r.chao.opacidade} />
        <feComposite in2="caido" operator="in" result="chao" />
        <feMerge>
          <feMergeNode in="chao" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="sombra" />
          <feMergeNode in="luz" />
        </feMerge>
      </filter>
      <filter id={`${id}-sulco`} {...area} colorInterpolationFilters="sRGB">
        <Inner dx={g.borda * k} dy={g.borda * k} blur={g.macio * k} color="#3b2a8a" opacity={g.sombra} result="sombra" />
        <Inner dx={-g.borda * k} dy={-g.borda * k} blur={g.macio * k} color="#ffffff" opacity={g.luz} result="luz" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="sombra" />
          <feMergeNode in="luz" />
        </feMerge>
      </filter>
      <filter id={`${id}-vidro`} {...area} colorInterpolationFilters="sRGB">
        {/* a parte é desenhada translúcida; "cheio" é a mesma forma opaca, para achar bordas, topo, base e lado de fora */}
        <feComponentTransfer in="SourceGraphic" result="cheio">
          <feFuncA type="linear" slope="6" />
        </feComponentTransfer>
        {/* aro de 1px branco e discreto */}
        <feMorphology in="cheio" operator="erode" radius={v.aro.largura * k} result="miolo" />
        <feComposite in="cheio" in2="miolo" operator="out" result="borda" />
        <feFlood floodColor="#ffffff" floodOpacity={v.aro.opacidade} />
        <feComposite in2="borda" operator="in" result="aro" />
        {/* fio de reflexo no topo e uma faixa fraca abaixo dele */}
        <feGaussianBlur in="cheio" stdDeviation={v.fio.macio * k} result="f-m" />
        <feOffset in="f-m" dy={v.fio.dy * k} result="f-d" />
        <feComposite in="cheio" in2="f-d" operator="out" result="f-t" />
        <feFlood floodColor="#ffffff" floodOpacity={v.fio.opacidade} />
        <feComposite in2="f-t" operator="in" result="fio" />
        <feGaussianBlur in="cheio" stdDeviation={v.faixa.macio * k} result="x-m" />
        <feOffset in="x-m" dy={v.faixa.dy * k} result="x-d" />
        <feComposite in="cheio" in2="x-d" operator="out" result="x-t" />
        <feFlood floodColor="#ffffff" floodOpacity={v.faixa.opacidade} />
        <feComposite in2="x-t" operator="in" result="faixa" />
        {/* a base um pouco mais escura: a espessura do vidro */}
        <feGaussianBlur in="cheio" stdDeviation={v.base.macio * k} result="b-m" />
        <feOffset in="b-m" dy={-v.base.dy * k} result="b-d" />
        <feComposite in="cheio" in2="b-d" operator="out" result="b-t" />
        <feFlood floodColor="#000000" floodOpacity={v.base.opacidade} />
        <feComposite in2="b-t" operator="in" result="base" />
        {/* por fora, só uma sombra neutra, nunca por baixo do vidro */}
        <feGaussianBlur in="cheio" stdDeviation={v.sombra.macio * k} result="s-m" />
        <feOffset in="s-m" dy={v.sombra.dy * k} result="s-d" />
        <feComposite in="s-d" in2="cheio" operator="out" result="s-f" />
        <feFlood floodColor="#000000" floodOpacity={v.sombra.opacidade} />
        <feComposite in2="s-f" operator="in" result="sombra" />
        <feMerge>
          <feMergeNode in="sombra" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="faixa" />
          <feMergeNode in="base" />
          <feMergeNode in="fio" />
          <feMergeNode in="aro" />
        </feMerge>
      </filter>
      <filter id={`${id}-brilho`} {...area} colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation={b.macio * k} result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
  // nos temas chapados (padrão e escuro) não há vidro nem relevo: as variáveis levam só o filtro de cor do tema (nenhum no padrão;
  // menos saturação e brilho no escuro)
  const theme = useTheme();
  const flat = FLAT_THEMES.includes(theme) ? (theme === 'dark' ? 'saturate(0.55) brightness(0.9)' : 'none') : null;
  const style = (
    flat
      ? { '--bd-f-relevo': flat, '--bd-f-sulco': 'none', '--bd-f-brilho': flat, '--bd-f-vidro': flat }
      : { '--bd-f-relevo': `url(#${id}-relevo)`, '--bd-f-sulco': `url(#${id}-sulco)`, '--bd-f-brilho': `url(#${id}-brilho)`, '--bd-f-vidro': `url(#${id}-vidro)` }
  ) as CSSProperties;
  /** Quantas unidades do viewBox dão `px` pixels na tela. */
  const px = (n: number) => n * k;
  return { ref, style, defs, px };
}

/** Os temas chapados, sem vidro nem relevo (padrão e escuro). */
export const FLAT_THEMES: readonly string[] = ['default', 'dark'];

/**
 * Nos temas chapados as partes encostam umas nas outras, sem vão. Para o fundo não aparecer como um fio na divisa
 * (o antisserrilhado das duas bordas), cada parte, menos a última, avança um pouco por baixo da seguinte: este tanto, em % da volta.
 */
export const FIO = 0.3;

/** Se o tema ativo é chapado (padrão ou escuro). */
export function useFlat(): boolean {
  return FLAT_THEMES.includes(useTheme());
}

/** O tema ativo (`data-bd-tema` no `<html>`), para o que não dá para trocar só com CSS (geometria das pontas, a cena 3D). */
export function useTheme(): string {
  const read = () => (typeof document === 'undefined' ? 'default' : (document.documentElement.dataset.bdTema ?? 'default'));
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bd-tema'] });
    setTheme(read());
    return () => observer.disconnect();
  }, []);
  return theme;
}
