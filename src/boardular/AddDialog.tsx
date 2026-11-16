import { useEffect, useId, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { gsap } from 'gsap';
import { colorEntries, toHex, type Colors } from './colors';
import { EASE_OUT, calm, secs } from './motion';
import type { Source, ViewDef } from './types';
import { viewsFor } from './views';
import { WidgetBody, useSourceData } from './WidgetBody';

interface Props {
  open: boolean;
  sources: Source[];
  /** Editando um card que já está no painel: a fonte é a dele e só se escolhe a forma. */
  fixed: Source | null;
  /** A forma que o card editado tem agora. */
  current?: string;
  /** As cores que o card editado tem agora. */
  colors?: Colors;
  refresh?: unknown;
  onPick: (source: Source, view: ViewDef, colors: Colors) => void;
  /** O usuário trocou uma cor do card editado: vale na hora, sem precisar escolher uma forma. */
  onColors?: (colors: Colors) => void;
  onClose: () => void;
}

/** As formas que comportam a fonte, cada uma com a prévia dos dados reais. */
function Options({ source, current, colors, refresh, onPick }: { source: Source; current?: string; colors: Colors; refresh?: unknown; onPick: (view: ViewDef) => void }) {
  const { data } = useSourceData(source, refresh);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const options = list.current?.children;
    if (!options?.length || calm()) return;
    const run = animate(options, { opacity: [0, 1], translateY: [10, 0], duration: 320, delay: stagger(45), ease: 'outCubic' });
    return () => {
      run.pause();
    };
  }, [source]);

  return (
    <div className="bd-dialogo__formas" ref={list}>
      {viewsFor(source, data).map(view => (
        <button type="button" key={view.id} className="bd-opcao" aria-current={view.id === current || undefined} onClick={() => onPick(view)}>
          <span className="bd-opcao__previa" style={{ height: view.size.h >= 2 ? 300 : 160 }} aria-hidden="true">
            <WidgetBody source={source} view={view} size={view.size} refresh={refresh} colors={colors} />
          </span>
          <span className="bd-opcao__nome">
            {view.label}
            <small>
              {view.size.w} × {view.size.h}
            </small>
          </span>
          <span className="bd-opcao__descricao">{view.description}</span>
        </button>
      ))}
    </div>
  );
}

interface ColorsMenuProps {
  source: Source;
  /** A forma mostrada na prévia: a do card editado ou, num card novo, a primeira que comporta os dados. */
  current?: string;
  colors: Colors;
  refresh?: unknown;
  onChange: (colors: Colors) => void;
}

/**
 * O menu de cores: um botão no topo do diálogo que abre, preso ao topo da tela, a lista das partes do gráfico (cada uma com o seu
 * seletor de cor) ao lado de uma prévia que muda junto. Só aparece para dados que têm partes (distribuição e série).
 */
function ColorsMenu({ source, current, colors, refresh, onChange }: ColorsMenuProps) {
  const { data } = useSourceData(source, refresh);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const entries = colorEntries(source.kind, data);
  const views = viewsFor(source, data);
  const view = views.find(v => v.id === current) ?? views[0];

  // o painel vai para a camada de cima do navegador (popover): fica preso à tela, e não ao diálogo, que recorta o que sai dele
  useEffect(() => {
    const el = panel.current;
    if (!el?.showPopover) return;
    const shown = el.matches(':popover-open');
    if (open && !shown) el.showPopover();
    else if (!open && shown) el.hidePopover();
  }, [open]);

  // fecha com Esc (antes de o diálogo fechar) e com um clique fora do painel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  if (!entries.length || !view) return null;
  const changed = Object.keys(colors).length > 0;

  return (
    <>
      <button type="button" ref={trigger} className="bd-cores__abrir" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="bd-cores__amostras" aria-hidden="true">
          {entries.slice(0, 4).map(e => (
            <i key={e.label} style={{ background: colors[e.label] ?? e.color }} />
          ))}
        </span>
        Cores
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div ref={panel} id={id} className="bd-cores" popover="manual" role="group" aria-label={`Cores de ${source.title}`}>
        {open && (
          <>
            <div className="bd-cores__lista">
              <div className="bd-cores__topo">
                <b>Cores</b>
                <button type="button" className="bd-cores__restaurar" disabled={!changed} onClick={() => onChange({})}>
                  Restaurar
                </button>
              </div>
              <ul>
                {entries.map(e => (
                  <li key={e.label}>
                    <label>
                      <input
                        type="color"
                        value={toHex(colors[e.label] ?? e.color)}
                        onChange={ev => onChange({ ...colors, [e.label]: ev.target.value })}
                        aria-label={`Cor de ${e.label}`}
                      />
                      <span>{e.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bd-cores__previa" style={{ height: view.size.h >= 2 ? 300 : 160 }} aria-hidden="true">
              <WidgetBody source={source} view={view} size={view.size} refresh={refresh} colors={colors} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Catálogo: escolhe-se a informação à esquerda e, à direita, a forma de exibir. */
export function AddDialog({ open, sources, fixed, current, colors: initial, refresh, onPick, onColors, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState(sources[0]?.id);
  const [colors, setColors] = useState<Colors>({});
  const source = fixed ?? sources.find(s => s.id === picked) ?? sources[0];

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      gsap.fromTo(el, { y: 10, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: secs(0.24), ease: EASE_OUT });
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // ao abrir, as cores são as do card editado (ou nenhuma, num card novo)
  useEffect(() => {
    if (open) setColors(initial ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixed]);

  const recolor = (next: Colors) => {
    setColors(next);
    if (fixed) onColors?.(next);
  };

  return (
    <dialog ref={dialog} className="bd-dialogo" aria-labelledby="bd-dialogo-titulo" onClose={onClose} onClick={e => e.target === dialog.current && onClose()}>
      {open && source && (
        <div className={`bd-dialogo__painel${fixed ? ' is-so-formas' : ''}`}>
          <header className="bd-dialogo__topo">
            <div>
              <h2 id="bd-dialogo-titulo">{fixed ? `Editar: ${fixed.title}` : 'Adicionar elemento'}</h2>
              <p>{fixed ? 'Escolha outra forma de exibir esta informação.' : 'Escolha a informação e a forma de exibir.'}</p>
            </div>
            <div className="bd-dialogo__acoes">
              <ColorsMenu key={source.id} source={source} current={fixed ? current : undefined} colors={colors} refresh={refresh} onChange={recolor} />
              <button type="button" className="bd-dialogo__fechar" onClick={onClose} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>
          <div className="bd-dialogo__colunas">
            {!fixed && (
              <ul className="bd-dialogo__fontes">
                {sources.map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={s.id === source.id ? 'is-escolhida' : undefined}
                      aria-pressed={s.id === source.id}
                      onClick={() => {
                        setPicked(s.id);
                        setColors({});
                      }}
                    >
                      <b>{s.title}</b>
                      {s.description && <span>{s.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Options key={source.id} source={source} current={current} colors={colors} refresh={refresh} onPick={view => onPick(source, view, colors)} />
          </div>
        </div>
      )}
    </dialog>
  );
}
