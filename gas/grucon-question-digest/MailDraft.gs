/**
 * メール下書きの自動作成
 *
 * 日程シートの「メールセット」列の日付が今日になった朝に、
 * 「3日前」「前日」「当日」の3通をGmailの【下書き】として作ります。
 * 「アーカイブ」は、スケジュールに「アーカイブ動画URL」を入力すると
 * 翌朝に作られます（メニューから手動でも作れます）。
 *
 * ★下書きは【このスクリプトを動かしているアカウント】のGmailに入ります。
 *   shinealightonlineschool@gmail.com から送るなら、
 *   そのアカウントでスクリプトを開いて実行してください。
 *
 * ★宛先は空のままです。送信予約のときに手動で入れてください。
 */

const MAIL_SHEET_NAME = 'メールテンプレート';

/** 事前案内としてまとめて作る3通 */
const PRE_EVENT_TIMINGS = ['3日前', '前日', '当日'];

// ─────────────────────────────────────────────────────────
//  毎朝の判定
// ─────────────────────────────────────────────────────────

/**
 * 今日が「メールセット」日のイベントがあれば下書きを作る。
 * あわせて、アーカイブ動画URLが入っている回のアーカイブ下書きも作る。
 * @return {Array<string>} 実行した内容（ログ用）
 */
function createDraftsIfDue_() {
  const done = [];
  if (!hasMailTemplates_()) {
    logInfo_('メールテンプレートシートが無いため、下書き作成はスキップしました。');
    return done;
  }

  const today = startOfDay_(new Date());

  listTargetEvents_().forEach(function (event) {
    const status = String(event.draftStatus || '');

    // ── 事前案内3通（メールセット日に作成）──
    const setDate = event.mailSetDate || addDays_(event.date, -CONFIG.OPEN_DAYS_BEFORE);
    if (startOfDay_(setDate).getTime() === today.getTime() && status.indexOf('事前') < 0) {
      const made = createPreEventDrafts_(event);
      if (made.length) {
        writeDraftStatus_(event, appendStatus_(status, '事前' + made.length + '通 '
          + formatDate_(new Date(), 'M/d')));
        done.push(formatDateJa_(event.date) + ' の事前案内を ' + made.length + '通 作成しました（'
          + made.join(' / ') + '）');
      }
    }

    // ── アーカイブ（動画URLが入ったら作成）──
    if (event.archiveUrl && status.indexOf('アーカイブ') < 0
        && startOfDay_(event.date).getTime() <= today.getTime()) {
      const subject = createArchiveDraft_(event);
      if (subject) {
        writeDraftStatus_(event, appendStatus_(String(event.draftStatus || ''),
          'アーカイブ ' + formatDate_(new Date(), 'M/d')));
        done.push(formatDateJa_(event.date) + ' のアーカイブ下書きを作成しました');
      }
    }
  });

  done.forEach(function (d) { logInfo_(d); });
  return done;
}

function appendStatus_(current, added) {
  const base = String(current || '').trim();
  return base ? base + ' / ' + added : added;
}

// ─────────────────────────────────────────────────────────
//  下書きの作成
// ─────────────────────────────────────────────────────────

/** 「3日前」「前日」「当日」の下書きをまとめて作る */
function createPreEventDrafts_(event) {
  const templates = readMailTemplates_();
  const made = [];
  PRE_EVENT_TIMINGS.forEach(function (timing) {
    const tpl = templates[timing];
    if (!tpl) {
      logInfo_('テンプレート「' + timing + '」が見つかりません。スキップします。');
      return;
    }
    const subject = fillTemplate_(tpl.subject, event);
    const body = fillTemplate_(tpl.body, event);
    createGmailDraft_(subject, body);
    made.push(timing);
  });
  return made;
}

