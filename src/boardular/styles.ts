import { useInsertionEffect } from 'react';
import css from './boardular.css?inline';

/**
 * Põe os estilos da biblioteca na página uma vez só, quando o primeiro painel aparece: quem instala não precisa importar CSS nenhum.
 * Vão no fim do <head>, na camada `boardular` (declarada depois das camadas que a página já tiver, como as de um reset): o CSS da
 * página fora de camada, a `className` e o `style` continuam acima deles.
 */
export function useStyles() {
  useInsertionEffect(() => {
    if (document.querySelector('style[data-boardular]')) return;
    const el = document.createElement('style');
    el.setAttribute('data-boardular', '');
    el.textContent = css;
    document.head.appendChild(el);
  }, []);
}

/** O CSS da biblioteca em texto, para quem renderiza no servidor e quer pô-lo no <head> por conta própria. */
export const boardularCss = css;
