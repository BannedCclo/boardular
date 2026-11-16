import { useCallback, useEffect, useMemo, useState } from 'react';
import { toPositions, type Box, type Positions } from './layout';
import type { Preset, Widget } from './types';

/** O que o usuário personalizou: os cards e a posição de cada um por número de colunas da grade. */
export interface DashboardState {
  widgets: Widget[];
  layouts: Record<number, Positions>;
}

const VERSION = 2;
const keyOf = (id: string) => `boardular:${id}`;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** As cores guardadas de um card, se houver alguma válida. */
function cleanColors(colors: unknown): { colors?: Record<string, string> } {
  if (!colors || typeof colors !== 'object') return {};
  const valid = Object.entries(colors).filter(([label, color]) => isText(label) && isText(color));
  return valid.length ? { colors: Object.fromEntries(valid) } : {};
}

/** Lê o que está guardado, jogando fora o que não tiver a forma esperada. */
function read(id: string): DashboardState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(keyOf(id)) ?? 'null');
    if (!raw || raw.v !== VERSION || !Array.isArray(raw.widgets)) return null;
    const widgets: Widget[] = raw.widgets
      .filter((w: Widget) => w && isText(w.id) && isText(w.source) && isText(w.view) && isNum(w.w) && isNum(w.h))
      .map((w: Widget) => ({ id: w.id, source: w.source, view: w.view, w: w.w, h: w.h, ...cleanColors(w.colors) }));
    const layouts: Record<number, Positions> = {};
    for (const [cols, positions] of Object.entries(raw.layouts ?? {})) {
      const clean: Positions = {};
      for (const [wid, p] of Object.entries((positions ?? {}) as Positions)) {
        if (isNum(p?.x) && isNum(p?.y)) clean[wid] = { x: p.x, y: p.y };
      }
      if (Number.isInteger(+cols)) layouts[+cols] = clean;
    }
    return { widgets, layouts };
  } catch {
    return null;
  }
}

const fromPreset = (preset: Preset, cols: number): DashboardState => ({
  widgets: preset.widgets.map(w => ({ ...w })),
  layouts: { [cols]: { ...preset.positions } },
});

/**
 * Estado de um painel, guardado no `localStorage` com a chave `boardular:<id>`.
 * `presetCols` é o número de colunas para o qual as posições do `preset` foram desenhadas.
 */
export function useDashboard(id: string, preset: Preset, presetCols: number) {
  const [state, setState] = useState<DashboardState>(() => read(id) ?? fromPreset(preset, presetCols));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(keyOf(id), JSON.stringify({ v: VERSION, ...state }));
    } catch {
      // armazenamento cheio ou bloqueado: a personalização vale só nesta visita
    }
  }, [id, state]);

  const add = useCallback((source: string, view: string, size: { w: number; h: number }, colors?: Record<string, string>) => {
    const widget: Widget = { id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 3).toString(36)}`, source, view, ...size, ...cleanColors(colors) };
    setState(s => ({ ...s, widgets: [...s.widgets, widget] }));
    return widget.id;
  }, []);

  const remove = useCallback((widgetId: string) => {
    setState(s => ({
      widgets: s.widgets.filter(w => w.id !== widgetId),
      layouts: Object.fromEntries(Object.entries(s.layouts).map(([cols, p]) => [cols, Object.fromEntries(Object.entries(p).filter(([k]) => k !== widgetId))])),
    }));
  }, []);

  /** Guarda as posições da grade de `cols` colunas; `resized` é o card cujo tamanho mudou (o tamanho vale para todas as larguras). */
  const commit = useCallback((cols: number, boxes: Box[], resized?: string) => {
    setState(s => {
      const size = boxes.find(b => b.id === resized);
      return {
        widgets: size ? s.widgets.map(w => (w.id === size.id ? { ...w, w: size.w, h: size.h } : w)) : s.widgets,
        layouts: { ...s.layouts, [cols]: toPositions(boxes) },
      };
    });
  }, []);

  /** Troca a forma de exibição de um card (e o tamanho, que passa a ser o da forma nova). */
  const swap = useCallback((widgetId: string, view: string, size: { w: number; h: number }) => {
    setState(s => ({ ...s, widgets: s.widgets.map(w => (w.id === widgetId ? { ...w, view, ...size } : w)) }));
  }, []);

  /** Guarda as cores escolhidas para as partes de um card; sem nenhuma, o card volta às cores originais. */
  const recolor = useCallback((widgetId: string, colors: Record<string, string>) => {
    setState(s => ({
      ...s,
      widgets: s.widgets.map(w => {
        if (w.id !== widgetId) return w;
        const { colors: _old, ...rest } = w;
        return { ...rest, ...cleanColors(colors) };
      }),
    }));
  }, []);

  const reset = useCallback(() => setState(fromPreset(preset, presetCols)), [preset, presetCols]);

  /** O usuário mudou alguma coisa em relação ao painel de fábrica. */
  const customized = useMemo(() => {
    const queue = (p: Positions) => Object.keys(p).sort((a, b) => p[a].y - p[b].y || p[a].x - p[b].x).join('|');
    const factory = queue(preset.positions);
    return JSON.stringify(state.widgets) !== JSON.stringify(preset.widgets) || Object.values(state.layouts).some(p => queue(p) !== factory);
  }, [state, preset]);

  return { state, editing, setEditing, add, remove, commit, swap, recolor, reset, customized };
}
