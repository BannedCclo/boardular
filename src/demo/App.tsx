import { useEffect, useState } from 'react';
import { THEMES, Boardular, type Theme } from '../boardular';
import { PERIODOS, definirPeriodo, itens, type Periodo } from './data';
import './demo.css';

const ROTULO_TEMA: Record<Theme, string> = { default: 'Default', dark: 'Dark', glass: 'Glass', clay: 'Clay' };
const CHAVE_TEMA = 'boardular:tema';

function temaGuardado(): Theme {
  try {
    const t = localStorage.getItem(CHAVE_TEMA);
    return THEMES.includes(t as Theme) ? (t as Theme) : 'default';
  } catch {
    return 'default';
  }
}

export function App() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [tema, setTema] = useState<Theme>(temaGuardado);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      // armazenamento bloqueado: o tema vale só nesta visita
    }
  }, [tema]);

  return (
    <main className="demo">
      <Boardular
        id="pedala-vitrine"
        title="Painel Geral da Pedala"
        subtitle="Viagens, ciclistas e frota da rede de bicicletas compartilhadas (dados fictícios)."
        items={itens}
        theme={tema}
        refresh={periodo}
        filters={
          <>
            <label className="bd-filtro">
              Período:
              <select
                value={periodo}
                onChange={e => {
                  const novo = e.target.value as Periodo;
                  definirPeriodo(novo);
                  setPeriodo(novo);
                }}
              >
                {PERIODOS.map(p => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="bd-filtro">
              Tema:
              <select value={tema} onChange={e => setTema(e.target.value as Theme)}>
                {THEMES.map(t => (
                  <option key={t} value={t}>
                    {ROTULO_TEMA[t]}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      />
    </main>
  );
}
