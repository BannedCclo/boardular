# Boardular

Biblioteca React de painel (dashboard). Você declara os itens em JSON — título, tipo de informação e dados — e a biblioteca escolhe a forma de exibir cada um, monta os cards e os arruma na grade. Quem usa o painel pode arrastar, redimensionar, trocar a forma, tirar e devolver cards; a personalização fica guardada no navegador.

Quatro temas: **default** (claro, chapado; o de fábrica), **dark** (grafite, chapado), **glass** (escuro, translúcido) e **clay** (claro, estufado). Os estilos da biblioteca ficam numa camada CSS própria, então o seu CSS sempre vence.

## Instalar

```bash
npm install boardular
```

Precisa de React 18 ou mais novo. `three`, `gsap` e `animejs` vêm junto como dependências. Não há CSS para importar: os estilos entram na página sozinhos quando o primeiro painel aparece.

A interface do painel (modo de edição, catálogo, mensagens de carregamento e de erro) é em português, e os números usam o formato `pt-BR`; `money: true` mostra reais (R$). Ainda não há opção de idioma.

O pacote traz builds ESM e CommonJS, com tipos. A forma "Barras 3D" carrega o `three` sob demanda (cerca de 140 kB com gzip), só quando algum card a usa.

## Usar

```tsx
import { Boardular, type DashboardItem } from 'boardular';

const itens: DashboardItem[] = [
  { title: 'Vendas', type: 'indicador', data: { value: 1280, delta: 4.2, hint: 'no mês' } },
  { title: 'Vendas por canal', type: 'distribuicao', data: { Loja: 520, Site: 610, App: 150 } },
  { title: 'Faturamento', type: 'serie', data: { labels: ['jan', 'fev', 'mar'], lines: [{ label: 'R$', values: [10, 14, 12] }] } },
  { title: 'Clientes', type: 'lista', data: () => fetch('/api/clientes').then(r => r.json()) },
];

export function Painel() {
  return <Boardular title="Loja" theme="default" items={itens} />;
}
```

### Tipos de informação

| `type` | `data` aceita | A biblioteca escolhe |
|---|---|---|
| `indicador` | um número, ou `{ value, text?, hint?, delta?, money? }` | Número |
| `distribuicao` | `{ rótulo: valor }`, ou `[{ label, value, short?, color? }]` | 2 partes: linha dividida · até 5: rosca · mais: barras horizontais |
| `serie` | `{ labels, lines: [{ label, values, color? }] }` | 1 linha ou mais de 12 pontos: linhas · senão: colunas lado a lado |
| `lista` | `[{ id, title, detail?, badge?, cells? }]`, ou `{ total, items, columns?, subtitle? }` | Lista (do contador à tabela, conforme o tamanho) |

Os nomes em inglês também valem: `stat`, `breakdown`, `series`, `list`.

`data` pode ser o valor, uma `Promise` ou uma função que devolve um ou outro. Enquanto ela não resolve, o card mostra o carregando. Se falhar, o card mostra uma mensagem com um botão de tentar de novo e o erro vai para o console. A função é chamada de novo sempre que a prop `refresh` muda (por exemplo, um filtro de período). Se os dados de um item mudarem, só os cards afetados recarregam e os números giram até o valor novo.

### Cada item

| Campo | Para quê |
|---|---|
| `title` | Título do card (obrigatório). |
| `type`, `data` | Veja acima (obrigatórios). |
| `display` | Força uma forma de exibição (tabela abaixo). Sem ele, vale a escolha automática. |
| `width`, `height` | Tamanho inicial em células da grade (4 colunas de 160px de altura). Respeita os limites da forma. |
| `className`, `style` | Classe e estilo do card, aplicados no elemento `.bd-card`. |
| `id` | Identifica o item. Sem ele vale o título; títulos repetidos ganham número. |
| `description` | Aparece no catálogo de "Adicionar elemento". |

Formas disponíveis em `display`:

| Tipo | Formas |
|---|---|
| `indicador` | `indicador` |
| `distribuicao` | `numero`, `linha-dividida`, `numeros`, `medidor`, `barras`, `meia-lua`, `rosca`, `pizza`, `aneis`, `colunas`, `mosaico`, `barras-3d` |
| `serie` | `serie-numero`, `serie-colunas`, `serie-barras`, `serie-linha`, `serie-area` |
| `lista` | `lista` |

Uma forma que não existe para o tipo é ignorada, com um aviso no console.

### O painel

| Prop | Padrão | Para quê |
|---|---|---|
| `items` | — | Os itens, na ordem em que entram na grade. |
| `title`, `subtitle` | — | Cabeçalho do painel. |
| `theme` | `'default'` | `'default'`, `'dark'`, `'glass'` ou `'clay'`. Vale para a página toda (fica em `<html data-bd-tema>`). |
| `backdrop` | `true` | Desenha atrás da página o fundo do tema. O `glass` precisa de cor por trás para desfocar; com `false`, o fundo é seu. |
| `filters` | — | Controles na faixa de filtros do cabeçalho. |
| `refresh` | — | Quando muda, os itens com `data` em função são chamados de novo. |
| `className`, `style` | — | Classe e estilo do painel (elemento `.bd`). |
| `id` | o título | Chave da personalização guardada no navegador. |

A personalização (posições, tamanhos, formas trocadas) vale para o conjunto de itens declarado: se um item entra, sai ou muda de forma ou de tamanho no código, o painel volta ao layout padrão.

## Estilos próprios

Todo o CSS da biblioteca está em `@layer boardular`. CSS fora de camada sempre vence uma camada, então qualquer regra sua vence a da biblioteca, sem seletor mais forte nem `!important`:

```css
.meu-painel .bd-card__titulo { letter-spacing: 0; text-transform: none; }
.card-destaque { border: 2px solid gold; }
```

