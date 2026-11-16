import type { DashboardItem, ListData, SeriesData, Slice, StatData } from '../boardular';

/**
 * Dados da demonstração: a "Pedala", uma rede fictícia de bicicletas compartilhadas. Tudo aqui é inventado.
 * O período escolhido no cabeçalho muda os números (para ver os números girando e os gráficos se ajustando).
 */
export type Periodo = 'mes' | 'trimestre' | 'ano' | 'tudo';
export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: 'trimestre', rotulo: 'Trimestre' },
  { valor: 'ano', rotulo: 'Ano' },
  { valor: 'tudo', rotulo: 'Histórico total' },
];

let periodo: Periodo = 'mes';
export const definirPeriodo = (p: Periodo) => (periodo = p);

const FATOR: Record<Periodo, number> = { mes: 1, trimestre: 2.9, ano: 11.4, tudo: 38 };

/** Escala um valor pelo período, com um desvio próprio de cada rótulo (as proporções também mudam de um período para outro). */
function noPeriodo(valor: number, rotulo: string): number {
  const semente = [...rotulo].reduce((t, c) => t + c.charCodeAt(0), 0) + PERIODOS.findIndex(p => p.valor === periodo) * 7;
  return Math.round(valor * FATOR[periodo] * (1 + ((semente % 5) - 2) * 0.07));
}

const partes = (lista: [string, number, string?][]): Slice[] => lista.map(([label, value, short]) => ({ label, short, value: noPeriodo(value, label) }));

/** Simula uma chamada de rede, para o card mostrar o estado de carregando. */
const depois = <T,>(fazer: () => T, espera = 450): Promise<T> => new Promise(ok => setTimeout(() => ok(fazer()), espera));

// ---------------------------------------------------------------- os dados (funções: são chamadas de novo quando o período muda)
const viagens = (): StatData => ({ value: noPeriodo(48120, 'viagens'), delta: 6.4, hint: 'Corridas iniciadas no período' });
const receita = () => depois((): StatData => ({ value: noPeriodo(182450, 'receita') + 0.9, money: true, hint: 'Planos e viagens avulsas' }), 650);
const planos = () =>
  partes([
    ['Plano mensal', 21400, 'Mensal'],
    ['Viagem avulsa', 13800, 'Avulsa'],
    ['Plano anual', 8900, 'Anual'],
    ['Passe turista', 4020, 'Turista'],
  ]);
const bicicletas = () =>
  partes([
    ['Convencional', 31200, 'Conv.'],
    ['Elétrica', 16920, 'Elétr.'],
  ]);
const regioes = () =>
  depois(() =>
    partes([
      ['Centro', 16200],
      ['Orla', 12400],
      ['Zona Norte', 8700],
      ['Universidade', 6900],
      ['Zona Sul', 3920],
    ])
  );
const frota: Slice[] = [
  { label: 'Disponível', value: 1180 },
  { label: 'Em uso', value: 637 },
  { label: 'Em manutenção', value: 96 },
  { label: 'Bateria baixa', value: 54 },
];
const avaliacoes = () =>
  partes([
    ['Com avaliação', 33700, 'Com'],
    ['Sem avaliação', 14420, 'Sem'],
  ]);
const idade = () =>
  partes([
    ['Até 17 anos', 310, '<18'],
    ['18 a 29', 3480, '18-29'],
    ['30 a 44', 3620, '30-44'],
    ['45 a 59', 1710, '45-59'],
    ['60 ou mais', 517, '60+'],
  ]);
const evolucao = () =>
  depois(
    (): SeriesData => ({
      labels: ['dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov'],
      lines: [
        { label: 'Convencional', color: '#2563eb', values: [620, 760, 790, 700, 650, 590, 540, 560, 620, 710, 800, 880].map(v => noPeriodo(v, 'conv')) },
        { label: 'Elétrica', color: '#14b8a6', values: [340, 420, 450, 390, 360, 330, 300, 320, 350, 410, 460, 510].map(v => noPeriodo(v, 'elet')) },
      ],
    })
  );
