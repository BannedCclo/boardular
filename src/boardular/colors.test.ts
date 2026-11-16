import css from './boardular.css?raw';
import { describe, expect, it } from 'vitest';
import { applyColors, colorEntries, toHex } from './colors';
import { PALETTE } from './motion';

describe('cores escolhidas pelo usuário', () => {
  const slices = [
    { label: 'Loja', value: 1 },
    { label: 'Web', value: 2, color: '#ff0000' },
  ];
  const series = {
    labels: ['a'],
    lines: [
      { label: 'USD', values: [1] },
      { label: 'EUR', values: [2] },
    ],
  };

  it('lista as partes com a cor que têm sem escolha', () => {
    expect(colorEntries('breakdown', slices)).toEqual([
      { label: 'Loja', color: PALETTE[0] },
      { label: 'Web', color: '#ff0000' },
    ]);
    expect(colorEntries('series', series).map(e => e.label)).toEqual(['USD', 'EUR']);
    expect(colorEntries('stat', { value: 1 })).toEqual([]);
    expect(colorEntries('breakdown', null)).toEqual([]);
  });

  it('troca só as cores escolhidas e não mexe no dado original', () => {
    const painted = applyColors('breakdown', slices, { Loja: '#00ff00' });
    expect(painted).toEqual([{ label: 'Loja', value: 1, color: '#00ff00' }, slices[1]]);
    expect(slices[0]).not.toHaveProperty('color');
    expect(applyColors('series', series, { EUR: '#0000ff' }).lines[1]).toMatchObject({ color: '#0000ff' });
    expect(applyColors('breakdown', slices, {})).toBe(slices);
    expect(applyColors('breakdown', slices)).toBe(slices);
  });

  it('converte cores curtas para #rrggbb', () => {
    expect(toHex('#ABC')).toBe('#aabbcc');
    expect(toHex('#4F46E5')).toBe('#4f46e5');
  });
});

describe('modo de edição', () => {
  it('nenhuma regra com [data-editando] troca a aparência do card, do cabeçalho ou dos gráficos', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const looks = /(^|[\s;{])(background(-color)?|border(-color)?|box-shadow|backdrop-filter|-webkit-backdrop-filter|filter)\s*:/;
    const target = /\[data-editando\][^,{]*(\.bd-card|\.bd-cabecalho|\.bd-botao|svg)/;
    const broken = [...rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector, body]) => target.test(selector) && looks.test(body)).map(([, selector]) => selector.trim());
    expect(broken).toEqual([]);
    expect(rules).not.toMatch(/--bd-edicao-(card|botao|cabecalho)/);
  });
});