```tsx
<Boardular
  className="meu-painel"
  items={[{ title: 'Receita', type: 'indicador', data: 98000, className: 'card-destaque', style: { borderRadius: 4 } }]}
/>
```

Ajustes finos de cada tema podem ir pelas variáveis CSS do painel, por exemplo `--bd-g-vao` (o vão entre partes), `--bd-g-espessura` (a espessura das barras) ou `--bd-g-trilho` (a cor do trilho vazio):

```css
.meu-painel { --bd-g-espessura: 14px; }
```

Se a página usa camadas CSS (o Tailwind v4, por exemplo), as classes dessas camadas não vencem a biblioteca: use CSS fora de camada, `style` ou o modificador `!` do Tailwind.

As fontes do tema são Inter (`default`, `dark` e `glass`) e Nunito (`clay`). Carregue-as na sua página (Google Fonts, por exemplo); sem elas, valem as fontes do sistema.

Para renderizar no servidor, o CSS está em `boardularCss` (texto), para pôr no `<head>` por conta própria.

## API avançada

O `<Boardular>` é montado sobre o `<Dashboard>`, que também é exportado. Ele recebe as fontes (`sources`, carregadas sob demanda e que podem ficar só no catálogo) e o layout de fábrica (`preset`) escritos à mão:

```tsx
import { Dashboard, pack, toPositions, type Source, type Widget } from 'boardular';

const sources: Source[] = [{ id: 'vendas', title: 'Vendas', kind: 'stat', load: () => ({ value: 128 }) }];
const widgets: Widget[] = [{ id: 'a', source: 'vendas', view: 'indicador', w: 1, h: 1 }];

<Dashboard id="loja" title="Loja" sources={sources} preset={{ widgets, positions: toPositions(pack(widgets, 4)) }} />;
```

Também são exportados: `autoView` (a forma que a biblioteca escolheria), `toSources` e `toPreset` (o que o `<Boardular>` faz com os itens), `VIEWS` (o catálogo de formas) e as funções da grade (`pack`, `place`…).

## Desenvolver

```bash
npm install
npm run dev          # demonstração em http://localhost:5180 (um card de cada forma)
npm test             # testes da grade e dos itens
npm run build        # biblioteca em dist/ (ESM, CommonJS e tipos)
npm run build:demo   # demonstração em dist-demo/ (site estático)
npm pack             # o pacote .tgz, como ficaria no npm
```

| Parte | Arquivo | Papel |
|---|---|---|
| Itens | `src/boardular/items.ts` e `Boardular.tsx` | Os itens em JSON viram fontes e layout: escolha da forma, tamanhos, ids, formatos curtos dos dados. Testada em `items.test.ts`. |
| Geometria | `src/boardular/layout.ts` | Funções puras: o painel é uma fila de cards despejada na grade (cada um na primeira célula livre); o que sobra é coberto esticando os vizinhos. Testada em `layout.test.ts`. |
| Estado | `src/boardular/useDashboard.ts` | Cards e posições por número de colunas, guardados em `localStorage` (`boardular:<id>`). |
| Grade | `src/boardular/Dashboard.tsx` | Cabeçalho, faixa de edição, grade, arrastar e redimensionar, entrada da página. |
| Peças | `src/boardular/pieces.tsx` | Número em roleta, texto rolante, balão de dica, moldura do card, filtros de luz dos gráficos por tema. |
| Formas | `src/boardular/views.tsx` e `views/` | Registro das formas de exibição por formato de dado. |
| Catálogo | `src/boardular/AddDialog.tsx` | Escolha da informação e da forma, com prévia dos dados reais; também troca a forma de um card (lápis). |
| Estilos | `src/boardular/boardular.css` e `styles.ts` | Todo o CSS, na camada `boardular`, posto na página uma vez. |
| Demo | `src/demo/` | Dados inventados de uma rede fictícia de bicicletas ("Pedala"), com filtro de período e de tema. |

A grade tem 4 colunas a partir de 1000px de largura, 2 a partir de 600px e 1 abaixo disso; cada célula tem 160px de altura. Cada largura guarda a sua fila; a que nunca foi editada segue a da mais larga.

Forma nova: um componente que recebe `{ data, title, size }` e usa `<Frame>`, mais uma entrada em `VIEWS`.

## Movimento

- **GSAP**: `Draggable` para arrastar os cards e puxar as oito alças de redimensionar; o deslizar dos cards para o lugar novo (220 ms); a faixa de edição; a transição da geometria dos gráficos quando os dados mudam.
- **CSS e Web Animations**: entrada da página (blocos sobem em sequência), entrada do conteúdo de cada card quando ele aparece na tela, número em roleta, texto rolante, vibração dos cards em edição, hover.
- **Anime.js**: entrada escalonada das opções do catálogo.
- **Three.js**: a forma "Barras 3D", carregada sob demanda.

Com `prefers-reduced-motion` nada anima.

## Teclado (modo de edição)

Com o card em foco: setas levam o card para antes ou depois na fila, Shift + setas redimensionam, Delete remove. Esc ou Enter concluem a edição.

## Licença

O Boardular é [MIT](LICENSE). As dependências vêm do npm com as licenças delas e não são embutidas no pacote:

- `three`, `animejs` (e `react`, como peer): MIT.
- `gsap` (incluindo `Draggable` e `CustomEase`): [licença padrão "sem custo" da GSAP](https://gsap.com/standard-license), gratuita inclusive para uso comercial. Não é uma licença open source: ela proíbe usar o GSAP em ferramentas de animação visual sem código que concorram com o Webflow. Um painel comum está liberado; se você for montar uma ferramenta desse tipo em cima do Boardular, confira antes os termos da GSAP.
