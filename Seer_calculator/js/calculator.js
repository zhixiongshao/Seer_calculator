// 公式与性格修正表对齐 4399 官方计算器 getResult2
// https://news.4399.com/seer/jsq/

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const STAT_LABELS = {
  hp: '体力',
  atk: '攻击',
  def: '防御',
  spa: '特攻',
  spd: '特防',
  spe: '速度',
};

// 4399 种族值/努力值顺序：体力, 攻击, 防御, 特攻, 特防, 速度
const RACE_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// 性格顺序与 4399 一致；mods = [攻击, 防御, 特攻, 特防, 速度] 修正系数
const NATURES = [
  { name: '固执', up: 'atk', down: 'spa', mods: [1.1, 1.0, 0.9, 1.0, 1.0] },
  { name: '孤独', up: 'atk', down: 'def', mods: [1.1, 0.9, 1.0, 1.0, 1.0] },
  { name: '调皮', up: 'atk', down: 'spd', mods: [1.1, 1.0, 1.0, 0.9, 1.0] },
  { name: '勇敢', up: 'atk', down: 'spe', mods: [1.1, 1.0, 1.0, 1.0, 0.9] },
  { name: '保守', up: 'spa', down: 'atk', mods: [0.9, 1.0, 1.1, 1.0, 1.0] },
  { name: '稳重', up: 'spa', down: 'def', mods: [1.0, 0.9, 1.1, 1.0, 1.0] },
  { name: '马虎', up: 'spa', down: 'spd', mods: [1.0, 1.0, 1.1, 0.9, 1.0] },
  { name: '冷静', up: 'spa', down: 'spe', mods: [1.0, 1.0, 1.1, 1.0, 0.9] },
  { name: '胆小', up: 'spe', down: 'atk', mods: [0.9, 1.0, 1.0, 1.0, 1.1] },
  { name: '开朗', up: 'spe', down: 'spa', mods: [1.0, 1.0, 0.9, 1.0, 1.1] },
  { name: '急躁', up: 'spe', down: 'def', mods: [1.0, 0.9, 1.0, 1.0, 1.1] },
  { name: '天真', up: 'spe', down: 'spd', mods: [1.0, 1.0, 1.0, 0.9, 1.1] },
  { name: '大胆', up: 'def', down: 'atk', mods: [0.9, 1.1, 1.0, 1.0, 1.0] },
  { name: '顽皮', up: 'def', down: 'spa', mods: [1.0, 1.1, 0.9, 1.0, 1.0] },
  { name: '无虑', up: 'def', down: 'spd', mods: [1.0, 1.1, 1.0, 0.9, 1.0] },
  { name: '悠闲', up: 'def', down: 'spe', mods: [1.0, 1.1, 1.0, 1.0, 0.9] },
  { name: '沉着', up: 'spd', down: 'atk', mods: [0.9, 1.0, 1.0, 1.1, 1.0] },
  { name: '慎重', up: 'spd', down: 'spa', mods: [1.0, 1.0, 0.9, 1.1, 1.0] },
  { name: '温顺', up: 'spd', down: 'def', mods: [1.0, 0.9, 1.0, 1.1, 1.0] },
  { name: '狂妄', up: 'spd', down: 'spe', mods: [1.0, 1.0, 1.0, 1.1, 0.9] },
  { name: '实干', up: null, down: null, mods: [1.0, 1.0, 1.0, 1.0, 1.0] },
  { name: '害羞', up: null, down: null, mods: [1.0, 1.0, 1.0, 1.0, 1.0] },
  { name: '认真', up: null, down: null, mods: [1.0, 1.0, 1.0, 1.0, 1.0] },
  { name: '浮躁', up: null, down: null, mods: [1.0, 1.0, 1.0, 1.0, 1.0] },
  { name: '坦率', up: null, down: null, mods: [1.0, 1.0, 1.0, 1.0, 1.0] },
];

const EV_LIMIT_PER_STAT = 255;
const EV_LIMIT_TOTAL = 510;
const ANNUAL_MEMBER_BONUS = 10;

const TEAM_LIMITS = {
  hp: 30,
  atk: 15,
  def: 15,
  spa: 15,
  spd: 15,
  spe: 10,
};

