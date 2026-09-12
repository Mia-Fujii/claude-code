/**
 * マスタスプレッドシート（Shine A Light_メール設定）の読み取り
 */

/** マスタスプレッドシートを開く */
function openMaster_() {
  const id = cfg_('MASTER_SPREADSHEET_ID');
  if (!id) throw new Error('MASTER_SPREADSHEET_ID が設定されていません。');
  return SpreadsheetApp.openById(id);
}

/**
 * 「基本設定」シートを A列=項目 / B列=設定値 のマップとして読む
 * @return {Object<string,string>}
 */
function readSettings_() {
  const sheet = openMaster_().getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  if (!sheet) throw new Error('シート「' + CONFIG.SETTINGS_SHEET_NAME + '」が見つかりません。');
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  const map = {};
  values.forEach(function (row) {
    const key = String(row[0] || '').trim();
    if (key) map[key] = row[1];
  });
  return map;
}

/**
 * 現在の期を取得する（例: "21期"）
 * 「基本設定」B2 の値をそのままフォルダ名に使います。
 */
function getTermName_() {
  const raw = String(readSettings_()['期'] || '').trim();
  if (!raw) {
    throw new Error('「基本設定」シートの「期」が空です。例:「21期」を入力してください。');
  }
  // "21" のように数字だけ書かれていた場合も "21期" に整える
  return /期\s*$/.test(raw) ? raw : raw + '期';
}

/** 日程シートを取得する（設定した候補名のうち最初に見つかったもの） */
function getScheduleSheet_() {
  const ss = openMaster_();
  for (var i = 0; i < CONFIG.SCHEDULE_SHEET_NAMES.length; i++) {
    const sheet = ss.getSheetByName(CONFIG.SCHEDULE_SHEET_NAMES[i]);
    if (sheet) return sheet;
  }
  throw new Error('日程シートが見つかりません。候補: ' + CONFIG.SCHEDULE_SHEET_NAMES.join(' / '));
}

/**
 * 日程シートから対象イベント（グルコン）の一覧を取得する。
 * 「サポート講師ビギナーグルコン」を拾わないよう、内容列は完全一致で判定します。
 * @return {Array<{date: Date, dateShort: string, startTime: string, endTime: string, owner: string, row: number}>}
 */
function listTargetEvents_() {
  const sheet = getScheduleSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const header = values[0].map(function (h) { return String(h || '').trim(); });
  const H = CONFIG.SCHEDULE_HEADERS;

  function col(name) {
    const idx = header.indexOf(name);
    if (idx < 0) throw new Error('日程シートに「' + name + '」列が見つかりません。');
    return idx;
  }
  const iName = col(H.eventName);
  const iDate = col(H.date);
  const iShort = header.indexOf(H.dateShort);
  const iStart = header.indexOf(H.startTime);
  const iEnd = header.indexOf(H.endTime);
  const iOwner = header.indexOf(H.owner);

  const target = CONFIG.TARGET_EVENT_NAME;
  const events = [];

  for (var r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[iName] || '').trim() !== target) continue;   // ★完全一致
    const date = toDate_(row[iDate]);
    if (!date) continue;
    events.push({
      date: date,
      dateShort: iShort >= 0 ? String(row[iShort] || '').trim() : '',
      startTime: iStart >= 0 ? formatTime_(row[iStart]) : '',
      endTime: iEnd >= 0 ? formatTime_(row[iEnd]) : '',
      owner: iOwner >= 0 ? String(row[iOwner] || '').trim() : '',
      row: r + 1,
    });
  }
  events.sort(function (a, b) { return a.date - b.date; });
  return events;
}

/**
 * 「今日からちょうど n 日後」に開催されるグルコンを返す（なければ null）
 */
function findEventByDaysAhead_(daysAhead) {
  const target = startOfDay_(addDays_(new Date(), daysAhead));
  const events = listTargetEvents_();
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() === target.getTime()) return events[i];
  }
  return null;
}

/** 今日以降で一番近いグルコンを返す（なければ null） */
function findNextEvent_() {
  const today = startOfDay_(new Date());
  const events = listTargetEvents_();
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() >= today.getTime()) return events[i];
  }
  return null;
}

/** グルコン日から、質問の収録期間 [開始, 終了] を求める */
function getCollectionWindow_(eventDate) {
  const start = startOfDay_(addDays_(eventDate, -CONFIG.OPEN_DAYS_BEFORE));
  const end = addDays_(eventDate, -CONFIG.CLOSE_DAYS_BEFORE);
  end.setHours(CONFIG.CLOSE_HOUR, CONFIG.CLOSE_MINUTE, 0, 0);
  return { start: start, end: end };
}
