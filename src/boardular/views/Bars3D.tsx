import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { calm, formatNumber, secs, toParts } from '../motion';
import { FLAT_THEMES, Frame, hideTip, showTip, useTheme } from '../pieces';
import type { Slice, ViewProps } from '../types';

/** Os 8 vértices de uma caixa (as quinas dela), para ressaltá-los com um ponto. */
function cornersOf(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const at: number[] = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) at.push(x, y, z);
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(at, 3));
}

/** Um ponto redondo e de borda macia (o ponto padrão do WebGL é quadrado). */
function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#fff');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** Barras em 3D (Three.js) que giram devagar; carregada sob demanda para o Three.js não pesar em quem não usa esta forma. */
export default function Bars3D({ data, title }: ViewProps<Slice[]>) {
  const host = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => toParts(data), [data]);
  const theme = useTheme();
  const clay = theme === 'clay';
  /** padrão e escuro: blocos chapados, opacos e foscos, sem arestas acesas */
  const flat = FLAT_THEMES.includes(theme);
  const dark = theme === 'dark';
  const solid = clay || flat;
  /** A barra em destaque: pelo mouse em cima dela ou na legenda. */
  const [focus, setFocus] = useState<number | null>(null);
  /** Aplica o destaque na cena (definida pelo efeito que monta a cena; muda quando a cena é refeita). */
  const highlight = useRef<(i: number | null) => void>(() => {});

  useEffect(() => {
    const el = host.current;
    if (!el || !parts.length) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const span = parts.length * 1.25;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 4.4, 5.5 + span);
    camera.lookAt(0, 1.5, 0);

    // argila: luz farta e difusa, sem brilho; vidro: luz mais baixa para a cor própria (emissiva) das barras acender no escuro
    // chapados: luz difusa neutra (cinza-azulado por baixo), como as partes sem relevo dos gráficos 2D
    scene.add(
      clay
        ? new THREE.HemisphereLight(0xffffff, 0xb9a8ee, 2.1)
        : flat
          ? new THREE.HemisphereLight(0xffffff, dark ? 0x1e2530 : 0xcbd5e1, dark ? 1.7 : 2)
          : new THREE.AmbientLight(0xffffff, 0.9)
    );
    const sun = new THREE.DirectionalLight(0xffffff, clay ? 1.6 : flat ? 1.2 : 2.4);
    sun.position.set(4, 8, 6);
    scene.add(sun);

    const group = new THREE.Group();
    group.rotation.y = -0.55;
    scene.add(group);

    const [gridMain, gridLine] = clay ? [0xc4b8ea, 0xdcd4f2] : flat ? (dark ? [0x3d444d, 0x2f3742] : [0xcbd5e1, 0xe2e8f0]) : [0x5d6280, 0x34374b];
    const grid = new THREE.GridHelper(span + 1.5, parts.length + 2, gridMain, gridLine);
    group.add(grid);

    const max = Math.max(...parts.map(p => p.value), 1);
    // cada barra tem a geometria da altura final (a quina arredondada da argila não estica); a base fica no chão, então escalar em Y
    // de 0 a 1 faz a barra crescer para cima
    const geometries = parts.map(p => {
      const h = 0.15 + (p.value / max) * 3.2;
      const g = clay ? new RoundedBoxGeometry(0.9, h, 0.9, 5, 0.22) : new THREE.BoxGeometry(0.9, h, 0.9);
      g.translate(0, h / 2, 0);
      return g;
    });
    const material = (color: string) => {
      const c = new THREE.Color(color);
      if (flat) {
        // no escuro, a cor perde saturação e brilho como as dos gráficos 2D (saturate(0,55) brightness(0,9))
        if (dark) {
          const hsl = { h: 0, s: 0, l: 0 };
          c.getHSL(hsl);
          c.setHSL(hsl.h, hsl.s * 0.55, hsl.l * 0.9);
        }
        return new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, transparent: true, opacity: 1 });
      }
      return clay
        ? new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.12), roughness: 0.9, metalness: 0, transparent: true, opacity: 1 })
        : // bloco de vidro colorido: translúcido dos dois lados (as faces de trás aparecem através do vidro), liso e com verniz para
          // o reflexo; quase sem luz própria (só o bastante para a cor não sumir no escuro)
          new THREE.MeshPhysicalMaterial({
            color: c,
            emissive: c,
            emissiveIntensity: 0.1,
            roughness: 0.15,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
    };
    // vidro: as arestas e os vértices ressaltados, como o aro claro das partes em 2D. São filhos da barra, então crescem com ela
    const extras: { dispose: () => void }[] = [];
    const rims: { line: THREE.LineBasicMaterial; dots: THREE.PointsMaterial }[] = [];
    const dot = solid ? null : dotTexture();
    const bars = parts.map((p, i) => {
      const bar = new THREE.Mesh(geometries[i], material(p.color));
      bar.position.x = (i - (parts.length - 1) / 2) * 1.25;
      bar.scale.y = 0.001;
      if (!solid) {
        const rim = new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.55);
        const edges = new THREE.EdgesGeometry(geometries[i]);
        const lineMat = new THREE.LineBasicMaterial({ color: rim, transparent: true, opacity: 0.9, depthWrite: false });
        const lines = new THREE.LineSegments(edges, lineMat);
        lines.renderOrder = 1;
        bar.add(lines);
        const corners = cornersOf(geometries[i]);
        const pointMat = new THREE.PointsMaterial({ color: rim.clone().lerp(new THREE.Color(0xffffff), 0.5), size: 5, sizeAttenuation: false, map: dot, transparent: true, alphaTest: 0.1, depthWrite: false });
        const points = new THREE.Points(corners, pointMat);
        points.renderOrder = 2;
        bar.add(points);
        extras.push(edges, lineMat, corners, pointMat);
        rims[i] = { line: lineMat, dots: pointMat };
      }
      group.add(bar);
      return bar;
    });

    const grow = gsap.to(
      bars.map(b => b.scale),
      { y: 1, duration: secs(1.2), ease: 'elastic.out(1, 0.75)', stagger: secs(0.09) }
    );

    // destaque: a barra sobe um pouco e engorda; as outras esmaecem (como nos outros gráficos). O giro para enquanto há destaque,
    // para a barra não fugir do mouse
    const base = solid ? 1 : 0.4;
    let held: number | null = null;
    highlight.current = i => {
      held = i;
      const t = secs(0.22);
      bars.forEach((bar, k) => {
        const on = k === i;
        const dim = i !== null && !on;
        gsap.to(bar.position, { y: on ? 0.16 : 0, duration: t, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(bar.scale, { x: on ? 1.08 : 1, z: on ? 1.08 : 1, duration: t, ease: 'power2.out', overwrite: false });
        gsap.to(bar.material as THREE.Material, { opacity: dim ? base * 0.35 : on && !solid ? 0.55 : base, duration: t, overwrite: 'auto' });
        if (rims[k]) {
          gsap.to(rims[k].line, { opacity: dim ? 0.25 : 0.9, duration: t, overwrite: 'auto' });
          gsap.to(rims[k].dots, { opacity: dim ? 0.25 : 1, duration: t, overwrite: 'auto' });
        }
      });
    };

    // o mouse sobre a cena: a barra sob ele (pelo raio da câmera) fica em destaque e mostra a dica
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(bars, false)[0];
      const i = hit ? bars.findIndex(b => b === hit.object) : -1;
      if (i >= 0) {
        if (held !== i) setFocus(i);
        if (e.pointerType !== 'touch') showTip({ label: parts[i].label, value: parts[i].value, pct: parts[i].pct, color: parts[i].color }, e.clientX, e.clientY);
      } else {
        if (held !== null) setFocus(null);
        hideTip();
      }
    };
    const onLeave = () => {
      setFocus(null);
      hideTip();
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    const still = calm();
    let frame = 0;
    const draw = () => {
      if (!still && held === null) group.rotation.y += 0.0035;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    const fit = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    draw();

    return () => {
      highlight.current = () => {};
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      hideTip();
      gsap.killTweensOf(bars.flatMap(b => [b.position, b.scale, b.material]));
      cancelAnimationFrame(frame);
      observer.disconnect();
      grow.kill();
      geometries.forEach(g => g.dispose());
      bars.forEach(b => (b.material as THREE.Material).dispose());
      extras.forEach(x => x.dispose());
      dot?.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [parts, theme]);

  useEffect(() => highlight.current(focus), [focus, parts, theme]);

  return (
    <Frame form="barras-3d" title={title}>
      <div className="bd-3d" ref={host} role="img" aria-label={parts.map(p => `${p.label}: ${formatNumber(p.value)}`).join(', ')} />
      <ul className="bd-legenda-serie" onMouseLeave={() => setFocus(null)}>
        {parts.map((p, i) => (
          <li key={p.label} className={focus !== null && focus !== i ? 'is-apagado' : undefined} onMouseEnter={() => setFocus(i)}>
            <i className="bd-bolinha" style={{ color: p.color }} />
            {p.label}
          </li>
        ))}
      </ul>
    </Frame>
  );
}
