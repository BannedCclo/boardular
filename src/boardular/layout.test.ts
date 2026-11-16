import { describe, expect, it } from 'vitest';
import { firstFree, holes, inOrder, overlaps, pack, place, resolve, sameBoxes, settle, type Box, type Sized } from './layout';

const box = (id: string, x: number, y: number, w = 1, h = 1): Box => ({ id, x, y, w, h });
const item = (id: string, w = 1, h = 1): Sized => ({ id, w, h });
const at = (boxes: Box[], id: string) => {
  const b = boxes.find(x => x.id === id)!;
  return [b.x, b.y];
};
const semSobreposicao = (boxes: Box[]) => boxes.every(a => boxes.every(b => !overlaps(a, b)));

describe('pack', () => {
  it('põe cada card na primeira célula livre, na ordem da fila', () => {
    const r = pack([item('a', 2), item('b', 2), item('c', 2)], 4);
    expect(at(r, 'a')).toEqual([0, 0]);
    expect(at(r, 'b')).toEqual([2, 0]);
    expect(at(r, 'c')).toEqual([0, 1]);
  });

  it('um card menor que vem depois sobe para tapar o buraco', () => {
    const r = pack([item('a', 3), item('b', 2), item('c', 1)], 4);
    expect(at(r, 'b')).toEqual([0, 1]);
    expect(at(r, 'c')).toEqual([3, 0]);
    expect(semSobreposicao(r)).toBe(true);
  });

  it('estreita o card mais largo que a grade', () => {
    const [r] = pack([item('a', 6)], 4);
    expect(r).toMatchObject({ x: 0, w: 4 });
  });

  it('mantém o card fixado na célula dele e acomoda os outros em volta', () => {
    const r = pack([item('a'), item('b', 2, 2), item('c')], 4, box('b', 1, 0, 3, 2));
    expect(at(r, 'b')).toEqual([1, 0]);
    expect(at(r, 'a')).toEqual([0, 0]);
    expect(at(r, 'c')).toEqual([0, 1]);
    expect(semSobreposicao(r)).toBe(true);
  });
});

describe('settle', () => {
  it('sobe os cards enquanto a linha de cima estiver livre, sem mudar a coluna', () => {
    const r = settle([box('a', 0, 3), box('b', 2, 5, 2)], 4);
    expect(at(r, 'a')).toEqual([0, 0]);
    expect(at(r, 'b')).toEqual([2, 0]);
  });

  it('o card segurado empurra para baixo quem estiver no lugar', () => {
    const r = settle([box('a', 0, 0), box('b', 1, 0)], 4, box('a', 1, 0));
    expect(at(r, 'a')).toEqual([1, 0]);
    expect(at(r, 'b')).toEqual([1, 1]);
  });
});

