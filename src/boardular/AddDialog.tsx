import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import gsap from 'gsap';
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
  refresh?: unknown;
  onPick: (source: Source, view: ViewDef) => void;
  onClose: () => void;
}

/** As formas que comportam a fonte, cada uma com a prévia dos dados reais. */
function Options({ source, current, refresh, onPick }: { source: Source; current?: string; refresh?: unknown; onPick: (view: ViewDef) => void }) {
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
            <WidgetBody source={source} view={view} size={view.size} refresh={refresh} />
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

/** Catálogo: escolhe-se a informação à esquerda e, à direita, a forma de exibir. */
export function AddDialog({ open, sources, fixed, current, refresh, onPick, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState(sources[0]?.id);
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

  return (
    <dialog ref={dialog} className="bd-dialogo" aria-labelledby="bd-dialogo-titulo" onClose={onClose} onClick={e => e.target === dialog.current && onClose()}>
      {open && source && (
        <div className={`bd-dialogo__painel${fixed ? ' is-so-formas' : ''}`}>
          <header className="bd-dialogo__topo">
            <div>
              <h2 id="bd-dialogo-titulo">{fixed ? `Editar: ${fixed.title}` : 'Adicionar elemento'}</h2>
              <p>{fixed ? 'Escolha outra forma de exibir esta informação.' : 'Escolha a informação e a forma de exibir.'}</p>
            </div>
            <button type="button" className="bd-dialogo__fechar" onClick={onClose} aria-label="Fechar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
          <div className="bd-dialogo__colunas">
            {!fixed && (
              <ul className="bd-dialogo__fontes">
                {sources.map(s => (
                  <li key={s.id}>
                    <button type="button" className={s.id === source.id ? 'is-escolhida' : undefined} aria-pressed={s.id === source.id} onClick={() => setPicked(s.id)}>
                      <b>{s.title}</b>
                      {s.description && <span>{s.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Options key={source.id} source={source} current={current} refresh={refresh} onPick={view => onPick(source, view)} />
          </div>
        </div>
      )}
    </dialog>
  );
}
