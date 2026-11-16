import { useContext, useId, useState, type CSSProperties } from 'react';
import { colorOf, formatMoney, formatNumber } from '../motion';
import { CardLook, FLAT_THEMES, Frame, GAP_PX, Marquee, RADIUS_PX, Roulette, hideTip, showTip, useChartFx, useSize, useTheme, type Tip } from '../pieces';
import type { ListData, ListItem, SeriesData, StatData, ViewProps } from '../types';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/* ------------------------------------------------------------------ */
/* Indicador (valor único)                                             */
/* ------------------------------------------------------------------ */

export function StatView({ data, title }: ViewProps<StatData>) {
  const text = data.money ? formatMoney(data.value) : formatNumber(data.value);
  return (
    <Frame form="indicador" title={title}>
      <div className="bd-indicador">
        <div className="bd-indicador__linha">
          {data.text !== undefined ? (
            <strong className="bd-indicador__valor is-texto" title={data.text}>
              {data.text}
            </strong>
          ) : (
            <strong className="bd-indicador__valor" style={vars({ '--n': text.length })}>
              <Roulette value={text} />
            </strong>
          )}
          {data.delta !== undefined && (
            <span className="bd-indicador__variacao">
              {data.delta >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(data.delta))}%
            </span>
          )}
        </div>
        {data.hint && (
          <Marquee className="bd-indicador__subtexto" title={data.hint}>
            {data.hint}
          </Marquee>
        )}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Séries no tempo                                                     */
/* ------------------------------------------------------------------ */

type SeriesForm = 'empilhadas' | 'lado' | 'linha' | 'area';

const PAD = { left: 36, right: 8, top: 8, bottom: 20 };

/** Retângulo com os cantos de cima e os de baixo arredondados à parte (0 = canto reto): a pilha só arredonda as pontas dela. */
function block(x: number, y: number, w: number, h: number, top: number, bottom: number): string {
  const t = Math.min(top, w / 2, h);
  const b = Math.min(bottom, w / 2, Math.max(0, h - t));
  return [
    `M ${x} ${y + t}`,
    t ? `A ${t} ${t} 0 0 1 ${x + t} ${y}` : '',
    `L ${x + w - t} ${y}`,
    t ? `A ${t} ${t} 0 0 1 ${x + w} ${y + t}` : '',
    `L ${x + w} ${y + h - b}`,
    b ? `A ${b} ${b} 0 0 1 ${x + w - b} ${y + h}` : '',
    `L ${x + b} ${y + h}`,
    b ? `A ${b} ${b} 0 0 1 ${x} ${y + h - b}` : '',
    'Z',
  ].join(' ');
}

/** Passo "redondo" (1, 2, 5 vezes uma potência de 10) para as linhas de grade do eixo Y. */
function niceStep(max: number, divisions = 4): number {
  const raw = Math.max(max, 1) / divisions;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function SeriesChart({ data, form }: { data: SeriesData; form: SeriesForm }) {
  const [host, { width: W, height: H }] = useSize<HTMLElement>();
  const [focus, setFocus] = useState<number | null>(null);
  const [slid, setSlid] = useState(false);
  const fx = useChartFx({ width: Math.max(W, 1), height: Math.max(H, 1) });
  const uid = `bdcamada${useId().replace(/[^\w-]/g, '')}`;
  // o raio das colunas é o do tema: pílula na argila, cantinho no vidro (o mesmo das barras em HTML)
  const theme = useTheme();
  const clay = theme === 'clay';
  // temas chapados: canto de 1,5px, colunas lado a lado com 1px de vão e pilhas sem vão, arredondadas só no topo
  const flat = FLAT_THEMES.includes(theme);
  const radius = (w: number) => (clay ? w / 2 : flat ? Math.min(1.5, w / 2) : RADIUS_PX);
  const gapPx = flat ? 1 : GAP_PX;
  const stackGap = flat ? 0 : GAP_PX;
  const n = data.labels.length;
  const lines = data.lines.map((l, i) => ({ ...l, color: colorOf(l, i) }));
  const stacked = form === 'empilhadas' || form === 'area';
  const sums = data.labels.map((_, i) => lines.reduce((t, l) => t + (l.values[i] ?? 0), 0));
  const peak = stacked ? Math.max(...sums, 1) : Math.max(...lines.flatMap(l => l.values), 1);
  const step = niceStep(peak);
  const top = Math.ceil(peak / step) * step;
  const innerW = Math.max(1, W - PAD.left - PAD.right);
  const innerH = Math.max(1, H - PAD.top - PAD.bottom);
  const base = PAD.top + innerH;
  const band = innerW / Math.max(n, 1);
  const y = (v: number) => PAD.top + (1 - v / top) * innerH;
  const points = form === 'linha' || form === 'area';
  // linhas e áreas vão de ponta a ponta; colunas ficam no meio da faixa do seu ponto
  const x = (i: number) => (points && n > 1 ? PAD.left + (innerW * i) / (n - 1) : PAD.left + band * (i + 0.5));
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 44))));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step);

  const tip = (i: number): Tip =>
    lines.length === 1
      ? { label: data.labels[i], value: lines[0].values[i], color: lines[0].color }
      : { label: data.labels[i], items: lines.map(l => ({ label: l.label, value: l.values[i] ?? 0, color: l.color })) };

  // topo acumulado de cada linha em cada ponto (formas empilhadas)
  const stackTop = (li: number, i: number) => lines.slice(0, li + 1).reduce((t, l) => t + (l.values[i] ?? 0), 0);
  const path = (get: (i: number) => number) => data.labels.map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(get(i)).toFixed(1)}`).join(' ');

  const bandLeft = (i: number) => (points && n > 1 ? x(i) - innerW / (n - 1) / 2 : PAD.left + band * i);
  const bandWidth = points && n > 1 ? innerW / (n - 1) : band;

  return (
    <figure className="bd-serie" ref={host} role="img" aria-label={lines.map(l => `${l.label}: ${l.values.map(formatNumber).join(', ')}`).join('; ')}>
      {W > 0 && H > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden="true"
          ref={fx.ref}
          className={focus !== null ? 'is-apontado' : undefined}
          style={{ ...fx.style, ...vars({ '--base': `${base}px` }) }}
          onPointerLeave={() => {
            setFocus(null);
            setSlid(false);
            hideTip();
          }}
        >
          {fx.defs}
          {ticks.map(t => (
            <g key={t}>
              <line className="bd-serie__grade" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="bd-serie__y" x={PAD.left - 6} y={y(t)}>
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {data.labels.map((label, i) =>
            i % every === 0 ? (
              <text key={label + i} className="bd-serie__x" x={x(i)} y={H - 5}>
                {label}
              </text>
            ) : null,
          )}

          <rect
            className={`bd-serie__realce${focus !== null ? ' is-visivel' : ''}${slid ? ' is-deslizando' : ''}`}
            x={0}
            y={PAD.top}
            width={bandWidth}
            height={innerH}
            style={{ transform: `translateX(${bandLeft(focus ?? 0)}px)` }}
          />

          {form === 'empilhadas' && (
            <g className="bd-serie__barras">
              {data.labels.map((_, i) => {
                const w = Math.min(band * 0.6, 28);
                // só os blocos com valor contam: o de baixo arredonda a base da pilha e o de cima, o topo; as divisas ficam retas
                const filled = lines.map((_, li) => li).filter(li => (lines[li].values[i] ?? 0) > 0);
                const lowest = filled[0];
                const highest = filled[filled.length - 1];
                return lines.map((l, li) => {
                  const topV = stackTop(li, i);
                  // o mesmo vão das outras partes entre um bloco e o de cima
                  const trimTop = li !== highest ? stackGap / 2 : 0;
                  const trimBottom = li !== lowest ? stackGap / 2 : 0;
                  const top = y(topV) + trimTop;
                  const h = Math.max(0, y(topV - (l.values[i] ?? 0)) - y(topV) - trimTop - trimBottom);
                  return (
                    <path
                      key={`${li}-${i}`}
                      className={`bd-serie__barra${focus === i ? ' is-foco' : focus !== null ? ' is-apagado' : ''}`}
                      d={block(x(i) - w / 2, top, w, h, li === highest ? radius(w) : 0, li === lowest && !flat ? radius(w) : 0)}
                      fill={l.color}
                      style={vars({ '--i': i })}
                    />
                  );
                });
              })}
            </g>
          )}

          {form === 'lado' && (
            <g className="bd-serie__barras">
              {data.labels.map((_, i) => {
                const group = Math.min(band * 0.7, lines.length * 16);
                const w = Math.max(2, group / lines.length - gapPx);
                return lines.map((l, li) => (
                  <rect
                    key={`${li}-${i}`}
                    className={`bd-serie__barra${focus === i ? ' is-foco' : focus !== null ? ' is-apagado' : ''}`}
                    x={x(i) - group / 2 + (group / lines.length) * li + gapPx / 2}
                    width={w}
                    y={y(l.values[i] ?? 0)}
                    height={Math.max(0, base - y(l.values[i] ?? 0))}
                    fill={l.color}
                    rx={radius(w)}
                    style={vars({ '--i': i })}
                  />
                ));
              })}
            </g>
          )}

          {form === 'area' && (
            <>
              {/* o recheio de cada camada na argila: a cor em tom de massinha, mais viva em cima e mais clara embaixo */}
              <defs>
                {lines.map((l, li) => (
                  <linearGradient key={li} id={`${uid}-${li}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${l.color} 80%, #ffffff)` }} />
                    <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${l.color} 38%, #f2eefa)` }} />
                  </linearGradient>
                ))}
              </defs>
              {[...lines.keys()].reverse().map(li => {
                const upper = path(i => stackTop(li, i));
                const lower = [...data.labels.keys()]
                  .reverse()
                  .map(i => `L${x(i).toFixed(1)} ${y(li ? stackTop(li - 1, i) : 0).toFixed(1)}`)
                  .join(' ');
                const tint = vars({ '--bd-camada': `url(#${uid}-${li})` });
                return (
                  <g key={li}>
                    <path className="bd-serie__area" d={`${upper} ${lower} Z`} fill={lines[li].color} stroke={lines[li].color} style={tint} />
                    {/* a borda de cima da camada: na argila, um rolinho de massa na cor cheia, como a linha do gráfico de linhas */}
                    <path className="bd-serie__crista" d={upper} stroke={lines[li].color} />
                    {/* e os pontos-botão da argila, iguais aos do gráfico de linhas */}
                    {data.labels.map((_, i) => (
                      <circle
                        key={i}
                        className="bd-serie__ponto is-crista"
                        cx={x(i)}
                        cy={y(stackTop(li, i))}
                        r={3}
                        fill={lines[li].color}
                        stroke={lines[li].color}
                        style={vars({ '--j': i, '--n': n, color: lines[li].color })}
                      />
                    ))}
                  </g>
                );
              })}
            </>
          )}

          {form === 'linha' &&
            lines.map((l, li) => (
              <g key={li} className="bd-serie__traco">
                <path className="bd-serie__linha" d={path(i => l.values[i] ?? 0)} stroke={l.color} pathLength={1} />
                {l.values.map((v, i) => (
                  <circle key={i} className="bd-serie__ponto" cx={x(i)} cy={y(v)} r={3} fill={l.color} stroke={l.color} style={vars({ '--j': i, '--n': n, color: l.color })} />
                ))}
              </g>
            ))}

          {points && focus !== null && (
            <g>
              <line className="bd-serie__guia" x1={x(focus)} x2={x(focus)} y1={PAD.top} y2={base} />
              {lines.map((l, li) => (
                <circle key={li} className="bd-serie__anel" cx={x(focus)} cy={y(form === 'area' ? stackTop(li, focus) : (l.values[focus] ?? 0))} r={4.5} fill={l.color} />
              ))}
            </g>
          )}

          {data.labels.map((_, i) => (
            <rect
              key={i}
              className="bd-serie__faixa"
              x={bandLeft(i)}
              y={0}
              width={bandWidth}
              height={H}
              onPointerEnter={() => {
                setSlid(focus !== null);
                setFocus(i);
              }}
              onPointerMove={e => e.pointerType !== 'touch' && showTip(tip(i), e.clientX, e.clientY)}
            />
          ))}
        </svg>
      )}
    </figure>
  );
}

