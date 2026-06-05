const DEFAULT_BASES = {
  hp: 100,
  atk: 100,
  def: 100,
  spa: 100,
  spd: 100,
  spe: 100,
};

const DEFAULT_EVS = {
  hp: 0,
  atk: 255,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 255,
};

const DEFAULT_TEAM = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

// 左侧输入顺序：攻击 → 特攻 → 防御 → 特防 → 速度 → 体力
const INPUT_DISPLAY_ORDER = ['atk', 'spa', 'def', 'spd', 'spe', 'hp'];

// 结果展示顺序：攻/防 → 特攻/特防 → 速度/体力
const RESULT_DISPLAY_ORDER = ['atk', 'def', 'spa', 'spd', 'spe', 'hp'];

// 战队加成顺序与右侧结果一致
const TEAM_DISPLAY_ORDER = RESULT_DISPLAY_ORDER;

const levelInput = document.getElementById('level');
const ivInput = document.getElementById('iv');
const natureSelect = document.getElementById('nature');
const annualCheckbox = document.getElementById('annual');
const hpBonusInput = document.getElementById('hp-bonus');
const statInputsBody = document.getElementById('stat-inputs');
const teamInputsBody = document.getElementById('team-inputs');
const evSummary = document.getElementById('ev-summary');
const baseSummary = document.getElementById('base-summary');
const resultsEl = document.getElementById('results');
const btnCalc = document.getElementById('btn-calc');
const btnReset = document.getElementById('btn-reset');

function initNatureSelect() {
  NATURES.forEach((nature, index) => {
    const option = document.createElement('option');
    option.value = String(index);

    if (nature.up) {
      const up = STAT_LABELS[nature.up];
      const down = STAT_LABELS[nature.down];
      option.textContent = `${nature.name}（+${up} -${down}）`;
    } else {
      option.textContent = `${nature.name}（平衡）`;
    }

    if (nature.name === '固执') option.selected = true;
    natureSelect.appendChild(option);
  });
}

