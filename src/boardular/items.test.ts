import { describe, expect, it } from 'vitest';
import { autoView, idsOf, normalize, signatureOf, toPreset, toSources, viewOf, type DashboardItem } from './items';

const partes = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `P${i}`, value: i + 1 }));
const serie = (linhas: number, pontos: number) => ({
  labels: Array.from({ length: pontos }, (_, i) => `${i}`),
  lines: Array.from({ length: linhas }, (_, l) => ({ label: `L${l}`, values: Array.from({ length: pontos }, () => l) })),
});

describe('autoView: a forma que a biblioteca escolhe', () => {
  it('indicador e lista têm uma forma só', () => {
    expect(autoView('stat', 10)).toBe('indicador');
    expect(autoView('list', [])).toBe('lista');
  });
  it('distribuição: linha dividida, rosca ou barras pelo número de partes', () => {
    expect(autoView('breakdown', partes(2))).toBe('linha-dividida');
    expect(autoView('breakdown', partes(5))).toBe('rosca');
    expect(autoView('breakdown', partes(9))).toBe('barras');
    expect(autoView('breakdown', { a: 1, b: 2, c: 3 })).toBe('rosca');
  });
  it('série: linhas para uma linha ou muitos pontos, colunas lado a lado para poucas', () => {
    expect(autoView('series', serie(1, 6))).toBe('serie-linha');
    expect(autoView('series', serie(2, 12))).toBe('serie-barras');
    expect(autoView('series', serie(2, 30))).toBe('serie-linha');
  });
  it('com os dados por chegar, a forma mais versátil do tipo', () => {
    expect(autoView('breakdown', () => partes(2))).toBe('rosca');
    expect(autoView('series', Promise.resolve(serie(2, 3)))).toBe('serie-linha');
  });
});

describe('viewOf: a forma pedida pelo item', () => {
  it('vale quando existe para o tipo', () => {
    expect(viewOf({ title: 'x', type: 'distribuicao', data: partes(3), display: 'pizza' })).toBe('pizza');
  });
  it('é ignorada (com aviso) quando não serve para o tipo', () => {
    const warn = console.warn;
    console.warn = () => {};
    expect(viewOf({ title: 'x', type: 'indicador', data: 3, display: 'pizza' })).toBe('indicador');
    console.warn = warn;
  });
});

describe('normalize: formatos curtos', () => {
  it('número vira indicador', () => expect(normalize('stat', 7)).toEqual({ value: 7 }));
  it('objeto vira lista de partes', () => expect(normalize('breakdown', { a: 1, b: 2 })).toEqual([{ label: 'a', value: 1 }, { label: 'b', value: 2 }]));
  it('lista de itens ganha o total', () => expect(normalize('list', [{ id: 1, title: 'a' }])).toEqual({ total: 1, items: [{ id: 1, title: 'a' }] }));
});

describe('ids, fontes e painel de fábrica', () => {
  const itens: DashboardItem[] = [
    { title: 'Vendas por região', type: 'distribuicao', data: partes(3) },
    { title: 'Vendas por região', type: 'distribuicao', data: partes(3), display: 'pizza' },
    { id: 'total', title: 'Total', type: 'stat', data: () => Promise.resolve(5), className: 'destaque' },
  ];
  it('ids vêm do título, sem acento, e repetidos ganham número', () => {
    expect(idsOf(itens)).toEqual(['vendas-por-regiao', 'vendas-por-regiao-2', 'total']);
  });
  it('as fontes carregam o dado já no formato completo, inclusive de função e Promise', async () => {
    const fontes = toSources(itens, i => itens[i]);
    expect(fontes.map(f => f.kind)).toEqual(['breakdown', 'breakdown', 'stat']);
    expect(fontes[2].className).toBe('destaque');
    expect(await fontes[2].load()).toEqual({ value: 5 });
  });
  it('o painel de fábrica respeita a forma, o tamanho pedido e os limites dela', () => {
    const preset = toPreset([...itens, { title: 'Grande', type: 'lista', data: [], width: 9, height: 1 }], 4);
    expect(preset.widgets.map(w => w.view)).toEqual(['rosca', 'pizza', 'indicador', 'lista']);
    const lista = preset.widgets[3];
    expect(lista.w).toBeLessThanOrEqual(4);
    expect(Object.keys(preset.positions)).toHaveLength(4);
  });
  it('a assinatura muda quando um item muda de forma', () => {
    const a = signatureOf(toPreset(itens, 4));
    const b = signatureOf(toPreset([itens[0], { ...itens[1], display: 'aneis' }, itens[2]], 4));
    expect(a).not.toBe(b);
    expect(signatureOf(toPreset(itens, 4))).toBe(a);
  });
});
