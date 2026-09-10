import './style.css';
import { games } from './games';
import { GameHost } from './shell/GameHost';
import { renderMenu } from './menu/Menu';

const app = document.querySelector<HTMLDivElement>('#app')!;

// DOM scaffold: a menu overlay, the 3D stage, and a floating back button.
const menu = document.createElement('div');
menu.id = 'menu';

const stage = document.createElement('div');
stage.id = 'stage';
stage.hidden = true;

const back = document.createElement('button');
back.id = 'back-button';
back.textContent = '← Menu';
back.hidden = true;

app.append(menu, stage, back);

const host = new GameHost(stage, back, () => {
  menu.hidden = false;
  renderMenu(menu, games, (def) => {
    menu.hidden = true;
    host.startGame(def);
  });
});

host.showMenu();
