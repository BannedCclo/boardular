import { Suspense, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Size } from './layout';
import { applyColors, type Colors } from './colors';
import { CardLook, Loader } from './pieces';
import type { Source, ViewDef } from './types';

/** Carrega os dados de uma fonte. Numa recarga (`refresh` mudou) o dado antigo fica na tela até o novo chegar, e os números giram até ele. */
export function useSourceData(source: Source, refresh: unknown) {
  const [data, setData] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    Promise.resolve()
      .then(() => source.load())
      .then(
        loaded => alive && setData(loaded),
        error => {
          if (!alive) return;
          // o card só diz que não deu: o motivo vai para o console, para quem está montando o painel
          console.error(`boardular: não foi possível carregar "${source.title}".`, error);
          setFailed(true);
        }
      );
    return () => {
      alive = false;
    };
  }, [source, refresh, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { data, failed, retry };
}

interface Props {
  source: Source;
  view: ViewDef;
  /** Células que o card ocupa agora. */
  size: Size;
  refresh?: unknown;
  /** Cores escolhidas pelo usuário para as partes deste card. */
  colors?: Colors;
}

function Waiting({ title, children }: { title: string; children: React.ReactNode }) {
  const look = useContext(CardLook);
  return (
    <div className={`bd-card${look.className ? ` ${look.className}` : ''}`} style={look.style}>
      <span className="bd-card__titulo">{title}</span>
      <div className="bd-card__espera">{children}</div>
    </div>
  );
}

/** O miolo de um card: carrega os dados da fonte e os entrega à forma de exibição, com a classe e o estilo que a fonte der ao card. */
export const WidgetBody = memo(function WidgetBody({ source, view, size, refresh, colors }: Props) {
  const { data: loaded, failed, retry } = useSourceData(source, refresh);
  const data = useMemo(() => applyColors(source.kind, loaded, colors), [source.kind, loaded, colors]);
  const look = useMemo(() => ({ className: source.className, style: source.style }), [source.className, source.style]);
  const waiting = (
    <Waiting title={source.title}>
      <Loader />
    </Waiting>
  );
  const View = view.component;
  return (
    <CardLook.Provider value={look}>
      {failed && data === null ? (
        <Waiting title={source.title}>
          <span>Não foi possível carregar.</span>
          <button type="button" className="bd-card__de-novo" data-clickable="true" onClick={retry}>
            Tentar de novo
          </button>
        </Waiting>
      ) : data === null ? (
        waiting
      ) : (
        <Suspense fallback={waiting}>
          <View data={data} title={source.title} size={size} />
        </Suspense>
      )}
    </CardLook.Provider>
  );
},
// o tamanho chega como objeto novo a cada render do painel: compara pelos números para um arrasto não redesenhar todos os gráficos
(a, b) => a.source === b.source && a.view === b.view && a.refresh === b.refresh && a.colors === b.colors && a.size.w === b.size.w && a.size.h === b.size.h);