function getTeamLimit(statKey) {
  return TEAM_LIMITS[statKey] ?? 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getNatureModifiers(natureIndex) {
  const nature = NATURES[natureIndex] ?? NATURES[0];
  const mods = {
    hp: 1,
    atk: nature.mods[0],
    def: nature.mods[1],
    spa: nature.mods[2],
    spd: nature.mods[3],
    spe: nature.mods[4],
  };

  return { nature, mods };
}

// 4399 getResult2 同款实现
function calcStat(statKey, base, ev, iv, level, natureMod) {
  const core = base * 2 + iv + ev / 4;

  if (statKey === 'hp') {
    return Math.floor((core * level) / 100 + level + 10);
  }

  return Math.floor(((core * level) / 100 + 5) * natureMod);
}

function getExtraBonuses(key, { isAnnual, hpBonus, teamBonuses, externalBonuses }) {
  let extra = Math.max(0, teamBonuses[key] || 0);
  if (isAnnual) extra += ANNUAL_MEMBER_BONUS;
  if (key === 'hp') extra += Math.max(0, hpBonus || 0);
  if (externalBonuses) {
    extra += externalBonuses.title[key] || 0;
    extra += externalBonuses.suit[key] || 0;
    extra += externalBonuses.goggle[key] || 0;
    extra += externalBonuses.mintmarkTotal[key] || 0;
  }
  return extra;
}

function calcAllStats({
  bases,
  evs,
  iv,
  level,
  natureIndex,
  isAnnual,
  hpBonus,
  teamBonuses,
  externalBonuses,
}) {
  const { nature, mods } = getNatureModifiers(natureIndex);
  const stats = {};
  const breakdown = {};

  const race = RACE_ORDER.map((key) => bases[key]);
  const nvli = RACE_ORDER.map((key) => evs[key]);

  stats.hp = Math.floor(((race[0] * 2 + iv + nvli[0] / 4) * level) / 100 + level + 10);

  for (let i = 1; i < RACE_ORDER.length; i++) {
    const key = RACE_ORDER[i];
    stats[key] = Math.floor(
      (((race[i] * 2 + iv + nvli[i] / 4) * level) / 100 + 5) * nature.mods[i - 1]
    );
  }

  const hpLimitBonus = Math.max(0, hpBonus || 0);
  const team = teamBonuses || {};
  const ext = externalBonuses || {
    title: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    suit: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    goggle: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    mintmarkTotal: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  };

  for (const key of STAT_KEYS) {
    const evPart = evs[key] / 4;
    const baseValue = stats[key];
    const annualBonus = isAnnual ? ANNUAL_MEMBER_BONUS : 0;
    const teamBonus = Math.max(0, team[key] || 0);
    const titleBonus = ext.title[key] || 0;
    const suitBonus = ext.suit[key] || 0;
    const goggleBonus = ext.goggle[key] || 0;
    const mintmarkBonus = ext.mintmarkTotal[key] || 0;

    if (isAnnual) {
      stats[key] += ANNUAL_MEMBER_BONUS;
    }

    if (key === 'hp' && hpLimitBonus > 0) {
      stats[key] += hpLimitBonus;
    }

    if (teamBonus > 0) {
      stats[key] += teamBonus;
    }

    if (titleBonus > 0) stats[key] += titleBonus;
    if (suitBonus > 0) stats[key] += suitBonus;
    if (goggleBonus > 0) stats[key] += goggleBonus;
    if (mintmarkBonus > 0) stats[key] += mintmarkBonus;

    breakdown[key] = {
      basePart: bases[key] * 2,
      ivPart: iv,
      evPart: Math.round(evPart * 100) / 100,
      natureLabel:
        key === 'hp' ? '—' : mods[key] === 1.1 ? '+10%' : mods[key] === 0.9 ? '-10%' : '平衡',
      natureMod: key === 'hp' ? 1 : mods[key],
      baseValue,
      annualBonus,
      hpLimitBonus: key === 'hp' ? hpLimitBonus : 0,
      teamBonus,
      titleBonus,
      suitBonus,
      goggleBonus,
      mintmarkBonus,
    };
  }

  return { stats, breakdown, nature, mods };
}

function recommendEv(base, iv, natureMod) {
  if (natureMod !== 1.1) {
    return 252;
  }

  const onesDigit = ((base % 10) * 2 + (iv % 10)) % 10;
  return [4, 5, 6].includes(onesDigit) ? 255 : 254;
}
