# Boardular

A modular dashboard for React. Declare your items as JSON (a title, the kind of information and the data) and Boardular picks how to display each one, builds the cards and lays them out on a grid. People using the dashboard can drag, resize, switch the display, remove and bring back cards; their layout is saved in the browser.

Four themes: **default** (flat light), **dark** (flat dark), **glass** (dark glass) and **clay** (light clay). The library's styles live in their own CSS cascade layer, so your CSS always wins.

> Português: [README.pt-BR.md](README.pt-BR.md)

## Install

```bash
npm install boardular
```

Requires React 18 or newer. `three`, `gsap` and `animejs` come along as dependencies. There is no CSS to import: the styles are added to the page by the first dashboard that renders.

To try it without publishing to npm: `npm pack` creates `boardular-0.1.0.tgz`; in your project run `npm install ../path/to/boardular-0.1.0.tgz`.

## Usage

```tsx
import { Boardular, type DashboardItem } from 'boardular';

const items: DashboardItem[] = [
  { title: 'Sales', type: 'stat', data: { value: 1280, delta: 4.2, hint: 'this month' } },
  { title: 'Sales by channel', type: 'breakdown', data: { Store: 520, Web: 610, App: 150 } },
  { title: 'Revenue', type: 'series', data: { labels: ['Jan', 'Feb', 'Mar'], lines: [{ label: 'USD', values: [10, 14, 12] }] } },
  { title: 'Customers', type: 'list', data: () => fetch('/api/customers').then(r => r.json()) },
];

export function Panel() {
  return <Boardular title="Store" theme="default" items={items} />;
}
```

### Kinds of information

| `type` | `data` accepts | Boardular picks |
|---|---|---|
| `stat` | a number, or `{ value, text?, hint?, delta?, money? }` | Number |
| `breakdown` | `{ label: value }`, or `[{ label, value, short?, color? }]` | 2 parts: split bar · up to 5: donut · more: horizontal bars |
| `series` | `{ labels, lines: [{ label, values, color? }] }` | 1 line or more than 12 points: lines · otherwise: grouped columns |
| `list` | `[{ id, title, detail?, badge?, cells? }]`, or `{ total, items, columns?, subtitle? }` | List (from a counter to a table, depending on the card size) |

The Portuguese names work too: `indicador`, `distribuicao`, `serie`, `lista`.

`data` can be the value itself, a `Promise`, or a function returning either. While it is pending, the card shows a loader. The function runs again whenever the `refresh` prop changes (a period filter, for example). When an item's data changes, only the affected cards reload, and numbers roll to their new value.

### Item fields

| Field | Purpose |
|---|---|
| `title` | Card title (required). |
| `type`, `data` | See above (required). |
| `display` | Forces a display (table below). Without it, the automatic choice applies. |
| `width`, `height` | Initial size in grid cells (4 columns, 160px rows). Clamped to the display's limits. |
| `className`, `style` | Class and style for the card, applied to the `.bd-card` element. |
| `id` | Identifies the item. Defaults to the title; repeated titles get a number. |
| `description` | Shown in the "Add element" catalog. |

Displays available in `display`:

| Type | Displays |
|---|---|
| `stat` | `indicador` |
| `breakdown` | `numero`, `linha-dividida`, `numeros`, `medidor`, `barras`, `meia-lua`, `rosca`, `pizza`, `aneis`, `colunas`, `mosaico`, `barras-3d` |
| `series` | `serie-numero`, `serie-colunas`, `serie-barras`, `serie-linha`, `serie-area` |
| `list` | `lista` |

They are: number, split bar, numbers side by side, gauge, horizontal bars, half donut, donut, pie, rings, columns, 10×10 mosaic and 3D bars; for series: total, grouped columns, stacked columns, lines and stacked areas. A display that doesn't exist for the type is ignored, with a console warning.

### Dashboard props

| Prop | Default | Purpose |
|---|---|---|
| `items` | — | The items, in the order they enter the grid. |
| `title`, `subtitle` | — | Dashboard header. |
| `theme` | `'default'` | `'default'`, `'dark'`, `'glass'` or `'clay'`. Applies to the whole page (set on `<html data-bd-tema>`; without the attribute, `default` applies). |
| `backdrop` | `true` | Paints the theme's background behind the page (the dotted page, the glass lights, the clay pastels). The glass theme needs color behind it to blur; with `false`, the background is yours. |
| `filters` | — | Controls placed in the header's filter strip. |
| `refresh` | — | When it changes, items whose `data` is a function are called again. |
| `className`, `style` | — | Class and style for the dashboard (the `.bd` element). |
| `id` | the title | Key for the layout saved in the browser. |

The saved layout (positions, sizes, switched displays) belongs to the set of items declared in code: if an item is added, removed, or changes display or size in code, the dashboard goes back to the default layout.

## Themes

| Theme | Look |
|---|---|
| `default` | Flat and solid: white cards, 1px slate borders, 12px radius, no shadows, parts touching with no gaps, on a dotted light gray page. Inter. |
| `dark` | The same flat style on graphite, with chart colors slightly desaturated so they don't glare. Inter. |
| `glass` | Smoked glass over colored lights. Parts are tinted glass with a thin bright rim. Inter. |
| `clay` | Pastel clay. Puffy parts sitting in carved tracks, pill shapes. Nunito. |

