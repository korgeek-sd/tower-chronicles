'use strict';
const appearances = [
  {
    "name": "니드호그",
    "image": "assets/characters/appearances/nidhogg-b1c83e95980a.webp"
  },
  {
    "name": "바하무트",
    "image": "assets/characters/appearances/bahamut-1d6c5c0f95eb.webp"
  },
  {
    "name": "바알",
    "image": "assets/characters/appearances/baal-ee4cbff74c2d.webp"
  },
  {
    "name": "인형술사",
    "image": "assets/characters/appearances/puppeteer-fe0b553bd351.webp"
  },
  {
    "name": "이름 잃은 왕",
    "image": "assets/characters/appearances/nameless_king-c1e29c1d92c7.webp"
  },
  {
    "name": "첫 번째 잊혀진 자",
    "image": "assets/characters/appearances/first_forgotten_one-24d4c8b0a66f.webp"
  },
  {
    "name": "거짓 구원자",
    "image": "assets/characters/appearances/false_savior-371e2b23fc8c.webp"
  }
];
const initialBalances = [1,2,0,1,1,4,0];
const get = id => document.getElementById(id);
let balances, selected, tickets;
const buttons = appearances.map((appearance,index) => {
  const button = document.createElement('button');
  button.className = 'portrait';
  button.setAttribute('aria-label',appearance.name);
  button.title = appearance.name;
  const image = new Image();
  image.src = appearance.image;
  image.alt = '';
  button.append(image);
  button.onclick = () => { selected = index; render(); };
  get('choices').append(button);
  return button;
});
function render(message = '실험용 선택권 · 실제 계정에 반영되지 않습니다.') {
  const appearance = appearances[selected];
  const current = balances[selected];
  get('hero').src = appearance.image;
  get('name').textContent = appearance.name;
  get('stock').textContent = tickets+'장';
  get('balance').textContent = tickets ? current+' → '+(current+3) : current+'개';
  get('unlock').textContent = current>=5 ? '해금 가능' : tickets && current+3>=5 ? '수령 후 해금 가능' : '';
  get('claim').disabled = tickets===0;
  buttons.forEach((button,index) => button.setAttribute('aria-pressed',String(index===selected)));
  get('notice').textContent = message;
}
function reset() {
  balances = [...initialBalances];
  tickets = 10;
  selected = 1;
  render();
}
get('reset').onclick = reset;
get('claim').onclick = () => {
  if (tickets===0) return;
  tickets--;
  balances[selected]+=3;
  render(appearances[selected].name+' 조각 3개 수령 · 현재 '+balances[selected]+'개');
};
reset();
