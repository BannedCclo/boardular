import { useId, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { formatNumber, toParts, useTweened, type Part } from '../motion';
import { FIO, Frame, Marquee, Roulette, hideTip, showTip, tipProps, useChartFx, useFlat, useTheme, GAP_PX, type Tip } from '../pieces';
import type { Slice, ViewProps } from '../types';

type Props = ViewProps<Slice[]>;
type Focus = [number | null, (i: number | null) => void];

const vars = (v: Record<string, string | number>) => v as CSSProperties;
/** A cor de uma parte vai em `color`: o CSS de cada tema faz dela o fundo (sólido na argila, vidro colorido translúcido no vidro) e o aro. */
const paint = (color: string): CSSProperties => ({ color });
const tipOf = (p: Part): Tip => ({ label: p.label, value: p.value, pct: p.pct, color: p.color });
const state = (focus: number | null, i: number) => (focus === i ? ' is-foco' : focus !== null ? ' is-apagado' : '');
const digits = (v: number) => formatNumber(v).length;

function useParts(data: Slice[]) {
  const parts = useMemo(() => toParts(data), [data]);
  const total = useMemo(() => parts.reduce((t, p) => t + p.value, 0), [parts]);
  // a geometria (tamanho e começo de cada parte) desliza do valor antigo ao novo quando os dados mudam
  const geo = useTweened([...parts.map(p => p.pct), ...parts.map(p => p.start)]);
  const pct = (i: number) => geo[i] ?? parts[i].pct;
  const start = (i: number) => geo[parts.length + i] ?? parts[i].start;
  return { parts, total, pct, start, focus: useState<number | null>(null) as Focus };
}

/** Apontar o vão entre dois itens destaca o mais perto na horizontal: o mouse atravessa o gráfico sem "buracos". */
function nearest(e: PointerEvent<HTMLElement>, selector: string, parts: Part[], setFocus: Focus[1]) {
  let best = -1;
  let least = Infinity;
  e.currentTarget.querySelectorAll(selector).forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0;
    if (d < least) {
      least = d;
      best = i;
    }
  });
  setFocus(best < 0 ? null : best);
  if (best >= 0 && e.pointerType !== 'touch') showTip(tipOf(parts[best]), e.clientX, e.clientY);
}

const leave = (setFocus: Focus[1]) => () => {
  setFocus(null);
  hideTip();
};

