/**
 * Geometria da grade: funções puras, sem DOM nem React.
 *
 * Cada card tem uma célula (x, y) numa grade de células iguais e pode ser levado para qualquer uma. A grade tem "gravidade"
 * (`settle`): um card que bate em outro empurra-o para baixo e todos sobem enquanto a linha de cima estiver livre, então os buracos
 * se fecham dentro do possível. O tamanho de um card nunca muda sozinho: só a posição se ajusta (a largura só é limitada quando a
 * grade tem menos colunas que o card). Uma largura de grade sem posições guardadas recebe os cards despejados em ordem de leitura
 * (`pack`): cada um na primeira célula livre onde cabe.
 */
export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export type Sized = Size & { id: string };
export type Positions = Record<string, Point>;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function overlaps(a: Box, b: Box): boolean {
  return a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const before = (a: Point, b: Point) => a.y - b.y || a.x - b.x;

/** Primeira célula livre (linha por linha, da esquerda para a direita) onde cabe uma caixa de `size`. */
export function firstFree(placed: Box[], cols: number, size: Size): Point {
  const w = clamp(size.w, 1, cols);
  for (let y = 0; ; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const probe: Box = { id: '\u0000', x, y, w, h: size.h };
      if (!placed.some(b => overlaps(probe, b))) return { x, y };
    }
  }
}

/**
 * Despeja a fila na grade, cada card na primeira célula livre. `pinned` é o card que o usuário está redimensionando: fica exatamente
 * na célula dele (é dela que o ponteiro mede o tamanho) e os outros se acomodam em volta.
 */
export function pack(queue: Sized[], cols: number, pinned?: Box): Box[] {
  const placed: Box[] = [];
  if (pinned) {
    const w = clamp(pinned.w, 1, cols);
    placed.push({ ...pinned, w, h: Math.max(1, pinned.h), x: clamp(pinned.x, 0, cols - w), y: Math.max(0, pinned.y) });
  }
  for (const item of queue) {
    if (item.id === pinned?.id) continue;
    const w = clamp(item.w, 1, cols);
    const h = Math.max(1, item.h);
    placed.push({ id: item.id, w, h, ...firstFree(placed, cols, { w, h }) });
  }
  return placed;
}

/** As caixas na ordem de leitura (linha por linha, da esquerda para a direita). */
export function inOrder<T extends Point>(boxes: T[]): T[] {
  return [...boxes].sort(before);
}

/** A caixa dentro da grade: no máximo da largura dela e sem passar das bordas. */
function fit(box: Box, cols: number): Box {
  const w = clamp(box.w, 1, cols);
  return { ...box, w, h: Math.max(1, box.h), x: clamp(box.x, 0, cols - w), y: Math.max(0, box.y) };
}

/**
 * Assenta as caixas com "gravidade": cada uma fica na coluna em que está, desce se bater em outra e sobe enquanto a linha de cima
 * estiver livre (tapa os buracos que dá, sem nunca mudar o tamanho de ninguém). `pinned` é o card que o usuário está segurando: fica
 * exatamente na célula dele e tira do lugar quem estiver lá (`from` é onde ele estava antes do gesto):
 * 1. o primeiro card que ele tira do lugar troca com ele, indo para o lugar que ele deixou, se couber lá;
 * 2. senão, se ele está sendo levado para baixo, o card encontrado tenta passar para cima dele;
 * 3. senão, o card é empurrado para baixo.
 */
