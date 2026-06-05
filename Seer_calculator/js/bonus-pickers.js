const titlePickerRoot = document.getElementById('title-picker');
const suitPickerRoot = document.getElementById('suit-picker');
const gogglePickerRoot = document.getElementById('goggle-picker');
const mintmarkPickerRoots = [
  document.getElementById('mintmark-picker-0'),
  document.getElementById('mintmark-picker-1'),
  document.getElementById('mintmark-picker-2'),
];

let titlePicker = null;
let suitPicker = null;
let gogglePicker = null;
let mintmarkPickers = [];
let bonusPickersReady = false;

function notifyBonusChange() {
  window.dispatchEvent(new CustomEvent('bonus-change'));
}

function initBonusPickers() {
  if (bonusPickersReady) return;
  if (
    !getTitlesList().length &&
    !getMintmarksList().length &&
    !getSuitsList().length &&
    !getGogglesList().length
  ) {
    return;
  }
  bonusPickersReady = true;

  titlePicker = createItemPicker({
    root: titlePickerRoot,
    getList: getTitlesList,
    placeholder: '称号 · {count}',
    formatStats: formatBonusShort,
    onChange: notifyBonusChange,
  });

  suitPicker = createItemPicker({
    root: suitPickerRoot,
    getList: getSuitsList,
    placeholder: '套装 · {count}',
    formatStats: formatBonusShort,
    onChange: notifyBonusChange,
  });

  gogglePicker = createItemPicker({
    root: gogglePickerRoot,
    getList: getGogglesList,
    placeholder: '护目镜 · {count}',
    formatStats: formatBonusShort,
    onChange: notifyBonusChange,
  });

  mintmarkPickers = mintmarkPickerRoots.map((root, index) =>
    createItemPicker({
      root,
      getList: getMintmarksList,
      placeholder: `刻印${index + 1}`,
      formatStats: formatBonusShort,
      compact: true,
      onChange: notifyBonusChange,
    })
  );

  titlePicker.init();
  suitPicker.init();
  gogglePicker.init();
  mintmarkPickers.forEach((picker) => picker.init());
}

function getSelectedTitle() {
  return titlePicker?.getSelected() || null;
}

function getSelectedSuit() {
  return suitPicker?.getSelected() || null;
}

function getSelectedGoggle() {
  return gogglePicker?.getSelected() || null;
}

function getSelectedMintmarks() {
  return mintmarkPickers.map((picker) => picker.getSelected() || null);
}

function readExternalBonuses() {
  const title = itemToBonus(getSelectedTitle());
  const suit = itemToBonus(getSelectedSuit());
  const goggle = itemToBonus(getSelectedGoggle());
  const mintmarks = getSelectedMintmarks().map(itemToBonus);
  const mintmarkTotal = sumBonuses(mintmarks);

  return {
    title,
    suit,
    goggle,
    mintmarks,
    mintmarkTotal,
    combined: sumBonuses([title, suit, goggle, mintmarkTotal]),
  };
}

function clearBonusPickers() {
  titlePicker?.clear();
  suitPicker?.clear();
  gogglePicker?.clear();
  mintmarkPickers.forEach((picker) => picker.clear());
}

window.addEventListener('bonuses-ready', () => {
  initBonusPickers();
});