function Legend({ parts, focus: [focus, setFocus] }: { parts: Part[]; focus: Focus }) {
  return (
    <ul className="bd-legenda" onMouseLeave={() => setFocus(null)}>
      {parts.map((p, i) => (
        <li key={p.label} data-rolagem className={state(focus, i)} onMouseEnter={() => setFocus(i)} {...tipProps(tipOf(p))}>
          <i className="bd-bolinha" style={paint(p.color)} />
          <Marquee className="bd-legenda__nome">{p.label}</Marquee>
          <strong>
            <Roulette value={formatNumber(p.value)} />
          </strong>
          <span className="bd-legenda__pct">{p.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- formas sem gráfico ---------- */

export function TotalView({ data, title }: Props) {
  const { parts, total } = useParts(data);
  const top = [...parts].sort((a, b) => b.value - a.value)[0];
  return (
    <Frame form="numero" title={title}>
      <div className="bd-total" style={vars({ '--n': digits(total) })}>
        <Roulette value={formatNumber(total)} />
      </div>
      <span className="bd-rodape bd-apoio">{top ? `${top.label}: ${top.pct}%` : 'Sem dados.'}</span>
    </Frame>
  );
}

export function SplitLineView({ data, title }: Props) {
  const { parts, total } = useParts(data);
  return (
    <Frame form="linha-dividida" title={title}>
      <div className="bd-total">
        <Roulette value={formatNumber(total)} />
      </div>
      <div className="bd-dividida bd-rodape">
        <ul className="bd-dividida__legenda">
          {parts.map(p => (
            <li key={p.label} {...tipProps(tipOf(p))}>
              <i className="bd-bolinha" style={paint(p.color)} />
              <span className="bd-dividida__nome">
                <span className="is-longo">{p.label}</span>
                <span className="is-curto">{p.short ?? p.label}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="bd-dividida__barra" role="img" aria-label={parts.map(p => `${p.label} ${p.pct}%`).join(', ')}>
          {parts.map(p => (
            <div key={p.label} className="bd-dividida__parte" style={{ width: `${p.pct}%`, ...paint(p.color) }} {...tipProps(tipOf(p))} />
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function NumbersView({ data, title }: Props) {
  const { parts, focus } = useParts(data);
  return (
    <Frame form="numeros" title={title}>
      <div className="bd-numeros" onPointerMove={e => nearest(e, '.bd-numeros__item', parts, focus[1])} onPointerLeave={leave(focus[1])}>
        {parts.map((p, i) => (
          <div key={p.label} className={`bd-numeros__item${state(focus[0], i)}`} style={vars({ '--i': i, '--n': digits(p.value) })}>
            <span className="bd-numeros__rotulo">
              <i className="bd-bolinha" style={paint(p.color)} />
              {p.short ?? p.label}
            </span>
            <strong className="bd-numeros__valor">
              <Roulette value={formatNumber(p.value)} />
            </strong>
            <span className="bd-numeros__pct" style={{ color: p.color }}>
              <Roulette value={p.pct} />%
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function BarsView({ data, title }: Props) {
  const { parts } = useParts(data);
  return (
    <Frame form="barras" title={title}>
      <div className="bd-barras bd-rodape">
        {parts.map((p, i) => (
          <div key={p.label} className="bd-barras__item" data-rolagem style={vars({ '--i': i })} {...tipProps(tipOf(p))}>
            <div className="bd-barras__meta">
              <div className="bd-barras__nome">
                <i className="bd-bolinha" style={paint(p.color)} />
                <Marquee>{p.label}</Marquee>
              </div>
              <div className="bd-barras__numeros">
                <strong>
                  <Roulette value={formatNumber(p.value)} />
                </strong>
                <span>
                  (<Roulette value={p.pct} />
                  %)
                </span>
              </div>
            </div>
            <div className="bd-barras__trilho">
              <div className="bd-barras__cheio" style={{ width: `${p.pct}%`, ...paint(p.color) }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ---------- arcos: a mesma geometria para todos ---------- */

const ARC = 'M 10 50 A 40 40 0 0 1 90 50';
/** Comprimento do ARC (meia volta de raio 40), nas unidades do viewBox. */
const ARC_LENGTH = Math.PI * 40;

interface Segment {
  /** Onde a parte começa e quanto ocupa, em 1/100 do arco (o pathLength). */
  from: number;
  len: number;
  hidden: boolean;
}

/**
 * Onde cada parte de um arco dividido aparece: entre duas vizinhas, uma divisa reta com sempre o mesmo vão; a ponta de fora de um arco
 * aberto não recua (é a ponta do gráfico, que a argila arredonda em useRoundEnds).
 */
function useSegments(parts: Part[], pct: (i: number) => number, start: (i: number) => number, o: { closed: boolean; length: number; px: (n: number) => number }) {
  const flat = useFlat();
  const gap = o.px(GAP_PX) * (100 / o.length);
  const shown = parts.map((_, i) => i).filter(i => parts[i].pct > 0);
  const many = shown.length > 1;
  return parts.map((p, i): Segment => {
    if (p.pct <= 0) return { from: start(i), len: 0, hidden: true };
    const k = shown.indexOf(i);
    // temas chapados: sem vão; cada parte, menos a última, entra um fio por baixo da seguinte
    if (flat) return { from: start(i), len: Math.min(pct(i) + (many && k < shown.length - 1 ? FIO : 0), 100), hidden: false };
    const trimStart = many && (o.closed || k > 0) ? gap / 2 : 0;
    const trimEnd = many && (o.closed || k < shown.length - 1) ? gap / 2 : 0;
    const len = pct(i) - trimStart - trimEnd;
    return len > 0.01 ? { from: start(i) + trimStart, len, hidden: false } : { from: start(i), len: 0, hidden: true };
  });
}

/**
 * Recorte em cunha, a partir do centro do ARC, entre duas posições do arco (em 1/100 dele; de -50 a 150 vai de "para baixo" pela
 * esquerda até "para baixo" pela direita). A borda da cunha é radial, como a divisa reta entre duas partes.
 */
function wedge(t0: number, t1: number) {
  const at = (t: number) => {
    const a = Math.PI * (1 + t / 100);
    return `${(50 + 200 * Math.cos(a)).toFixed(3)} ${(50 + 200 * Math.sin(a)).toFixed(3)}`;
  };
  const pts = ['50 50', at(t0)];
  for (let t = Math.ceil(t0 / 10) * 10; t < t1; t += 10) if (t > t0) pts.push(at(t));
  pts.push(at(t1));
  return pts.join(' ');
}

/**
 * Na argila, as pontas do gráfico são redondas e as divisas de dentro retas. A primeira e a última parte usam a ponta redonda do
 * próprio traço, cortada reta na divisa de dentro por uma cunha: uma forma só por parte, sem peça avulsa nem emenda, e a ponta
 * acompanha o traço quando ele engrossa no realce. Devolve, para cada parte, a ponta e o recorte que ela leva.
 */
function useRoundEnds(parts: Part[], seg: Segment[], on: boolean) {
  const id = `bdponta${useId().replace(/[^\w-]/g, '')}`;
  const shown = parts.map((_, i) => i).filter(i => !seg[i].hidden);
  const first = shown[0];
  const last = shown[shown.length - 1];
  const clips: { id: string; points: string }[] = [];
  const ends = parts.map((_, i) => {
    if (!on || (i !== first && i !== last)) return {};
    if (first === last) return { strokeLinecap: 'round' as const };
    const points = i === first ? wedge(-50, seg[i].from + seg[i].len) : wedge(seg[i].from, 150);
    clips.push({ id: `${id}-${i}`, points });
    return { strokeLinecap: 'round' as const, clipPath: `url(#${id}-${i})` };
  });
  const defs = clips.length ? (
    <defs>
      {clips.map(c => (
        <clipPath key={c.id} id={c.id}>
          <polygon points={c.points} />
        </clipPath>
      ))}
    </defs>
  ) : null;
  return { ends, defs };
}

export function GaugeView({ data, title }: Props) {
  const { parts, total, pct, focus } = useParts(data);
  const fx = useChartFx({ width: 100, height: 56 });
  const first = parts[0];
  if (!first) {
    return (
      <Frame form="medidor" title={title}>
        <span className="bd-rodape bd-apoio">Sem dados.</span>
      </Frame>
    );
  }
  const dash = `${pct(0)} 100`;
  return (
    <Frame form="medidor" title={title}>
      <div className="bd-lado">
        <figure className="bd-grafico is-arco" role="img" aria-label={`${first.label}: ${first.pct}%`}>
          <svg viewBox="0 0 100 56" aria-hidden="true" ref={fx.ref} style={fx.style}>
            {fx.defs}
            <path className="bd-trilho" d={ARC} pathLength={100} {...tipProps(parts[1] ? { label: parts[1].label } : null)} />
            <path
              className="bd-arco"
              d={ARC}
              pathLength={100}
              stroke={first.color}
              strokeDasharray={dash}
              style={vars({ '--pct': first.pct })}
              onMouseEnter={() => focus[1](0)}
              onMouseLeave={() => focus[1](null)}
              {...tipProps(tipOf(first))}
            />
            <path className={`bd-arco-foco${focus[0] === 0 ? ' is-ativo' : ''}`} d={ARC} pathLength={100} stroke={first.color} strokeDasharray={dash} />
          </svg>
          <span className="bd-centro is-baixo">
            <span>
              <Roulette value={first.pct} />%
            </span>
          </span>
        </figure>
        <div className="bd-medidor" style={vars({ '--n': digits(first.value) })} {...tipProps(tipOf(first))}>
          <strong>
            <Roulette value={formatNumber(first.value)} />
          </strong>
          <span className="bd-medidor__rotulo">{first.label}</span>
          <small>de {formatNumber(total)}</small>
        </div>
      </div>
    </Frame>
  );
}

export function HalfMoonView({ data, title }: Props) {
  const { parts, total, pct, start, focus } = useParts(data);
  const fx = useChartFx({ width: 100, height: 52 });
  const seg = useSegments(parts, pct, start, { closed: false, length: ARC_LENGTH, px: fx.px });
  const round = useRoundEnds(parts, seg, useTheme() === 'clay');
  return (
    <Frame form="meia-lua" title={title}>
      <div className="bd-lado">
        <Legend parts={parts} focus={focus} />
        <figure className="bd-grafico is-arco" role="img" aria-label={parts.map(p => `${p.label}: ${p.pct}%`).join(', ')}>
          <svg viewBox="0 0 100 52" aria-hidden="true" ref={fx.ref} style={fx.style}>
            {fx.defs}
            {round.defs}
            <path className="bd-trilho" d={ARC} pathLength={100} />
            <g className={`bd-arcos${focus[0] !== null ? ' is-apagado' : ''}`}>
              {parts.map((p, i) => (
                <path
                  key={p.label}
                  className="bd-arco"
                  d={ARC}
                  pathLength={100}
                  stroke={p.color}
                  strokeDasharray={`${seg[i].len} 100`}
                  strokeDashoffset={-seg[i].from}
                  visibility={seg[i].hidden ? 'hidden' : undefined}
                  {...round.ends[i]}
                  style={vars({ '--ini': p.start, '--pct': p.pct })}
                  onMouseEnter={() => focus[1](i)}
                  onMouseLeave={() => focus[1](null)}
                  {...tipProps(tipOf(p))}
                />
              ))}
            </g>
            <g className="bd-focos">
              {parts.map((p, i) => (
                <path
                  key={p.label}
                  className={`bd-arco-foco${focus[0] === i ? ' is-ativo' : ''}`}
                  d={ARC}
                  pathLength={100}
                  stroke={p.color}
                  strokeDasharray={`${seg[i].len} 100`}
                  strokeDashoffset={-seg[i].from}
                  visibility={seg[i].hidden ? 'hidden' : undefined}
                  {...round.ends[i]}
                />
              ))}
            </g>
          </svg>
          <span className="bd-abaixo" style={vars({ '--n': digits(total) })}>
            <Roulette value={formatNumber(total)} />
          </span>
        </figure>
      </div>
    </Frame>
  );
}

/* ---------- círculos ---------- */

/**
 * Um arco de raio `r` em volta do centro, de `from` até `from + len` (em 1/100 da volta, a partir do topo, no sentido horário),
 * desenhado na medida. Um círculo inteiro tracejado deixaria o navegador arredondar onde o traço começa: os arcos curtos saíam
 * desalinhados e as partes vazavam pelos vãos. O traço "100 0" (com pathLength 100) é só para a entrada crescer de zero até o arco.
 */
function arcPath(r: number, from: number, len: number): string {
  if (len <= 0) return '';
  if (len >= 99.99) return `M 50 ${50 - r} A ${r} ${r} 0 1 1 50 ${50 + r} A ${r} ${r} 0 1 1 50 ${50 - r}`;
  const at = (p: number) => {
    const a = (p / 100) * 2 * Math.PI;
    return `${50 + r * Math.sin(a)} ${50 - r * Math.cos(a)}`;
  };
  return `M ${at(from)} A ${r} ${r} 0 ${len > 50 ? 1 : 0} 1 ${at(from + len)}`;
}
const DONUT_LENGTH = 2 * Math.PI * 40;

/**
 * Na pizza (que não tem traço para recuar) o vão entre as fatias é uma linha da cor do card, da mesma largura dos outros vãos; cada uma
 * aparece quando a varredura de entrada passa por ela.
 */
function Cuts({ parts, start, width }: { parts: Part[]; start: (i: number) => number; width: number }) {
  if (parts.filter(p => p.pct > 0).length < 2) return null;
  return (
    <g className="bd-cortes" strokeWidth={width}>
      {parts.map((p, i) => {
        if (p.pct <= 0) return null;
        const a = polar(start(i), 0);
        const b = polar(start(i), 50.5);
        return <line key={p.label} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={vars({ '--ini': p.start })} />;
      })}
    </g>
  );
}

export function DonutView({ data, title, size }: Props) {
  const { parts, total, pct, start, focus } = useParts(data);
  const fx = useChartFx({ width: 100, height: 100 });
  const seg = useSegments(parts, pct, start, { closed: true, length: DONUT_LENGTH, px: fx.px });
  return (
    <Frame form="rosca" title={title} wide={size.w >= 2}>
      <figure className="bd-grafico" role="img" aria-label={parts.map(p => `${p.label}: ${p.pct}%`).join(', ')}>
        <svg viewBox="0 0 100 100" aria-hidden="true" ref={fx.ref} style={fx.style}>
          {fx.defs}
          <g className={`bd-arcos${focus[0] !== null ? ' is-apagado' : ''}`}>
            <circle className="bd-trilho" cx="50" cy="50" r="40" strokeWidth="14" />
            {parts.map((p, i) => (
              <path
                key={p.label}
                className="bd-arco"
                d={arcPath(40, seg[i].from, seg[i].len)}
                strokeWidth="14"
                pathLength={100}
                stroke={p.color}
                strokeDasharray="100 0"
                visibility={seg[i].hidden ? 'hidden' : undefined}
                style={vars({ '--ini': p.start, '--pct': p.pct })}
                onMouseEnter={() => focus[1](i)}
                onMouseLeave={() => focus[1](null)}
                {...tipProps(tipOf(p))}
              />
            ))}
          </g>
          {parts.map((p, i) => (
            <path
              key={p.label}
              className={`bd-arco-foco${focus[0] === i ? ' is-ativo' : ''}`}
              d={arcPath(40, seg[i].from, seg[i].len)}
              pathLength={100}
              stroke={p.color}
              visibility={seg[i].hidden ? 'hidden' : undefined}
            />
          ))}
          <circle className="bd-miolo" cx="50" cy="50" r="27" />
        </svg>
        <span className="bd-centro" style={vars({ '--n': digits(total) })}>
          <Roulette value={formatNumber(total)} />
          <small>total</small>
        </span>
      </figure>
      <Legend parts={parts} focus={focus} />
    </Frame>
  );
}

const polar = (pct: number, radius: number) => {
  const a = ((pct * 3.6 - 90) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
};

function sector(start: number, pct: number): string {
  if (pct >= 99.99) return 'M 50 0 A 50 50 0 1 1 49.99 0 Z';
  const a = polar(start, 50);
  const b = polar(start + pct, 50);
  return `M 50 50 L ${a.x} ${a.y} A 50 50 0 ${pct > 50 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

export function PieView({ data, title, size }: Props) {
  const { parts, pct, start, focus } = useParts(data);
  const fx = useChartFx({ width: 100, height: 100 });
  const clay = useTheme() === 'clay';
  const flat = useFlat();
  const cutsId = `bdcortes${useId().replace(/[^\w-]/g, '')}`;
  const shown = parts.map((_, i) => i).filter(i => parts[i].pct > 0);
  return (
    <Frame form="pizza" title={title} wide={size.w >= 2}>
      <figure className="bd-grafico" role="img" aria-label={parts.map(p => `${p.label}: ${p.pct}%`).join(', ')}>
        <svg viewBox="0 0 100 100" aria-hidden="true" ref={fx.ref} style={fx.style}>
          {fx.defs}
          {/* a máscara da pizza: a varredura de entrada (um círculo que cresce como um relógio) menos os cortes, vãos de verdade por onde
              aparece o fundo (na argila, o fundo da cavidade) */}
          <mask id={cutsId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
            <circle className="bd-varredura" cx="50" cy="50" r="30" strokeWidth="60" stroke="#fff" fill="none" pathLength={100} strokeDasharray="100 0" transform="rotate(-90 50 50)" />
            {/* temas chapados: um disco inteiro, sem cortes (as fatias encostam, cada uma um fio por baixo da seguinte) */}
            {!flat && <Cuts parts={parts} start={start} width={fx.px(GAP_PX)} />}
          </mask>
          {clay && <circle className="bd-cavidade" cx="50" cy="50" r="50" />}
          <g className="bd-pizza">
            {/* vidro: a máscara corta depois do efeito, e o disco é uma peça só (aro e reflexo só na borda de fora, nada acende nos vãos);
                argila: corta antes do relevo, e cada fatia ganha o seu */}
            <g mask={clay ? undefined : `url(#${cutsId})`}>
              <g className={`bd-arcos${focus[0] !== null ? ' is-apagado' : ''}`}>
                <g className="bd-fatias" mask={clay ? `url(#${cutsId})` : undefined}>
                  {/* setores na medida exata do ângulo: um círculo tracejado deixaria o navegador arredondar onde cada fatia começa, e elas
                      vazavam pelos vãos */}
                  {parts.map((p, i) => (
                    <path
                      key={p.label}
                      className={`bd-fatia${focus[0] === i ? ' is-escondido' : ''}`}
                      d={pct(i) > 0 ? sector(start(i), Math.min(pct(i) + (flat && shown.length > 1 && i !== shown[shown.length - 1] ? FIO : 0), 100)) : ''}
                      fill={p.color}
                      onMouseEnter={() => focus[1](i)}
                      onMouseLeave={() => focus[1](null)}
                      {...tipProps(tipOf(p))}
                    />
                  ))}
                </g>
              </g>
            </g>
            {parts.map((p, i) => (
              <path key={p.label} className={`bd-arco-foco${focus[0] === i ? ' is-ativo' : ''}`} d={sector(start(i), pct(i))} style={{ fill: p.color }} />
            ))}
            {parts.map((p, i) => {
              if (p.pct < 8) return null;
              const at = polar(start(i) + pct(i) / 2, 30);
              return (
                <text key={p.label} className="bd-rotulo-fatia" x={at.x} y={at.y}>
                  {p.pct}%
                </text>
              );
            })}
          </g>
        </svg>
      </figure>
      <Legend parts={parts} focus={focus} />
    </Frame>
  );
}

const ringRadius = (i: number) => 44 - i * 11;

export function RingsView({ data, title, size }: Props) {
  const { parts, pct, focus } = useParts(data);
  const fx = useChartFx({ width: 100, height: 100 });
  /** O mouse em qualquer ponto de um anel (a parte vazia e o vão entre anéis também) destaca o anel de raio mais próximo. */
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 100);
    if (!parts.length || d > ringRadius(0) + 7.5 || d < ringRadius(parts.length - 1) - 7.5) return leave(focus[1])();
    let best = 0;
    parts.forEach((_, i) => {
      if (Math.abs(ringRadius(i) - d) < Math.abs(ringRadius(best) - d)) best = i;
    });
    focus[1](best);
    if (e.pointerType !== 'touch') showTip(tipOf(parts[best]), e.clientX, e.clientY);
  };
  return (
    <Frame form="aneis" title={title} wide={size.w >= 2}>
      <figure className="bd-grafico" role="img" aria-label={parts.map(p => `${p.label}: ${p.pct}%`).join(', ')}>
        <svg viewBox="0 0 100 100" aria-hidden="true" ref={fx.ref} style={fx.style} onPointerMove={pick} onPointerLeave={leave(focus[1])}>
          {fx.defs}
          {parts.map((p, i) => (
            <g key={p.label}>
              <circle className="bd-trilho" cx="50" cy="50" r={ringRadius(i)} strokeWidth="9" />
              <path
                className={`bd-arco${state(focus[0], i)}`}
                d={arcPath(ringRadius(i), 0, pct(i))}
                fill="none"
                strokeWidth="9"
                pathLength={100}
                stroke={p.color}
                strokeDasharray="100 0"
                style={vars({ '--ini': i * 12, '--pct': p.pct })}
              />
            </g>
          ))}
          {parts.length > 0 && ringRadius(parts.length - 1) - 8 > 6 && <circle className="bd-miolo" cx="50" cy="50" r={ringRadius(parts.length - 1) - 8} />}
        </svg>
      </figure>
      <Legend parts={parts} focus={focus} />
    </Frame>
  );
}

/* ---------- colunas e mosaico ---------- */

export function ColumnsView({ data, title, size }: Props) {
  const { parts, focus } = useParts(data);
  const max = Math.max(...parts.map(p => p.value), 1);
  const heights = useTweened(parts.map(p => (p.value / max) * 100));
  return (
    <Frame form="colunas" title={title} wide={size.w >= 2}>
      <div
        className="bd-colunas"
        role="img"
        aria-label={parts.map(p => `${p.label}: ${formatNumber(p.value)}`).join(', ')}
        onPointerMove={e => nearest(e, '.bd-colunas__coluna', parts, focus[1])}
        onPointerLeave={leave(focus[1])}
      >
        {parts.map((p, i) => (
          <div key={p.label} className={`bd-colunas__coluna${state(focus[0], i)}`} style={vars({ '--i': i, '--n': digits(p.value) })}>
            <span className="bd-colunas__valor">
              <Roulette value={formatNumber(p.value)} />
            </span>
            <div className="bd-colunas__trilho">
              <div className="bd-colunas__barra" style={{ height: `${heights[i]}%`, ...paint(p.color) }} />
            </div>
            <span className="bd-colunas__rotulo">
              <span className="bd-colunas__nome">{p.short ?? p.label}</span>
              <span className="bd-colunas__pct">{p.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function MosaicView({ data, title, size }: Props) {
  const { parts, focus } = useParts(data);
  const cells = useMemo(() => {
    const owners = parts.flatMap((p, i) => Array.from({ length: p.pct }, () => i));
    return Array.from({ length: 100 }, (_, k) => owners[k] ?? -1);
  }, [parts]);
  return (
    <Frame form="mosaico" title={title} wide={size.w >= 2}>
      <div className="bd-mosaico-area">
        <div className="bd-mosaico" role="img" aria-label={parts.map(p => `${p.label}: ${p.pct}%`).join(', ')} onMouseLeave={() => focus[1](null)}>
          {cells.map((owner, k) => {
            const p = parts[owner];
            return (
              <span
                key={k}
                className={p ? state(focus[0], owner) : `is-vazio${focus[0] !== null ? ' is-apagado' : ''}`}
                style={vars(p ? { color: p.color, '--d': (k % 10) + Math.floor(k / 10) } : { backgroundColor: 'var(--bd-g-trilho)', '--d': (k % 10) + Math.floor(k / 10) })}
                onMouseEnter={() => focus[1](p ? owner : null)}
                {...tipProps(p ? tipOf(p) : null)}
              />
            );
          })}
        </div>
      </div>
      <Legend parts={parts} focus={focus} />
    </Frame>
  );
}