export function settle(boxes: Box[], cols: number, pinned?: Box, from?: Box): Box[] {
  const placed: Box[] = [];
  const hits = (b: Box) => placed.some(p => overlaps(b, p));
  const pin = pinned && fit(pinned, cols);
  if (pin) placed.push(pin);
  const goingDown = !!pin && !!from && pin.y > from.y;
  const queue = inOrder(boxes.filter(b => b.id !== pin?.id)).map(b => fit(b, cols));
  /** O lugar que o card segurado deixou (só ao mover, não ao redimensionar), enquanto ninguém o ocupou. */
  const moved = !!from && !!pin && from.w === pin.w && from.h === pin.h && (from.x !== pin.x || from.y !== pin.y);
  let vacant: Point | null = moved ? { x: from!.x, y: from!.y } : null;
  for (const [i, box] of queue.entries()) {
    if (vacant && overlaps(box, pin!)) {
      const swap = fit({ ...box, ...vacant }, cols);
      // só troca se couber no lugar deixado sem esbarrar em ninguém (nem nos que ainda vão assentar)
      if (swap.x === vacant.x && !hits(swap) && !queue.slice(i + 1).some(o => overlaps(swap, o))) {
        placed.push(swap);
        vacant = null;
        continue;
      }
    }
    if (goingDown && overlaps(box, pin!) && box.y <= pin!.y) {
      const above = { ...box, y: pin!.y - box.h };
      if (above.y >= 0 && !hits(above)) box.y = above.y;
    }
    while (hits(box)) box.y++;
    while (box.y > 0 && !hits({ ...box, y: box.y - 1 })) box.y--;
    placed.push(box);
  }
  return placed;
}

/**
 * Leva o card `id` para `to` (célula e, se mudar, tamanho). Devolve o que fica na tela durante o gesto (`held`, com o card parado
 * exatamente em `to`) e onde tudo assenta quando ele for solto (`landed`). O card fica na célula escolhida pelo usuário (os outros
 * se acomodam em volta); só se ele for solto abaixo de todos os outros é que sobe até encostar no último, sem deixar linhas vazias.
 */
export function place(boxes: Box[], cols: number, id: string, to: Box): { held: Box[]; landed: Box[] } {
  const from = boxes.find(b => b.id === id);
  const held = settle(boxes, cols, { ...to, id }, from);
  const me = held.find(b => b.id === id)!;
  const bottom = rowsOf(held.filter(b => b.id !== id));
  const landed = me.y > bottom ? settle(held, cols, { ...me, y: bottom }, from) : held;
  return { held, landed };
}

/**
 * As caixas de uma largura de grade. Com posições guardadas para ela (`saved`), cada card volta para a célula dele e a gravidade
 * acerta o resto; card sem posição (recém-adicionado) vai para o primeiro lugar livre onde cabe. Se essa largura nunca foi editada,
 * os cards são despejados na ordem de leitura da largura de referência.
 */
export function resolve(items: Sized[], cols: number, saved?: Positions, reference?: Positions): Box[] {
  if (saved) {
    const known = settle(items.filter(i => saved[i.id]).map(i => ({ ...i, ...saved[i.id] })), cols);
    const fresh = items.filter(i => !saved[i.id]);
    for (const item of fresh) {
      const size = { w: clamp(item.w, 1, cols), h: Math.max(1, item.h) };
      known.push({ id: item.id, ...size, ...firstFree(known, cols, size) });
    }
    return known;
  }
  const from = reference ?? {};
  const rank = (id: string) => (from[id] ? from[id].y * 1000 + from[id].x : Infinity);
  return pack([...items].sort((a, b) => rank(a.id) - rank(b.id)), cols);
}

export function toPositions(boxes: Box[]): Positions {
  return Object.fromEntries(boxes.map(b => [b.id, { x: b.x, y: b.y }]));
}

/** Número de linhas ocupadas. */
export function rowsOf(boxes: Box[]): number {
  return Math.max(0, ...boxes.map(b => b.y + b.h));
}

/** Quantas células da área ocupada ficaram sem card. */
export function holes(boxes: Box[], cols: number): number {
  return rowsOf(boxes) * cols - boxes.reduce((t, b) => t + b.w * b.h, 0);
}

export function sameBoxes(a: Box[], b: Box[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map(x => [x.id, x]));
  return a.every(x => {
    const o = byId.get(x.id);
    return !!o && o.x === x.x && o.y === x.y && o.w === x.w && o.h === x.h;
  });
}