/** アーカイブメールの下書きを作る */
function createArchiveDraft_(event) {
  const templates = readMailTemplates_();
  const tpl = templates['アーカイブ'];
  if (!tpl) {
    logInfo_('テンプレート「アーカイブ」が見つかりません。');
    return '';
  }
  const subject = fillTemplate_(tpl.subject, event);
  const body = fillTemplate_(tpl.body, event);
  createGmailDraft_(subject, body);
  return subject;
}

/**
 * Gmailに下書きを作る（宛先は空）。
 * 空の宛先が拒否される環境では、自分のアドレスを入れて作り直します。
 */
function createGmailDraft_(subject, body) {
  try {
    GmailApp.createDraft('', subject, body);
  } catch (e) {
    logInfo_('宛先が空の下書きを作れなかったため、自分宛で作成します：' + e);
    GmailApp.createDraft(Session.getEffectiveUser().getEmail(), subject, body);
  }
  logInfo_('下書きを作成しました：' + subject);
}

// ─────────────────────────────────────────────────────────
//  差込
// ─────────────────────────────────────────────────────────

/** テンプレートの {{差込項目}} を埋める */
function fillTemplate_(text, event) {
  const settings = readSettings_();

  function setting(names) {
    for (var i = 0; i < names.length; i++) {
      const v = settings[names[i]];
      if (v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  const deadline = addDays_(event.date, -CONFIG.CLOSE_DAYS_BEFORE);
  // 「ミーティングID: 893 4998 2545」のように項目名込みで入っていても大丈夫にする
  const meetingId = setting(['プラチナグルコン ミーティングID', 'グルコン共通ミーティングID'])
    .replace(/^ミーティングID\s*[:：]\s*/, '');

  const map = {
    '日程':            formatDateJaLong_(event.date),
    '日程短':          formatDateJa_(event.date),
    '提出期限':        formatDateJaLong_(deadline),
    '提出期限短':      formatDateJaHalf_(deadline),
    '時間帯':          formatTimeRangeJa_(event.startTime, event.endTime),
    '開始時':          formatHourJa_(event.startTime),
    'zoomリンク':      setting(['プラチナグルコン ZoomURL', 'グルコン共通ZoomURL']),
    'ミーティングID':  meetingId,
    '事前フォームURL': setting(['プラチナグルコン事前フォームURL', 'グルコン事前フォームURL', '事前フォームURL']),
    '合宿予定':        setting(['合宿予定']),
    '署名':            setting(['署名', '事務局差出人名']) || 'Shine A Light 運営事務局',
    'アーカイブ動画URL': String(event.archiveUrl || ''),
    '活動報告まとめURL': String(event.digestUrl || ''),
    '今後の日程':      buildUpcomingSchedule_(event.date),
  };

  return String(text).replace(/\{\{([^}]+)\}\}/g, function (whole, key) {
    const name = String(key).trim();
    return (map[name] !== undefined) ? map[name] : whole;
  });
}

/**
 * 「今後の日程」を組み立てる。指定日より後の回を1行1件で並べ、
 * 月が変わるところで1行あけます。
 *
 *   10月6日（火）10時〜11時
 *   10月27日（火）21時〜22時
 *
 *   11月10日（火）10時〜11時
 */
function buildUpcomingSchedule_(afterDate) {
  const base = afterDate ? startOfDay_(afterDate) : startOfDay_(new Date());
  const lines = [];
  var lastMonth = null;

  listTargetEvents_().forEach(function (e) {
    if (startOfDay_(e.date).getTime() <= base.getTime()) return;
    const month = e.date.getMonth();
    if (lastMonth !== null && month !== lastMonth) lines.push('');
    lines.push(formatDateJaLong_(e.date) + formatTimeRangeJa_(e.startTime, e.endTime));
    lastMonth = month;
  });

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
//  日付・時刻の表記
// ─────────────────────────────────────────────────────────

/** 「9月15日（火）」 */
function formatDateJaLong_(d) {
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return formatDate_(d, 'M月d日') + '（' + week + '）';
}

/** 「9/14(月)」（半角かっこ） */
function formatDateJaHalf_(d) {
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return formatDate_(d, 'M/d') + '(' + week + ')';
}

/** 「10:00」→「10時」／「9:30」→「9時30分」 */
function formatHourJa_(time) {
  const t = formatTime_(time);
  const m = t.match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})$/);
  if (!m) return t;
  const min = Number(m[2]);
  return Number(m[1]) + '時' + (min ? min + '分' : '');
}