const porHora = (): SeriesData => ({
  labels: ['6h', '7h', '8h', '9h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h'],
  lines: [{ label: 'Viagens', values: [120, 340, 520, 410, 260, 230, 310, 290, 240, 250, 330, 480, 560, 390, 210].map(v => noPeriodo(v, 'hora')) }],
});
const estacoes = (): ListData => {
  const linhas: [string, string, number, string][] = [
    ['Praça do Relógio', 'Centro', 3180, 'Cheia'],
    ['Mirante da Orla', 'Orla', 2910, 'Normal'],
    ['Portão 2 da Universidade Federal', 'Universidade', 2540, 'Normal'],
    ['Mercado Velho', 'Centro', 2330, 'Vazia'],
    ['Terminal Rodoviário Norte', 'Zona Norte', 2070, 'Normal'],
    ['Parque das Águas', 'Zona Sul', 1640, 'Cheia'],
    ['Biblioteca Municipal', 'Centro', 1410, 'Normal'],
  ];
  return {
    total: 148,
    subtitle: '148 estações em operação',
    columns: ['Estação', 'Região', 'Retiradas', 'Situação'],
    items: linhas.map(([title, regiao, retiradas, situacao], i) => ({ id: i, title, detail: regiao, cells: [regiao, noPeriodo(retiradas, title), situacao] })),
  };
};

/**
 * O painel da demonstração, declarado como a biblioteca espera: título, tipo e dados de cada item. Os que não dizem `display` ficam
 * com a forma que a biblioteca escolhe; os demais forçam uma forma, para a vitrine ter um card de cada exibição.
 */
export const itens: DashboardItem[] = [
  // números e linhas finas
  { title: 'Viagens', type: 'indicador', data: viagens, description: 'Corridas iniciadas no período' },
  { id: 'planos-total', title: 'Viagens por plano', type: 'distribuicao', data: planos, display: 'numero' },
  { title: 'Tipo de bicicleta', type: 'distribuicao', data: bicicletas, display: 'linha-dividida' },
  { title: 'Viagens avaliadas', type: 'distribuicao', data: avaliacoes, display: 'medidor' },
  { id: 'planos-numeros', title: 'Viagens por plano', type: 'distribuicao', data: planos, display: 'numeros', width: 2 },
  { title: 'Situação da frota', type: 'distribuicao', data: frota, display: 'meia-lua' },
  // partes
  { title: 'Viagens por região', type: 'distribuicao', data: regioes, display: 'barras' },
  { title: 'Viagens por plano', type: 'distribuicao', data: planos, display: 'rosca' },
  { id: 'regioes-pizza', title: 'Viagens por região', type: 'distribuicao', data: regioes, display: 'pizza' },
  { id: 'frota-aneis', title: 'Situação da frota', type: 'distribuicao', data: frota, display: 'aneis' },
  { id: 'idade-colunas', title: 'Faixa etária', type: 'distribuicao', data: idade, display: 'colunas' },
  { title: 'Faixa etária', type: 'distribuicao', data: idade, display: 'mosaico' },
  { id: 'planos-3d', title: 'Viagens por plano', type: 'distribuicao', data: planos, display: 'barras-3d' },
  // séries
  { id: 'evolucao-colunas', title: 'Evolução mensal das viagens', type: 'serie', data: evolucao, display: 'serie-colunas' },
  { title: 'Evolução mensal das viagens', type: 'serie', data: evolucao, display: 'serie-barras' },
  { title: 'Viagens por hora', type: 'serie', data: porHora },
  { id: 'evolucao-area', title: 'Evolução mensal das viagens', type: 'serie', data: evolucao, display: 'serie-area' },
  // lista e os números que sobram
  { title: 'Estações mais movimentadas', type: 'lista', data: estacoes, width: 3 },
  { id: 'evolucao-total', title: 'Evolução mensal das viagens', type: 'serie', data: evolucao, display: 'serie-numero' },
  { title: 'Receita', type: 'indicador', data: receita },
];