Load the fonts on your page (Google Fonts, for example); without them, system fonts are used.

## Your own styles

All of the library's CSS is inside `@layer boardular`. Unlayered CSS always beats a layer, so any rule of yours beats the library's, with no stronger selector or `!important` needed:

```css
.my-dashboard .bd-card__titulo { letter-spacing: 0; text-transform: none; }
.highlight-card { border: 2px solid gold; }
```

```tsx
<Boardular
  className="my-dashboard"
  items={[{ title: 'Revenue', type: 'stat', data: 98000, className: 'highlight-card', style: { borderRadius: 4 } }]}
/>
```

Each theme can be fine-tuned through the dashboard's CSS variables, such as `--bd-g-vao` (the gap between parts), `--bd-g-espessura` (bar thickness) or `--bd-g-trilho` (the empty track color):

```css
.my-dashboard { --bd-g-espessura: 14px; }
```

If your page uses cascade layers (Tailwind v4, for example), classes from those layers don't beat the library: use unlayered CSS, `style`, or Tailwind's `!` modifier.

For server rendering, the CSS is exported as `boardularCss` (a string), so you can put it in the `<head>` yourself.

## Advanced API

`<Boardular>` is built on `<Dashboard>`, which is also exported. It takes hand-written sources (`sources`, loaded on demand, which may live only in the catalog) and a factory layout (`preset`):

```tsx
import { Dashboard, pack, toPositions, type Source, type Widget } from 'boardular';

const sources: Source[] = [{ id: 'sales', title: 'Sales', kind: 'stat', load: () => ({ value: 128 }) }];
const widgets: Widget[] = [{ id: 'a', source: 'sales', view: 'indicador', w: 1, h: 1 }];

<Dashboard id="store" title="Store" sources={sources} preset={{ widgets, positions: toPositions(pack(widgets, 4)) }} />;
```

Also exported: `autoView` (the display Boardular would pick), `toSources` and `toPreset` (what `<Boardular>` does with the items), `VIEWS` (the display catalog) and the grid functions (`pack`, `place`…).

## Development

```bash
npm install
npm run dev          # demo at http://localhost:5180 (one card per display)
npm test             # grid and item tests
npm run build        # library in dist/ (ESM, CommonJS and types)
npm run build:demo   # demo in dist-demo/ (static site)
npm pack             # the .tgz package, as it would be on npm
```

| Part | File | Role |
|---|---|---|
| Items | `src/boardular/items.ts` and `Boardular.tsx` | JSON items become sources and layout: display choice, sizes, ids, short data formats. Tested in `items.test.ts`. |
| Geometry | `src/boardular/layout.ts` | Pure functions: the dashboard is a queue of cards poured into the grid (each in the first free cell); leftover space is covered by stretching neighbors. Tested in `layout.test.ts`. |
| State | `src/boardular/useDashboard.ts` | Cards and positions per column count, saved in `localStorage` (`boardular:<id>`). |
| Grid | `src/boardular/Dashboard.tsx` | Header, edit strip, grid, drag and resize, page entrance. |
| Pieces | `src/boardular/pieces.tsx` | Rolling numbers, marquee text, tooltip, card frame, per-theme chart filters. |
| Displays | `src/boardular/views.tsx` and `views/` | Registry of displays per data shape. |
| Catalog | `src/boardular/AddDialog.tsx` | Picks the information and the display, previewing real data; also switches a card's display (pencil). |
| Styles | `src/boardular/boardular.css` and `styles.ts` | All CSS, in the `boardular` layer, added to the page once. |
| Demo | `src/demo/` | Made-up data from a fictional bike-sharing network ("Pedala"), with period and theme filters. |

The grid has 4 columns from 1000px wide, 2 from 600px and 1 below that; each row is 160px tall. Each width keeps its own queue; one never edited follows the widest.

A new display is a component that receives `{ data, title, size }` and renders a `<Frame>`, plus an entry in `VIEWS`.

The source code (comments, CSS class names, theme and display ids) is written in Portuguese.

## Motion

- **GSAP**: `Draggable` for dragging cards and the eight resize handles; cards sliding into place (220 ms); the edit strip; chart geometry transitions when data changes; 3D bar hover.
- **CSS and Web Animations**: page entrance (blocks rise in sequence), each card's content entrance when it scrolls into view, rolling numbers, marquee text, wobbling cards in edit mode, hover.
- **Anime.js**: staggered entrance of the catalog options.
- **Three.js**: the "3D bars" display, loaded on demand.

With `prefers-reduced-motion`, nothing animates.

## Keyboard (edit mode)

With a card focused: arrow keys move it earlier or later in the queue, Shift + arrows resize it, Delete removes it. Esc or Enter finish editing.

## License

Boardular is [MIT](LICENSE). Its dependencies are installed from npm under their own licenses and are not bundled into the package:

- `three`, `animejs` (and `react`, as a peer): MIT.
- `gsap` (including `Draggable` and `CustomEase`): GSAP's [Standard "no charge" license](https://gsap.com/standard-license), free for commercial use. It is not an open source license: it forbids using GSAP in no-code visual animation builders that compete with Webflow. A regular dashboard is fine; if you build such a tool on top of Boardular, check GSAP's terms first.