/** 「10時〜11時」 */
function formatTimeRangeJa_(start, end) {
  const s = formatHourJa_(start);
  const e = formatHourJa_(end);
  if (!s) return '';
  return e ? s + '〜' + e : s;
}

// ─────────────────────────────────────────────────────────
//  テンプレートシートの読み書き
// ─────────────────────────────────────────────────────────

function getMailSheet_() {
  return openMaster_().getSheetByName(MAIL_SHEET_NAME);
}

function hasMailTemplates_() {
  try { return getMailSheet_() !== null; } catch (e) { return false; }
}

/**
 * メールテンプレートシートを読む
 * @return {Object<string,{subject:string, body:string}>} タイミング名をキーにしたマップ
 */
function readMailTemplates_() {
  const sheet = getMailSheet_();
  if (!sheet) throw new Error('「' + MAIL_SHEET_NAME + '」シートがありません。'
    + 'メニュー →「メールテンプレートを初期設定」を実行してください。');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('「' + MAIL_SHEET_NAME + '」シートが空です。');

  const values = sheet.getRange(1, 1, lastRow, 3).getValues();
  const map = {};
  for (var r = 1; r < values.length; r++) {
    const timing = String(values[r][0] || '').trim();
    if (!timing) continue;
    map[timing] = {
      subject: String(values[r][1] || ''),
      body: String(values[r][2] || ''),
    };
  }
  return map;
}

// ─────────────────────────────────────────────────────────
//  初期設定
// ─────────────────────────────────────────────────────────

/**
 * ★メール下書き機能の初期設定。
 *
 *   ・「メールテンプレート」シートを作り、雛形を書き込む
 *   ・「基本設定」に足りない項目（事前フォームURL・合宿予定）を追加する
 *   ・「スケジュール」に足りない列（アーカイブ動画URL・活動報告まとめURL・下書き作成）を追加する
 *
 * 何度実行しても、すでにあるものは書き換えません。
 */
