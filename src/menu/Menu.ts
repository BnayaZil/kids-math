import type { GameDefinition } from '../shell/types';

/**
 * Draws the home menu of big colorful game cards into `container`.
 * Playable games are <button>s (keyboard + touch friendly); "coming soon"
 * entries (no `create` in the registry) render as disabled placeholder cards.
 */
export function renderMenu(
  container: HTMLElement,
  games: GameDefinition[],
  onPlay: (def: GameDefinition) => void,
) {
  container.innerHTML = '';

  const title = document.createElement('h1');
  title.className = 'menu-title';
  title.textContent = '🧮 Math Playground';
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  container.appendChild(grid);

  for (const def of games) {
    const playable = Boolean(def.create);
    const card = document.createElement(playable ? 'button' : 'div');
    card.className = 'game-card' + (playable ? '' : ' game-card--soon');
    card.style.setProperty('--card-color', def.color);

    const emoji = el('span', 'game-card__emoji', def.emoji);
    const name = el('span', 'game-card__title', def.title);
    const grade = el('span', 'game-card__grade', def.grade);
    card.append(emoji, name, grade);

    if (playable) {
      card.addEventListener('click', () => onPlay(def));
    } else {
      card.append(el('span', 'game-card__badge', 'Coming soon'));
    }
    grid.appendChild(card);
  }
}

function el(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
