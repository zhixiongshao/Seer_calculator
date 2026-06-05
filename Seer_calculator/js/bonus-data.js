const EMPTY_BONUS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 };

function getTitlesList() {
  return window.TITLES_LIST || [];
}

function getSuitsList() {
  return window.SUITS_LIST || [];
}

function getMintmarksList() {
  return window.MINTMARKS_LIST || [];
}

function itemToBonus(item) {
  if (!item) return { ...EMPTY_BONUS };
  return {
    hp: item.hp || 0,
    atk: item.atk || 0,
    def: item.def || 0,
    spa: item.spa || 0,
    spd: item.spd || 0,
    spe: item.spe || 0,
    total: item.total || 0,
  };
}

function sumBonuses(bonusList) {
  const sum = { ...EMPTY_BONUS };
  bonusList.forEach((bonus) => {
    STAT_KEYS.forEach((key) => {
      sum[key] += bonus[key] || 0;
    });
  });
  sum.total = STAT_KEYS.reduce((n, key) => n + sum[key], 0);
  return sum;
}

function formatBonusShort(item) {
  if (!item || !item.total) return '无加成';
  const parts = STAT_KEYS.filter((key) => item[key] > 0).map(
    (key) => `${STAT_LABELS[key]}+${item[key]}`
  );
  return parts.join(' ') || '无加成';
}