describe('place', () => {
  const grade = [box('a', 0, 0), box('b', 1, 0), box('c', 2, 0), box('d', 0, 1)];

  it('levar o card para a própria célula não muda nada', () => {
    expect(sameBoxes(place(grade, 4, 'a', box('a', 0, 0)).landed, grade)).toBe(true);
  });

  it('o card pode ir para qualquer coluna livre e fica lá', () => {
    const { landed } = place(grade, 4, 'a', box('a', 3, 0));
    expect(at(landed, 'a')).toEqual([3, 0]);
    expect(at(landed, 'b')).toEqual([1, 0]);
    expect(at(landed, 'd')).toEqual([0, 0]);
  });

  it('levado para baixo, troca de lugar com o card de baixo', () => {
    const { landed } = place(grade, 4, 'a', box('a', 0, 1));
    expect(at(landed, 'a')).toEqual([0, 1]);
    expect(at(landed, 'd')).toEqual([0, 0]);
  });

  it('levado para cima, troca de lugar com o card de cima', () => {
    const { landed } = place(grade, 4, 'd', box('d', 0, 0));
    expect(at(landed, 'd')).toEqual([0, 0]);
    expect(at(landed, 'a')).toEqual([0, 1]);
  });

  it('solto abaixo de tudo, sobe até encostar no último card', () => {
    const { held, landed } = place(grade, 4, 'c', box('c', 2, 6));
    expect(at(held, 'c')).toEqual([2, 6]);
    expect(at(landed, 'c')).toEqual([2, 2]);
  });

  it('fica na linha escolhida mesmo com espaço livre acima', () => {
    const alto = [box('a', 0, 0), box('b', 1, 0, 1, 3), box('c', 2, 0)];
    const { landed } = place(alto, 4, 'a', box('a', 0, 2));
    expect(at(landed, 'a')).toEqual([0, 2]);
  });

  it('solto em cima de outro do mesmo tamanho, os dois trocam de lugar', () => {
    const r = place([box('v', 0, 3), box('x', 1, 0), box('receita', 2, 0), box('m', 0, 1, 3, 2)], 4, 'v', box('v', 2, 0)).landed;
    expect(at(r, 'v')).toEqual([2, 0]);
    expect(at(r, 'receita')).toEqual([0, 3]);
    expect(at(r, 'm')).toEqual([0, 1]);
    expect(semSobreposicao(r)).toBe(true);
  });

  it('atravessando a linha passo a passo, os cards abrem espaço em sequência sem ficar trocando entre si', () => {
    // linha de cima: Receita, Tipo, Planos (1×2) e Viagens; Viagens é arrastado até a ponta esquerda
    let grade = [box('receita', 0, 0), box('tipo', 1, 0), box('planos', 2, 0, 1, 2), box('viagens', 3, 0), box('regiao', 3, 1)];
    const vistos: string[] = [];
    for (const x of [2, 1, 0]) {
      grade = place(grade, 4, 'viagens', box('viagens', x, 0)).landed;
      expect(semSobreposicao(grade)).toBe(true);
      vistos.push(inOrder(grade).filter(b => b.y === 0).map(b => b.id).join(','));
    }
    expect(at(grade, 'viagens')).toEqual([0, 0]);
    expect(at(grade, 'receita')).toEqual([1, 0]);
    expect(at(grade, 'tipo')).toEqual([2, 0]);
    // Receita e Tipo só andam para a direita: nenhum dos dois volta para onde estava
    expect(vistos.map(l => l.indexOf('receita') <= l.indexOf('tipo'))).toEqual([true, true, true]);
  });

  it('se o outro não cabe no lugar deixado, ele é empurrado para baixo', () => {
    const r = place([box('v', 3, 0), box('m', 0, 0, 3, 2)], 4, 'v', box('v', 0, 0)).landed;
    expect(at(r, 'v')).toEqual([0, 0]);
    expect(at(r, 'm')).toEqual([0, 1]);
    expect(semSobreposicao(r)).toBe(true);
  });

  it('nunca muda o tamanho de ninguém nem deixa cards sobrepostos', () => {
    const grande = [box('a', 0, 0, 2, 2), box('b', 2, 0, 2, 1), box('c', 2, 1), box('d', 3, 1), box('e', 0, 2, 3, 1)];
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 5; y++) {
        const { held, landed } = place(grande, 4, 'b', box('b', x, y, 2, 1));
        for (const r of [held, landed]) {
          expect(semSobreposicao(r)).toBe(true);
          expect(r.map(b => [b.id, b.w, b.h]).sort()).toEqual(grande.map(b => [b.id, b.w, b.h]).sort());
        }
      }
  });
});

describe('resolve', () => {
  it('segue a ordem das posições guardadas e manda o card novo para o fim', () => {
    const r = resolve([item('novo'), item('a', 2), item('b', 2)], 4, { b: { x: 0, y: 0 }, a: { x: 2, y: 0 } });
    expect(at(r, 'b')).toEqual([0, 0]);
    expect(at(r, 'a')).toEqual([2, 0]);
    expect(at(r, 'novo')).toEqual([0, 1]);
  });

  it('sem layout guardado, segue a ordem de leitura da referência', () => {
    const r = resolve([item('a', 2), item('b', 2)], 2, undefined, { a: { x: 2, y: 0 }, b: { x: 0, y: 0 } });
    expect(at(r, 'b')).toEqual([0, 0]);
    expect(at(r, 'a')).toEqual([0, 1]);
  });
});

describe('tamanho dos cards', () => {
  it('o encaixe nunca muda o tamanho: só tapa buracos movendo cards que cabem neles', () => {
    const fila = [item('a', 3), item('b', 2, 2), item('c', 1)];
    const r = pack(fila, 4);
    expect(r.map(b => [b.id, b.w, b.h])).toEqual(fila.map(f => [f.id, f.w, f.h]));
    expect(at(r, 'c')).toEqual([3, 0]);
    expect(semSobreposicao(r)).toBe(true);
  });

  it('deixa o buraco quando nenhum card cabe nele', () => {
    const r = pack([item('a', 3), item('b', 2)], 4);
    expect(holes(r, 4)).toBe(3);
    expect(r.find(b => b.id === 'a')?.w).toBe(3);
  });
});

describe('firstFree', () => {
  it('acha a primeira célula onde a caixa cabe', () => {
    expect(firstFree([box('a', 0, 0, 3, 1)], 4, { w: 2, h: 1 })).toEqual({ x: 0, y: 1 });
    expect(firstFree([box('a', 0, 0, 2, 1)], 4, { w: 2, h: 1 })).toEqual({ x: 2, y: 0 });
  });
});
