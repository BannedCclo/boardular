import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { useEffect, useRef, useState } from 'react';
import type { Slice } from './types';

gsap.registerPlugin(CustomEase);

/** Curva padrão (acelera e freia) e curva de saída (chega rápido e assenta devagar). */
export const EASE_STANDARD = CustomEase.create('bd-padrao', '0.4, 0, 0.2, 1');
export const EASE_OUT = CustomEase.create('bd-saida', '0.16, 1, 0.3, 1');
export const CSS_EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const CSS_EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Duração (s) do deslizar dos cards e da entrada/saída de um card. */
export const SLIDE = 0.22;

/** Cores das partes sem cor própria: frias e distintas entre si. */
export const PALETTE = ['#4f46e5', '#0891b2', '#7c3aed', '#059669', '#2563eb', '#0d9488'];
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];
export const colorOf = (slice: { color?: string }, i: number) => slice.color ?? colorAt(i);

/** Verdadeiro quando o sistema pede menos movimento: as animações passam a durar zero. */
export const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const secs = (s: number) => (calm() ? 0 : s);

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatNumber = (v: number) => inteiro.format(v);
export const formatMoney = (v: number) => reais.format(v);

/** Percentuais inteiros que somam exatamente 100: os restos vão para as partes que mais perderam no arredondamento. */
export function wholePercents(values: number[]): number[] {
  const total = values.reduce((t, v) => t + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map(v => (Math.max(0, v) / total) * 100);
  const floor = exact.map(Math.floor);
  const order = exact.map((e, i) => i).sort((a, b) => exact[b] - floor[b] - (exact[a] - floor[a]));
  for (let k = 0, left = 100 - floor.reduce((t, v) => t + v, 0); left > 0; k++, left--) floor[order[k % order.length]]++;
  return floor;
}

export interface Part extends Slice {
  color: string;
  pct: number;
  /** Percentual acumulado antes desta parte. */
  start: number;
}

export function toParts(slices: Slice[]): Part[] {
  const pct = wholePercents(slices.map(s => s.value));
  let start = 0;
  return slices.map((s, i) => {
    const part = { ...s, color: colorOf(s, i), pct: pct[i], start };
    start += pct[i];
    return part;
  });
}

/**
 * Números de geometria (alturas, ângulos) que vão do que estava na tela até o novo em vez de pular: a cada mudança partem de onde
 * estiverem. A primeira exibição entra direto (a entrada do card tem a animação própria dela).
 */
export function useTweened(target: number[], seconds = 0.65): number[] {
  const [shown, setShown] = useState(target);
  const live = useRef(target);
  const key = target.join(',');

  useEffect(() => {
    const from = live.current;
    if (calm() || from.length !== target.length || from.join(',') === key) {
      live.current = target;
      setShown(target);
      return;
    }
    const progress = { t: 0 };
    const tween = gsap.to(progress, {
      t: 1,
      duration: seconds,
      ease: 'power3.out',
      onUpdate: () => {
        live.current = target.map((v, i) => from[i] + (v - from[i]) * progress.t);
        setShown(live.current);
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, seconds]);

  return shown.length === target.length ? shown : target;
}