function setupMailTemplates() {
  const ss = openMaster_();
  const added = [];

  // ① メールテンプレートシート
  var sheet = ss.getSheetByName(MAIL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MAIL_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['タイミング', '件名', '本文']])
         .setFontWeight('bold').setBackground('#D9D9D9');
    sheet.getRange(2, 1, MAIL_TEMPLATES_.length, 3).setValues(MAIL_TEMPLATES_);
    sheet.setColumnWidth(1, 90);
    sheet.setColumnWidth(2, 420);
    sheet.setColumnWidth(3, 700);
    sheet.getRange(2, 1, MAIL_TEMPLATES_.length, 3)
         .setVerticalAlignment('top').setWrap(true);
    sheet.setFrozenRows(1);
    added.push('「' + MAIL_SHEET_NAME + '」シートを作成し、雛形4通を書き込みました');
  } else {
    added.push('「' + MAIL_SHEET_NAME + '」シートはすでにあります（変更していません）');
  }

  // ② 基本設定に足りない項目
  const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  if (settingsSheet) {
    const existing = {};
    const last = settingsSheet.getLastRow();
    if (last > 0) {
      settingsSheet.getRange(1, 1, last, 1).getValues().forEach(function (r) {
        existing[String(r[0] || '').trim()] = true;
      });
    }
    // すでに別の名前で入っている場合は追加しません（aliases のどれかがあればOK）
    const wanted = [
      { aliases: ['プラチナグルコン事前フォームURL', 'グルコン事前フォームURL', '事前フォームURL'],
        row: ['事前フォームURL', '', '🟡 案内メールに載せる回答用URL'] },
      { aliases: ['合宿予定'],
        row: ['合宿予定', '11月：東京　六本木付近\n12日（木）13日（金）',
              '🟡 アーカイブメールの {{合宿予定}} に入ります'] },
    ];
    wanted.forEach(function (item) {
      const found = item.aliases.filter(function (a) { return existing[a]; });
      if (found.length > 0) {
        added.push('「基本設定」の『' + found[0] + '』はすでにあります（変更していません）');
        return;
      }
      settingsSheet.appendRow(item.row);
      added.push('「基本設定」に『' + item.row[0] + '』を追加しました');
    });
  }

  // ③ スケジュールに足りない列
  const scheduleSheet = getScheduleSheet_();
  const header = scheduleSheet.getRange(1, 1, 1, scheduleSheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  ['アーカイブ動画URL', '活動報告まとめURL', '下書き作成'].forEach(function (name) {
    if (header.indexOf(name) >= 0) return;
    const col = scheduleSheet.getLastColumn() + 1;
    scheduleSheet.getRange(1, col).setValue(name)
                 .setFontWeight('bold').setBackground('#D9D9D9');
    scheduleSheet.setColumnWidth(col, 260);
    header.push(name);
    added.push('「スケジュール」に『' + name + '』列を追加しました');
  });

  const out = '── 初期設定の結果 ──────────────────\n'
    + added.map(function (a) { return '・' + a; }).join('\n')
    + '\n\n【次にやること】\n'
    + '・「基本設定」の『プラチナグルコン事前フォームURL』に、フォームの回答用URLを入れてください\n'
    + '・「基本設定」の『合宿予定』を最新の内容に直してください\n'
    + '・メニュー →「メール下書きを今すぐ作る」で中身を確認してください';
  console.log(out);
  return out;
}

// ─────────────────────────────────────────────────────────
//  手動実行
// ─────────────────────────────────────────────────────────

/**
 * 次回イベントの事前案内3通を、今すぐ下書きにする（動作確認用）。
 * 「下書き作成」列の記録は更新しないので、本番の自動作成には影響しません。
 */
function manualCreatePreEventDrafts() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のイベントが日程シートに見つかりません。');
  const made = createPreEventDrafts_(event);
  const msg = formatDateJa_(event.date) + ' の下書きを ' + made.length + '通 作成しました（'
    + made.join(' / ') + '）\n\nGmailの「下書き」フォルダを確認してください。\n宛先は空です。';
  logInfo_(msg);
  return msg;
}

/**
 * 直近の「アーカイブ動画URLが入っている回」のアーカイブ下書きを今すぐ作る。
 */
function manualCreateArchiveDraft() {
  const events = listTargetEvents_()
    .filter(function (e) { return e.archiveUrl; });
  if (events.length === 0) {
    throw new Error('「アーカイブ動画URL」が入力された回がありません。\n'
      + 'スケジュールシートに動画URLを入れてから実行してください。');
  }
  const event = events[events.length - 1];
  const subject = createArchiveDraft_(event);
  const msg = formatDateJa_(event.date) + ' のアーカイブ下書きを作成しました。\n\n'
    + subject + '\n\nGmailの「下書き」フォルダを確認してください。';
  logInfo_(msg);
  return msg;
}

/** 差し込み結果をログで確認する（下書きは作りません） */
function previewMailDrafts() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のイベントが日程シートに見つかりません。');
  const templates = readMailTemplates_();
  const lines = ['── 差し込みプレビュー（下書きは作っていません）──', ''];
  PRE_EVENT_TIMINGS.concat(['アーカイブ']).forEach(function (timing) {
    const tpl = templates[timing];
    if (!tpl) { lines.push('【' + timing + '】テンプレートなし'); return; }
    lines.push('════════ ' + timing + ' ════════');
    lines.push('件名: ' + fillTemplate_(tpl.subject, event));
    lines.push('');
    lines.push(fillTemplate_(tpl.body, event));
    lines.push('');
  });
  const out = lines.join('\n');
  console.log(out);
  return out;
}