function SeriesLegend({ data }: { data: SeriesData }) {
  if (data.lines.length < 2) return null;
  return (
    <ul className="bd-legenda-serie">
      {data.lines.map((l, i) => (
        <li key={l.label}>
          <i className="bd-bolinha" style={{ color: colorOf(l, i) }} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}

const seriesView = (form: SeriesForm, slug: string) =>
  function SeriesView({ data, title, size }: ViewProps<SeriesData>) {
    return (
      <Frame form={slug} title={title} wide={size.w >= 2}>
        <SeriesLegend data={data} />
        <SeriesChart data={data} form={form} />
      </Frame>
    );
  };

export const StackedColumnsView = seriesView('empilhadas', 'serie-colunas');
export const GroupedColumnsView = seriesView('lado', 'serie-barras');
export const LinesView = seriesView('linha', 'serie-linha');
export const AreasView = seriesView('area', 'serie-area');

/** A soma de todos os pontos em destaque e a variação do último contra o anterior. */
export function SeriesTotalView({ data, title }: ViewProps<SeriesData>) {
  const at = (i: number) => data.lines.reduce((t, l) => t + (l.values[i] ?? 0), 0);
  const total = data.labels.reduce((t, _, i) => t + at(i), 0);
  const last = data.labels.length - 1;
  const change = last > 0 && at(last - 1) ? ((at(last) - at(last - 1)) / at(last - 1)) * 100 : null;
  const text = formatNumber(total);
  return (
    <Frame form="serie-numero" title={title}>
      <div className="bd-total" style={vars({ '--n': text.length })}>
        <Roulette value={text} />
      </div>
      <span className="bd-rodape bd-apoio">
        {change === null ? `${data.labels.length} pontos` : `${change >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(Math.round(change)))}% em ${data.labels[last]}`}
      </span>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Lista: muda de aparência com o tamanho do card                      */
/* ------------------------------------------------------------------ */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('');

function Person({ item, detail }: { item: ListItem; detail: boolean }) {
  return (
    <span className="bd-pessoa" data-rolagem>
      <span className="bd-pessoa__avatar">{item.badge ?? initials(item.title)}</span>
      <span className="bd-pessoa__meta">
        <Marquee className="bd-pessoa__nome">{item.title}</Marquee>
        {detail && item.detail && <Marquee className="bd-pessoa__extra">{item.detail}</Marquee>}
      </span>
    </span>
  );
}

export function ListView({ data, title, size }: ViewProps<ListData>) {
  const look = useContext(CardLook);
  const subtitle = data.subtitle ?? `${formatNumber(data.total)} ${data.total === 1 ? 'item' : 'itens'}`;
  const rest = data.total - data.items.length;

  if (size.w === 1 && size.h === 1) {
    const text = formatNumber(data.total);
    return (
      <Frame form="contador" title={title}>
        <div className="bd-total" style={vars({ '--n': text.length })}>
          <Roulette value={text} />
        </div>
        <span className="bd-rodape bd-apoio">{subtitle}</span>
      </Frame>
    );
  }

  const header = (
    <div className="bd-lista__topo">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );

  if (size.w >= 3) {
    const columns = data.columns ?? ['Nome', 'Detalhe'];
    return (
      <div className={`bd-card is-lista${look.className ? ` ${look.className}` : ''}`} style={look.style}>
        {header}
        <div className="bd-tabela">
          <table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={item.id} style={vars({ '--i': i })}>
                  <td className="bd-tabela__nome">
                    <Person item={item} detail={!!data.columns} />
                  </td>
                  {(item.cells ?? [item.detail ?? '']).slice(0, columns.length - 1).map((cell, k) => (
                    <td key={k}>{typeof cell === 'number' ? formatNumber(cell) : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`bd-card is-lista${look.className ? ` ${look.className}` : ''}`} style={look.style}>
      {header}
      {data.items.length ? (
        <ul className="bd-lista__linhas">
          {data.items.map((item, i) => (
            <li key={item.id} style={vars({ '--i': i })}>
              <div className="bd-lista__linha">
                <Person item={item} detail={size.w >= 2} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <span className="bd-apoio">Nada por aqui.</span>
      )}
      {rest > 0 && <span className="bd-apoio">e mais {formatNumber(rest)}</span>}
    </div>
  );
}