function initStatInputs() {
  statInputsBody.innerHTML = '';

  INPUT_DISPLAY_ORDER.forEach((key) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="stat-name">${STAT_LABELS[key]}</td>
      <td>
        <input type="number" class="base-input" data-key="${key}" min="0" max="999" value="${DEFAULT_BASES[key]}" />
      </td>
      <td>
        <div class="ev-cell">
          <input type="number" class="ev-input" data-key="${key}" min="0" max="255" value="${DEFAULT_EVS[key]}" />
          <div class="ev-btns">
            <button type="button" class="btn-ev-ctrl btn-max-ev" data-key="${key}" title="拉满至255" aria-label="学习力拉满至255">
              <span class="icon-ev-ctrl icon-max-ev" aria-hidden="true"></span>
            </button>
            <button type="button" class="btn-ev-ctrl btn-min-ev" data-key="${key}" title="清零" aria-label="学习力清零">
              <span class="icon-ev-ctrl icon-min-ev" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </td>
    `;
    statInputsBody.appendChild(row);
  });
}

function initTeamInputs() {
  teamInputsBody.innerHTML = '';

  TEAM_DISPLAY_ORDER.forEach((key) => {
    const max = getTeamLimit(key);
    const item = document.createElement('div');
    item.className = 'team-field';
    item.innerHTML = `
      <span class="team-label">${STAT_LABELS[key]}</span>
      <div class="team-cell">
        <input type="number" class="team-input" data-key="${key}" min="0" max="${max}" value="${DEFAULT_TEAM[key]}" />
        <div class="ev-btns">
          <button type="button" class="btn-ev-ctrl btn-max-team" data-key="${key}" data-max="${max}" title="拉满至${max}" aria-label="战队加成拉满至${max}">
            <span class="icon-ev-ctrl icon-max-ev" aria-hidden="true"></span>
          </button>
          <button type="button" class="btn-ev-ctrl btn-min-team" data-key="${key}" title="清零" aria-label="战队加成清零">
            <span class="icon-ev-ctrl icon-min-ev" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    `;
    teamInputsBody.appendChild(item);
  });
}

function readBases() {
  const bases = {};
  document.querySelectorAll('.base-input').forEach((input) => {
    bases[input.dataset.key] = clamp(Number(input.value) || 0, 0, 999);
  });
  return bases;
}

function readEvs() {
  const evs = {};
  document.querySelectorAll('.ev-input').forEach((input) => {
    evs[input.dataset.key] = clamp(Number(input.value) || 0, 0, EV_LIMIT_PER_STAT);
  });
  return evs;
}

function readTeamBonuses() {
  const teamBonuses = {};
  document.querySelectorAll('.team-input').forEach((input) => {
    const key = input.dataset.key;
    teamBonuses[key] = clamp(Number(input.value) || 0, 0, getTeamLimit(key));
  });
  return teamBonuses;
}

function updateSummaries() {
  const evs = readEvs();
  const evTotal = Object.values(evs).reduce((sum, v) => sum + v, 0);
  const evOver = evTotal > EV_LIMIT_TOTAL;

  evSummary.innerHTML = `学习力总计：<strong class="${evOver ? 'warn' : ''}">${evTotal}</strong> / ${EV_LIMIT_TOTAL}`;
  if (evOver) {
    evSummary.innerHTML += ' <span class="warn-text">（超出上限）</span>';
  }

  const bases = readBases();
  const baseTotal = Object.values(bases).reduce((sum, v) => sum + v, 0);
  baseSummary.innerHTML = `种族值总和：<strong>${baseTotal}</strong>`;
}

function getMaxStat(stats) {
  return Math.max(...STAT_KEYS.map((k) => stats[k]));
}

function renderResults() {
  const bases = readBases();
  const evs = readEvs();
  const teamBonuses = readTeamBonuses();
  const iv = clamp(Number(ivInput.value) || 0, 0, 31);
  const level = clamp(Number(levelInput.value) || 1, 1, 100);
  const natureIndex = Number(natureSelect.value);
  const isAnnual = annualCheckbox.checked;
  const hpBonus = clamp(Number(hpBonusInput.value) || 0, 0, 999);
  const teamTotal = Object.values(teamBonuses).reduce((sum, v) => sum + v, 0);

  ivInput.value = iv;
  levelInput.value = level;
  hpBonusInput.value = hpBonus;

  const externalBonuses = typeof readExternalBonuses === 'function' ? readExternalBonuses() : null;

  const { stats, breakdown, nature, mods } = calcAllStats({
    bases,
    evs,
    iv,
    level,
    natureIndex,
    isAnnual,
    hpBonus,
    teamBonuses,
    externalBonuses,
  });

  const maxStat = getMaxStat(stats);

  resultsEl.innerHTML = RESULT_DISPLAY_ORDER.map((key) => {
    const value = stats[key];
    const pct = maxStat > 0 ? (value / maxStat) * 100 : 0;
    const bd = breakdown[key];
    const suggestEv = recommendEv(bases[key], iv, mods[key]);

    return `
      <article class="result-card" data-stat="${key}">
        <div class="result-head">
          <span class="result-label">${STAT_LABELS[key]}</span>
          <span class="result-value">${value}</span>
        </div>
        <div class="result-bar">
          <div class="result-bar-fill" style="width: ${pct}%"></div>
        </div>
        <ul class="result-detail">
          <li>种族贡献 <strong>${bd.basePart}</strong></li>
          <li>天赋贡献 <strong>+${bd.ivPart}</strong></li>
          <li>学习力贡献 <strong>+${bd.evPart}</strong></li>
          <li>性格修正 <strong>${bd.natureLabel}</strong></li>
          ${bd.annualBonus ? `<li>年费加成 <strong>+${bd.annualBonus}</strong></li>` : ''}
          ${bd.hpLimitBonus ? `<li>体力上限 <strong>+${bd.hpLimitBonus}</strong></li>` : ''}
          ${bd.teamBonus ? `<li>战队加成 <strong>+${bd.teamBonus}</strong></li>` : ''}
          ${bd.titleBonus ? `<li>称号加成 <strong>+${bd.titleBonus}</strong></li>` : ''}
          ${bd.suitBonus ? `<li>套装加成 <strong>+${bd.suitBonus}</strong></li>` : ''}
          ${bd.mintmarkBonus ? `<li>刻印加成 <strong>+${bd.mintmarkBonus}</strong></li>` : ''}
          ${level < 100 ? `<li class="hint">满级预估 <strong>${calcStat(key, bases[key], evs[key], iv, 100, mods[key]) + getExtraBonuses(key, { isAnnual, hpBonus, teamBonuses, externalBonuses })}</strong></li>` : ''}
          ${level === 100 && key !== 'hp' ? `<li class="hint">推荐学习力 <strong>${suggestEv}</strong></li>` : ''}
        </ul>
      </article>
    `;
  }).join('');

  const natureDesc = nature.up
    ? `${nature.name}：${STAT_LABELS[nature.up]} +10%，${STAT_LABELS[nature.down]} -10%`
    : `${nature.name}：无性格加成`;

  const extTotal = externalBonuses?.combined?.total || 0;
  const titleName = getSelectedTitle?.()?.name;
  const suitName = getSelectedSuit?.()?.name;
  const mintmarkCount = getSelectedMintmarks?.().filter(Boolean).length || 0;

  const bonusTags = [];
  if (titleName) bonusTags.push(`称号 ${titleName}`);
  if (suitName) bonusTags.push(`套装 ${suitName}`);
  if (mintmarkCount) bonusTags.push(`刻印 ×${mintmarkCount}`);

  resultsEl.insertAdjacentHTML(
    'afterbegin',
    `<div class="result-meta">
      <span>${natureDesc}</span>
      <span>等级 ${level} · 天赋 ${iv}${isAnnual ? ' · 年费' : ''}${hpBonus ? ` · 体力上限 +${hpBonus}` : ''}${teamTotal ? ` · 战队 +${teamTotal}` : ''}${extTotal ? ` · 额外 +${extTotal}` : ''}</span>
      ${bonusTags.length ? `<span class="result-meta-bonus">${bonusTags.join(' · ')}</span>` : ''}
    </div>`
  );
}

function bindEvents() {
  document.querySelectorAll('.ev-input').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = clamp(Number(input.value) || 0, 0, EV_LIMIT_PER_STAT);
      updateSummaries();
      renderResults();
    });
  });

  document.querySelectorAll('.base-input').forEach((input) => {
    input.addEventListener('input', () => {
      updateSummaries();
      renderResults();
    });
  });

  document.querySelectorAll('.team-input').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = clamp(Number(input.value) || 0, 0, getTeamLimit(input.dataset.key));
      renderResults();
    });
  });

  [levelInput, ivInput, hpBonusInput, natureSelect, annualCheckbox].forEach((el) => {
    el.addEventListener('input', renderResults);
    el.addEventListener('change', renderResults);
  });

  btnCalc.addEventListener('click', renderResults);

  statInputsBody.addEventListener('click', (e) => {
    const maxBtn = e.target.closest('.btn-max-ev');
    const minBtn = e.target.closest('.btn-min-ev');
    const btn = maxBtn || minBtn;
    if (!btn) return;

    const input = statInputsBody.querySelector(`.ev-input[data-key="${btn.dataset.key}"]`);
    if (input) {
      input.value = maxBtn ? EV_LIMIT_PER_STAT : 0;
      updateSummaries();
      renderResults();
    }
  });

  teamInputsBody.addEventListener('click', (e) => {
    const maxBtn = e.target.closest('.btn-max-team');
    const minBtn = e.target.closest('.btn-min-team');
    const btn = maxBtn || minBtn;
    if (!btn) return;

    const input = teamInputsBody.querySelector(`.team-input[data-key="${btn.dataset.key}"]`);
    if (input) {
      input.value = maxBtn ? Number(maxBtn.dataset.max) : 0;
      renderResults();
    }
  });

  window.addEventListener('bonus-change', renderResults);

  btnReset.addEventListener('click', () => {
    levelInput.value = 100;
    ivInput.value = 31;
    natureSelect.value = '0';
    annualCheckbox.checked = false;
    hpBonusInput.value = 0;
    const petSearch = document.getElementById('pet-search');
    if (petSearch) petSearch.value = '';
    if (typeof clearBonusPickers === 'function') clearBonusPickers();

    STAT_KEYS.forEach((key) => {
      document.querySelector(`.base-input[data-key="${key}"]`).value = DEFAULT_BASES[key];
      document.querySelector(`.ev-input[data-key="${key}"]`).value = DEFAULT_EVS[key];
      document.querySelector(`.team-input[data-key="${key}"]`).value = DEFAULT_TEAM[key];
    });

    updateSummaries();
    renderResults();
  });
}

initNatureSelect();
initStatInputs();
initTeamInputs();
bindEvents();
updateSummaries();
renderResults();
