/**
 * ═══════════════════════════════════════════════════════════════
 *  プラチナグルコン メール下書き 自動作成（1ファイル版）
 * ═══════════════════════════════════════════════════════════════
 *
 *  【貼り付け先】プラチナグルコン日程 スプレッドシート
 *                拡張機能 → Apps Script → コード.gs にこれを丸ごと貼り付け
 *
 *  ── 貼ったあとの手順 ──────────────────────────────────
 *    1. 保存（Ctrl+S / ⌘S）
 *    2. setChatworkCredentials にトークンを入れて実行 → トークンをコードから消す
 *    3. スプレッドシートに戻って再読み込み →「メール下書き」メニューが出ます
 *    4. メニュー →「① 設定状況を確認」
 *    5. メニュー →「② メールテンプレートを初期設定」
 *    6. メニュー →「差し込みプレビュー」で中身を確認
 *    7. メニュー →「自動実行トリガーを設置」
 *
 *  ★このスクリプトは【メールの下書き作成だけ】を行います。
 *    質問まとめ・フォームの開閉は
 *    「プラチナグルコン質問受付フォーム（回答）」側のGASが担当します。
 *
 *  ★下書きは【このスクリプトを動かしているアカウント】のGmailに入ります。
 *    shinealightonlineschool@gmail.com でログインした状態で設定してください。
 * ═══════════════════════════════════════════════════════════════
 */


// ══════════════════════════════════════════════════════════════
// MailOnly.gs
// ══════════════════════════════════════════════════════════════

/**
 * ═══════════════════════════════════════════════════════════════
 *  プラチナグルコン メール下書き 自動作成
 * ═══════════════════════════════════════════════════════════════
 *
 *  【貼り付け先】プラチナグルコン日程 スプレッドシート
 *                （拡張機能 → Apps Script）
 *
 *  やること：
 *    ・「メールセット」列の日付になった朝に
 *      「3日前」「前日」「当日」の3通をGmailの【下書き】として作る
 *    ・「アーカイブ動画URL」を入力すると、翌朝にアーカイブメールの下書きを作る
 *    ・作ったらChatworkに通知する
 *
 *  やらないこと：
 *    ・メールの送信（下書きまでです）
 *    ・質問まとめ／フォームの開閉
 *      → こちらは「プラチナグルコン質問受付フォーム（回答）」側のGASが担当します
 *
 *  ★宛先は空のままです。送信予約のときに手動で入れてください。
 *  ★下書きは【このスクリプトを動かしているアカウント】のGmailに入ります。
 *    shinealightonlineschool@gmail.com でログインした状態で設定してください。
 * ═══════════════════════════════════════════════════════════════
 */

const CONFIG = {
  /** シート名 */
  SCHEDULE_SHEET_NAME: 'スケジュール',
  SETTINGS_SHEET_NAME: '基本設定',
  MAIL_SHEET_NAME: 'メールテンプレート',

  /** 日程シートの列名（位置ではなく名前で探します） */
  HEADERS: {
    date: '日程',
    startTime: '開始時間',
    endTime: '終了時間',
    mailSet: 'メールセット',
    archiveUrl: 'アーカイブ動画URL',
    digestUrl: '活動報告まとめURL',
    draftStatus: '下書き作成',
  },

  /** 事前案内としてまとめて作る3通 */
  PRE_EVENT_TIMINGS: ['3日前', '前日', '当日'],

  /** 提出期限は開催日の何日前か（1 = 前日） */
  DEADLINE_DAYS_BEFORE: 1,

  /** 毎朝この時刻に下書きを作ります */
  DRAFT_HOUR: 7,

  /** true にすると Chatwork に送らず、ログに出すだけ */
  DRY_RUN: false,

  TIMEZONE: 'Asia/Tokyo',
};

// ═══════════════════════════════════════════════════════════════
//  メニュー
// ═══════════════════════════════════════════════════════════════

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('メール下書き')
      .addItem('① 設定状況を確認', 'menuShowStatus')
      .addItem('② メールテンプレートを初期設定', 'menuSetup')
      .addSeparator()
      .addItem('差し込みプレビュー（下書きなし）', 'menuPreview')
      .addItem('事前案内3通の下書きを今すぐ作る', 'menuCreatePre')
      .addItem('アーカイブメールの下書きを作る', 'menuCreateArchive')
      .addSeparator()
      .addItem('Chatworkへの接続テスト', 'menuTestChatwork')
      .addItem('自動実行トリガーを設置', 'menuInstallTrigger')
      .addItem('本日分の処理に追いつかせる', 'menuCatchUp')
      .addToUi();
  } catch (e) {
    console.warn('メニューを作れませんでした: ' + e);
  }
}

function menuShowStatus()      { runFromMenu_('設定状況', showStatus); }
function menuSetup()           { runFromMenu_('初期設定', setupMailTemplates); }
function menuPreview()         { runFromMenu_('差し込みプレビュー', previewMailDrafts); }
function menuCreateArchive()   { runFromMenu_('アーカイブ下書き', manualCreateArchiveDraft); }
function menuCatchUp()         { runFromMenu_('本日分の処理', catchUpToday); }

function menuCreatePre() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('確認',
    '次回グルコンの「3日前」「前日」「当日」の下書きを、Gmailに3通作ります。\n'
    + '（宛先は空です。送信はされません）\n\nよろしいですか？',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runFromMenu_('下書きの作成', manualCreatePreEventDrafts);
}

function menuTestChatwork() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('確認',
    'Chatworkにテスト投稿を1件送ります。よろしいですか？',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runFromMenu_('Chatwork接続テスト', function () {
    sendChatwork_('[info][title]接続テスト[/title]'
      + 'メール下書き自動作成のテストです。この投稿が見えていれば設定は正常です。[/info]');
    return 'Chatworkに投稿しました。ルームを確認してください。';
  });
}

function menuInstallTrigger() {
  runFromMenu_('トリガー設置', function () {
    setupInstallTrigger();
    return '自動実行トリガーを設置しました。\n\n'
      + '・毎日 ' + CONFIG.DRAFT_HOUR + ':00 … 下書きを作る日かどうかを判定\n\n'
      + '※本日分の処理にも、その場で追いつかせました。';
  });
}

/** メニュー実行の共通処理（結果とエラーをダイアログで見せる） */
function runFromMenu_(label, fn) {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert(label, String(fn() || '完了しました。'), ui.ButtonSet.OK);
  } catch (err) {
    console.error(err);
    ui.alert('エラー：' + label,
      (err && err.message ? err.message : String(err))
      + '\n\n詳しくは 拡張機能 → Apps Script → 実行ログ をご確認ください。',
      ui.ButtonSet.OK);
  }
}

// ═══════════════════════════════════════════════════════════════
//  トリガー
// ═══════════════════════════════════════════════════════════════

/** ★最初に1回だけ実行する */
function setupInstallTrigger() {
  removeAllTriggers();
  ScriptApp.newTrigger('dailyCreateDrafts')
    .timeBased().atHour(CONFIG.DRAFT_HOUR).nearMinute(0).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();
  logInfo_('トリガーを設置しました：dailyCreateDrafts（毎日 ' + CONFIG.DRAFT_HOUR + '時）');
  // 朝の時刻を過ぎてから設置した場合に備えて、その場で本日分に追いつかせる
  catchUpToday();
}

function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  logInfo_('既存のトリガーをすべて削除しました。');
}

/** 毎朝これが走ります */
function dailyCreateDrafts() {
  try {
    const done = createDraftsIfDue_();
    if (done.length > 0) notifyDrafts_(done);
  } catch (err) {
    console.error(err);
    notifyError_('dailyCreateDrafts（メール下書きの作成）', err);
  }
}

/** 今日やるべきだった処理をその場で実行する */
function catchUpToday() {
  const done = createDraftsIfDue_();
  if (done.length > 0) {
    notifyDrafts_(done);
    const out = done.join('\n');
    logInfo_(out);
    return out;
  }
  const msg = '今日は下書きを作る日ではありませんでした。';
  logInfo_(msg);
  return msg;
}

// ═══════════════════════════════════════════════════════════════
//  下書き作成の判定
// ═══════════════════════════════════════════════════════════════

/**
 * 「メールセット」日を迎えた回の事前案内3通と、
 * アーカイブ動画URLが入った回のアーカイブ下書きを作る。
 * @return {Array<string>} 実行した内容
 */
function createDraftsIfDue_() {
  const done = [];
  const today = startOfDay_(new Date());

  listEvents_().forEach(function (event) {
    const status = String(event.draftStatus || '');

    // ── 事前案内3通 ──
    if (event.mailSetDate
        && startOfDay_(event.mailSetDate).getTime() === today.getTime()
        && status.indexOf('事前') < 0) {
      const made = createPreEventDrafts_(event);
      if (made.length) {
        writeCell_(event, CONFIG.HEADERS.draftStatus,
          appendStatus_(status, '事前' + made.length + '通 ' + formatDate_(new Date(), 'M/d')));
        done.push(formatDateJaLong_(event.date) + ' の事前案内を ' + made.length + '通 作成（'
          + made.join(' / ') + '）');
      }
    }

    // ── アーカイブ ──
    if (event.archiveUrl
        && status.indexOf('アーカイブ') < 0
        && startOfDay_(event.date).getTime() <= today.getTime()) {
      createArchiveDraft_(event);
      writeCell_(event, CONFIG.HEADERS.draftStatus,
        appendStatus_(String(event.draftStatus || ''),
          'アーカイブ ' + formatDate_(new Date(), 'M/d')));
      done.push(formatDateJaLong_(event.date) + ' のアーカイブ下書きを作成');
    }
  });

  done.forEach(function (d) { logInfo_(d); });
  return done;
}

function appendStatus_(current, added) {
  const base = String(current || '').trim();
  return base ? base + ' / ' + added : added;
}

// ═══════════════════════════════════════════════════════════════
//  下書きの作成
// ═══════════════════════════════════════════════════════════════

function createPreEventDrafts_(event) {
  const templates = readMailTemplates_();
  const made = [];
  CONFIG.PRE_EVENT_TIMINGS.forEach(function (timing) {
    const tpl = templates[timing];
    if (!tpl) {
      logInfo_('テンプレート「' + timing + '」が見つかりません。スキップします。');
      return;
    }
    createGmailDraft_(fillTemplate_(tpl.subject, event), fillTemplate_(tpl.body, event));
    made.push(timing);
  });
  return made;
}

function createArchiveDraft_(event) {
  const tpl = readMailTemplates_()['アーカイブ'];
  if (!tpl) throw new Error('テンプレート「アーカイブ」が見つかりません。');
  const subject = fillTemplate_(tpl.subject, event);
  createGmailDraft_(subject, fillTemplate_(tpl.body, event));
  return subject;
}

/** Gmailに下書きを作る（宛先は空） */
function createGmailDraft_(subject, body) {
  try {
    GmailApp.createDraft('', subject, body);
  } catch (e) {
    logInfo_('宛先が空の下書きを作れなかったため、自分宛で作成します：' + e);
    GmailApp.createDraft(Session.getEffectiveUser().getEmail(), subject, body);
  }
  logInfo_('下書きを作成しました：' + subject);
}

// ═══════════════════════════════════════════════════════════════
//  差し込み
// ═══════════════════════════════════════════════════════════════

function fillTemplate_(text, event) {
  const settings = readSettings_();

  function setting(names) {
    for (var i = 0; i < names.length; i++) {
      const v = settings[names[i]];
      if (v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  const deadline = addDays_(event.date, -CONFIG.DEADLINE_DAYS_BEFORE);
  // 「ミーティングID: 893 4998 2545」のように項目名込みで入っていても大丈夫にする
  const meetingId = setting(['プラチナグルコン ミーティングID', 'グルコン共通ミーティングID', 'ミーティングID'])
    .replace(/^ミーティングID\s*[:：]\s*/, '');

  const map = {
    '日程':              formatDateJaLong_(event.date),
    '日程短':            formatDateJaShort_(event.date),
    '提出期限':          formatDateJaLong_(deadline),
    '提出期限短':        formatDateJaHalf_(deadline),
    '時間帯':            formatTimeRangeJa_(event.startTime, event.endTime),
    '開始時':            formatHourJa_(event.startTime),
    'zoomリンク':        setting(['プラチナグルコン ZoomURL', 'グルコン共通ZoomURL', 'ZoomURL']),
    'ミーティングID':    meetingId,
    '事前フォームURL':   setting(['プラチナグルコン事前フォームURL', 'グルコン事前フォームURL', '事前フォームURL']),
    '合宿予定':          setting(['合宿予定']),
    '署名':              setting(['署名', '事務局差出人名']) || 'Shine A Light 運営事務局',
    'アーカイブ動画URL': String(event.archiveUrl || ''),
    '活動報告まとめURL': String(event.digestUrl || ''),
    '今後の日程':        buildUpcomingSchedule_(event.date),
  };

  return String(text).replace(/\{\{([^}]+)\}\}/g, function (whole, key) {
    const name = String(key).trim();
    return (map[name] !== undefined) ? map[name] : whole;
  });
}

/**
 * 「今後の日程」を組み立てる。指定日より後の回を1行1件で並べ、
 * 月が変わるところで1行あけます。
 */
function buildUpcomingSchedule_(afterDate) {
  const base = afterDate ? startOfDay_(afterDate) : startOfDay_(new Date());
  const lines = [];
  var lastMonth = null;
  listEvents_().forEach(function (e) {
    if (startOfDay_(e.date).getTime() <= base.getTime()) return;
    if (lastMonth !== null && e.date.getMonth() !== lastMonth) lines.push('');
    lines.push(formatDateJaLong_(e.date) + formatTimeRangeJa_(e.startTime, e.endTime));
    lastMonth = e.date.getMonth();
  });
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  スプレッドシートの読み書き
// ═══════════════════════════════════════════════════════════════

function book_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('このスクリプトは、プラチナグルコン日程スプレッドシートに'
    + '貼り付けて使ってください。');
  return ss;
}

function getScheduleSheet_() {
  const sheet = book_().getSheetByName(CONFIG.SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error('「' + CONFIG.SCHEDULE_SHEET_NAME + '」シートが見つかりません。');
  return sheet;
}

/** 「基本設定」を A列=項目 / B列=値 のマップとして読む */
function readSettings_() {
  const sheet = book_().getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  if (!sheet) throw new Error('「' + CONFIG.SETTINGS_SHEET_NAME + '」シートが見つかりません。');
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  const map = {};
  values.forEach(function (row) {
    const key = String(row[0] || '').trim();
    if (key) map[key] = row[1];
  });
  return map;
}

/** 日程シートの全行を読む */
function listEvents_() {
  const sheet = getScheduleSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const header = values[0].map(function (h) { return String(h || '').trim(); });
  const H = CONFIG.HEADERS;

  const iDate = header.indexOf(H.date);
  if (iDate < 0) throw new Error('日程シートに「' + H.date + '」列が見つかりません。');
  const iStart = header.indexOf(H.startTime);
  const iEnd = header.indexOf(H.endTime);
  const iMailSet = header.indexOf(H.mailSet);
  const iArchive = header.indexOf(H.archiveUrl);
  const iDigest = header.indexOf(H.digestUrl);
  const iStatus = header.indexOf(H.draftStatus);

  const events = [];
  for (var r = 1; r < values.length; r++) {
    const row = values[r];
    const date = toDate_(row[iDate]);
    if (!date) continue;
    events.push({
      date: date,
      startTime: iStart >= 0 ? formatTime_(row[iStart]) : '',
      endTime: iEnd >= 0 ? formatTime_(row[iEnd]) : '',
      mailSetDate: iMailSet >= 0 ? toDate_(row[iMailSet]) : null,
      archiveUrl: iArchive >= 0 ? String(row[iArchive] || '').trim() : '',
      digestUrl: iDigest >= 0 ? String(row[iDigest] || '').trim() : '',
      draftStatus: iStatus >= 0 ? String(row[iStatus] || '').trim() : '',
      row: r + 1,
    });
  }
  events.sort(function (a, b) { return a.date - b.date; });
  return events;
}

/** 今日以降で一番近い回 */
function findNextEvent_() {
  const today = startOfDay_(new Date());
  const events = listEvents_();
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() >= today.getTime()) return events[i];
  }
  return null;
}

/** 日程シートの指定列に書き込む（列が無ければ何もしない） */
function writeCell_(event, headerName, value) {
  if (!event || !event.row) return false;
  const sheet = getScheduleSheet_();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  const idx = header.indexOf(headerName);
  if (idx < 0) return false;
  sheet.getRange(event.row, idx + 1).setValue(value);
  return true;
}

/** メールテンプレートを読む */
function readMailTemplates_() {
  const sheet = book_().getSheetByName(CONFIG.MAIL_SHEET_NAME);
  if (!sheet) throw new Error('「' + CONFIG.MAIL_SHEET_NAME + '」シートがありません。\n'
    + 'メニュー →「② メールテンプレートを初期設定」を実行してください。');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('「' + CONFIG.MAIL_SHEET_NAME + '」シートが空です。');

  const values = sheet.getRange(1, 1, lastRow, 3).getValues();
  const map = {};
  for (var r = 1; r < values.length; r++) {
    const timing = String(values[r][0] || '').trim();
    if (!timing) continue;
    map[timing] = { subject: String(values[r][1] || ''), body: String(values[r][2] || '') };
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════
//  Chatwork
// ═══════════════════════════════════════════════════════════════

/**
 * Chatworkの認証情報を保存します（実行後、この関数内の値は消してください）。
 */
function setChatworkCredentials() {
  const token = '';                 // ← Chatwork APIトークン
  const roomId = '444552021';       // ← 通知先ルームID

  if (!token) throw new Error('token を入力してから実行してください。');
  PropertiesService.getScriptProperties().setProperties({
    CHATWORK_TOKEN: token,
    CHATWORK_ROOM_ID: roomId,
  }, false);
  console.log('Chatworkの設定を保存しました。この関数内の token は削除しておいてください。');
}

function sendChatwork_(message) {
  if (CONFIG.DRY_RUN) {
    logInfo_('[DRY_RUN] Chatworkには送信していません。本文:\n' + message);
    return { dryRun: true };
  }
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('CHATWORK_TOKEN') || '').trim();
  const roomId = (props.getProperty('CHATWORK_ROOM_ID') || '').trim();
  if (!token) throw new Error('スクリプトプロパティ CHATWORK_TOKEN が未設定です。'
    + '\nsetChatworkCredentials を実行してください。');
  if (!roomId) throw new Error('スクリプトプロパティ CHATWORK_ROOM_ID が未設定です。');

  const res = UrlFetchApp.fetch(
    'https://api.chatwork.com/v2/rooms/' + encodeURIComponent(roomId) + '/messages',
    { method: 'post', headers: { 'X-ChatWorkToken': token },
      payload: { body: message }, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Chatwork送信に失敗しました (HTTP ' + code + '): ' + res.getContentText());
  }
  logInfo_('Chatworkに送信しました。');
  return JSON.parse(res.getContentText());
}

/** 下書きを作ったことをChatworkに知らせる */
function notifyDrafts_(lines) {
  try {
    const mention = String(readSettings_()['Chatwork メンション先'] || '').trim();
    sendChatwork_((mention ? mention + '\n' : '')
      + 'メールの下書きを作成しました。\n'
      + 'Gmailの「下書き」を確認し、宛先を入れて送信予約をお願いします。\n'
      + '\n[info][title]作成した下書き[/title]'
      + lines.map(function (l) { return '・' + l; }).join('\n')
      + '[/info]');
  } catch (e) {
    console.warn('下書き通知の送信に失敗しました: ' + e);
  }
}

function notifyError_(context, err) {
  try {
    sendChatwork_('[info][title]⚠ メール下書きの作成でエラー[/title]'
      + '\n処理：' + context
      + '\n内容：' + (err && err.message ? err.message : String(err))
      + '\n\nスプレッドシートのメニューから手動で作成してください。[/info]');
  } catch (e) {
    console.error('エラー通知自体に失敗しました: ' + e);
  }
}

// ═══════════════════════════════════════════════════════════════
//  日付・時刻の表記
// ═══════════════════════════════════════════════════════════════

function startOfDay_(d) { const x = new Date(d.getTime()); x.setHours(0,0,0,0); return x; }
function addDays_(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }
function formatDate_(d, pattern) { return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern); }
function WEEK_() { return ['日','月','火','水','木','金','土']; }

/** 「9月15日（火）」 */
function formatDateJaLong_(d) {
  return formatDate_(d, 'M月d日') + '（' + WEEK_()[d.getDay()] + '）';
}
/** 「9/15（火）」 */
function formatDateJaShort_(d) {
  return formatDate_(d, 'M/d') + '（' + WEEK_()[d.getDay()] + '）';
}
/** 「9/14(月)」（半角かっこ） */
function formatDateJaHalf_(d) {
  return formatDate_(d, 'M/d') + '(' + WEEK_()[d.getDay()] + ')';
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

/** セルの値を Date に変換する */
function toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v || '').trim();
  if (!s) return null;
  const m = s.match(/(\d{4})\s*[年\/\-\.]\s*(\d{1,2})\s*[月\/\-\.]\s*(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** 時刻セルを "10:00" 形式にする */
function formatTime_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return formatDate_(v, 'H:mm');
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  return m ? (Number(m[1]) + ':' + ('0' + Number(m[2])).slice(-2)) : s;
}

function logInfo_(msg) { console.log(msg); }

// ═══════════════════════════════════════════════════════════════
//  手動実行・確認
// ═══════════════════════════════════════════════════════════════

/** 設定状況を確認する */
function showStatus() {
  const lines = ['── 設定状況 ──────────────────────────'];

  var runningAs = '(取得できません)';
  try { runningAs = Session.getEffectiveUser().getEmail() || '(空)'; } catch (e) {}
  lines.push('実行アカウント        : ' + runningAs);
  lines.push('　※下書きはこのアカウントのGmailに入ります');

  try { lines.push('スプレッドシート      : ' + book_().getName()); } catch (e) {
    lines.push('スプレッドシート      : ⚠ ' + e.message);
  }

  try {
    const has = book_().getSheetByName(CONFIG.MAIL_SHEET_NAME) !== null;
    lines.push('メールテンプレート    : ' + (has ? 'あり' : '⚠ なし（②を実行してください）'));
  } catch (e) { lines.push('メールテンプレート    : ⚠ ' + e.message); }

  const props = PropertiesService.getScriptProperties();
  lines.push('CHATWORK_TOKEN        : ' + (props.getProperty('CHATWORK_TOKEN') ? '設定済み' : '⚠ 未設定'));
  lines.push('CHATWORK_ROOM_ID      : ' + (props.getProperty('CHATWORK_ROOM_ID') || '⚠ 未設定'));

  try {
    const s = readSettings_();
    function show(label, names) {
      for (var i = 0; i < names.length; i++) {
        const v = s[names[i]];
        if (v !== undefined && String(v).trim() !== '') {
          return lines.push(label + '：' + String(v).replace(/[\r\n]+/g, ' ／ ').slice(0, 60));
        }
      }
      lines.push(label + '：⚠ 未設定');
    }
    lines.push('── 基本設定から読めた値 ──');
    show('  ZoomURL        ', ['プラチナグルコン ZoomURL', 'グルコン共通ZoomURL', 'ZoomURL']);
    show('  ミーティングID ', ['プラチナグルコン ミーティングID', 'グルコン共通ミーティングID', 'ミーティングID']);
    show('  事前フォームURL', ['プラチナグルコン事前フォームURL', 'グルコン事前フォームURL', '事前フォームURL']);
    show('  合宿予定       ', ['合宿予定']);
    show('  Chatwork宛先   ', ['Chatwork メンション先']);
  } catch (e) {
    lines.push('基本設定              : ⚠ ' + e.message);
  }

  try {
    const events = listEvents_();
    lines.push('── 日程 ──');
    lines.push('  登録件数            : ' + events.length + '件');
    const next = findNextEvent_();
    if (next) {
      lines.push('  次回                : ' + formatDateJaLong_(next.date) + ' '
        + formatTimeRangeJa_(next.startTime, next.endTime));
      lines.push('  下書きを作る日      : '
        + (next.mailSetDate ? formatDateJaLong_(next.mailSetDate) + ' の朝'
           : '⚠「メールセット」列が空です'));
      lines.push('  下書き作成の記録    : ' + (next.draftStatus || '（まだ）'));
    } else {
      lines.push('  次回                : （今日以降の予定なし）');
    }
  } catch (e) {
    lines.push('日程                  : ⚠ ' + e.message);
  }

  const triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  lines.push('設置済みトリガー      : ' + (triggers.length ? triggers.join(' / ') : '(なし)'));
  lines.push('────────────────────────────────────');

  const out = lines.join('\n');
  console.log(out);
  return out;
}

/** 次回の事前案内3通を今すぐ下書きにする（記録は更新しません） */
function manualCreatePreEventDrafts() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降の日程が見つかりません。');
  const made = createPreEventDrafts_(event);
  return formatDateJaLong_(event.date) + ' の下書きを ' + made.length + '通 作成しました（'
    + made.join(' / ') + '）\n\nGmailの「下書き」を確認してください。\n宛先は空です。';
}

/** アーカイブ動画URLが入っている直近の回のアーカイブ下書きを作る */
function manualCreateArchiveDraft() {
  const events = listEvents_().filter(function (e) { return e.archiveUrl; });
  if (events.length === 0) {
    throw new Error('「アーカイブ動画URL」が入力された回がありません。\n'
      + 'スケジュールシートに動画URLを入れてから実行してください。');
  }
  const event = events[events.length - 1];
  const subject = createArchiveDraft_(event);
  return formatDateJaLong_(event.date) + ' のアーカイブ下書きを作成しました。\n\n'
    + subject + '\n\nGmailの「下書き」を確認してください。';
}

/** 差し込み結果をログで確認する（下書きは作りません） */
function previewMailDrafts() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降の日程が見つかりません。');
  const templates = readMailTemplates_();
  const lines = ['── 差し込みプレビュー（下書きは作っていません）──',
                 '対象：' + formatDateJaLong_(event.date), ''];
  CONFIG.PRE_EVENT_TIMINGS.concat(['アーカイブ']).forEach(function (timing) {
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

// ═══════════════════════════════════════════════════════════════
//  初期設定
// ═══════════════════════════════════════════════════════════════

/**
 * ★メールテンプレートシートと、足りない列を自動で用意します。
 *   何度実行しても、すでにあるものは書き換えません。
 */
function setupMailTemplates() {
  const ss = book_();
  const added = [];

  // ① メールテンプレートシート
  var sheet = ss.getSheetByName(CONFIG.MAIL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.MAIL_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['タイミング', '件名', '本文']])
         .setFontWeight('bold').setBackground('#D9D9D9');
    sheet.getRange(2, 1, MAIL_TEMPLATES_.length, 3).setValues(MAIL_TEMPLATES_);
    sheet.setColumnWidth(1, 90);
    sheet.setColumnWidth(2, 420);
    sheet.setColumnWidth(3, 700);
    sheet.getRange(2, 1, MAIL_TEMPLATES_.length, 3).setVerticalAlignment('top').setWrap(true);
    sheet.setFrozenRows(1);
    added.push('「' + CONFIG.MAIL_SHEET_NAME + '」シートを作成し、雛形4通を書き込みました');
  } else {
    added.push('「' + CONFIG.MAIL_SHEET_NAME + '」シートはすでにあります（変更していません）');
  }

  // ② 基本設定に足りない項目（別名で入っていれば追加しません）
  const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  if (settingsSheet) {
    const existing = {};
    settingsSheet.getRange(1, 1, settingsSheet.getLastRow(), 1).getValues()
      .forEach(function (r) { existing[String(r[0] || '').trim()] = true; });
    [
      { aliases: ['プラチナグルコン事前フォームURL', 'グルコン事前フォームURL', '事前フォームURL'],
        row: ['事前フォームURL', '', '🟡 案内メールに載せる回答用URL'] },
      { aliases: ['合宿予定'],
        row: ['合宿予定', '', '🟡 アーカイブメールの {{合宿予定}} に入ります'] },
    ].forEach(function (item) {
      const found = item.aliases.filter(function (a) { return existing[a]; });
      if (found.length > 0) {
        added.push('「基本設定」の『' + found[0] + '』はすでにあります');
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
  [CONFIG.HEADERS.archiveUrl, CONFIG.HEADERS.digestUrl, CONFIG.HEADERS.draftStatus]
    .forEach(function (name) {
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
    + '・「基本設定」の『事前フォームURL』『合宿予定』を確認\n'
    + '・メニュー →「差し込みプレビュー」で中身を確認\n'
    + '・メニュー →「自動実行トリガーを設置」';
  console.log(out);
  return out;
}


// ══════════════════════════════════════════════════════════════
// MailTemplates.gs
// ══════════════════════════════════════════════════════════════

/**
 * プラチナグルコンのメール雛形（初期設定用）
 *
 * setupMailTemplates() を実行すると、この内容が
 * 日程スプレッドシートの「メールテンプレート」シートに書き込まれます。
 * 以降の文言修正は、コードではなく【シート側】で行ってください。
 */

const KOUFU_BLOCK_ =
'【グルコンで添削をご希望の場合の注意点】\n' +
'\n' +
'グルコンで「添削」を希望される方は、下記の要領でご提出ください。\n' +
'円滑かつ公平な進行のため、ご協力をお願いいたします。\n' +
'\n' +
'■ 対象物\n' +
'・スライド\n' +
'・SNS（プロフィール含む）\n' +
'・LP\n' +
'・ホームページ\n' +
'・Googleドキュメント\n' +
'など\n' +
'\n' +
'■ 提出方法\n' +
'1. 事前質問フォームに、対象物のURLリンクを必ず貼り付けてください。\n' +
'2. リンクの閲覧権限を「リンクを知っている全員が閲覧可」に設定してください。（Canva、Googleドキュメント）\n' +
'\n' +
'※グルコン直前の個別メッセージでのリンク送付は受け付けておりません。\n' +
'\n' +
'■ 質問の書き方\n' +
'「見てほしいです／添削してください」の一言ではなく、以下を具体的にお書きください。\n' +
'\n' +
'・特に見てほしい箇所（例：◯ページのヘッドコピー、文言 など）\n' +
'・現状と目的\n' +
'・相談内容・質問（例：A/Bどちらの表現が適切か、第一印象を強める改善案が欲しい など）\n' +
'\n' +
'■ 受付できないケース\n' +
'・リンク未記載のご提出\n' +
'・個別メッセージでの直前送付\n' +
'・閲覧権限が付与されていないリンク';

const SIGNATURE_ = 'Shine A Light 運営事務局';

const MAIL_TEMPLATES_ = [

  ['3日前',
   '【重要】プラチナメンバー限定グルコン！活動報告提出のお願い《{{提出期限短}}12時まで》',
'※このメールは"Shine A Light"のプラチナプログラムに参加されている方へお送りしております。\n' +
'\n' +
'こんにちは。\n' +
'“Shine A Light”運営事務局です。\n' +
'\n' +
'【{{日程}} {{時間帯}}  】\n' +
'にプラチナグルコンがございます。\n' +
'\n' +
'\n' +
'プラチナグルコン前に、\n' +
'活動報告をみなさまにご提出いただきたく\n' +
'ご連絡させていただきます。\n' +
'\n' +
'どんな小さなことでも\n' +
'ハッピーシェアは特に大歓迎です！\n' +
'\n' +
'また、リストの増加、売上の増加に関することは、\n' +
'具体的な数字のご報告もぜひお願いいたします！！\n' +
'\n' +
'それぞれの成功事例、成功法則をシェアし合って、\n' +
'仲間で前へ突き進んで参りましょう〜＾＾\n' +
'\n' +
'\n' +
'＝＝＝＝\n' +
'\n' +
'【重要：活動報告のご提出】\n' +
'\n' +
'\n' +
'以下フォームより\n' +
'ご自身が活動されたことについて\n' +
'ご報告くださいませ。\n' +
'（小さなハッピーシェアも大歓迎！）\n' +
'\n' +
'\n' +
'また、困っていること、相談したいことが\n' +
'ありましたら何でも、\n' +
'どんな小さなことでもいいのでお送りください。\n' +
'\n' +
'\n' +
'【提出期限】\n' +
'{{提出期限}}お昼12時まで\n' +
'\n' +
'\n' +
'プラチナグルコン事前活動報告フォーム＞＞\n' +
'{{事前フォームURL}}\n' +
'\n' +
'\n' +
KOUFU_BLOCK_ + '\n' +
'\n' +
'\n' +
'＝＝＝＝\n' +
'\n' +
'\n' +
'ご案内は以上です。\n' +
'\n' +
'ご不明な点等ある場合は\n' +
'当メールの返信にてご連絡ください。\n' +
'\n' +
'\n' +
SIGNATURE_],

  ['前日',
   '【重要】明日{{開始時}}〜プラチナメンバー限定グルコン詳細・活動報告提出は本日12時まで',
'※このメールは"Shine A Light"のプラチナプログラムに参加されている方へお送りしております。\n' +
'\n' +
'こんにちは。\n' +
'“Shine A Light”運営事務局です。\n' +
'\n' +
'明日のプラチナグルコンの詳細のお知らせと\n' +
'活動報告提出のお願いです。\n' +
'\n' +
'明日【{{日程}} {{時間帯}}】に\n' +
'プラチナグルコンがございます。\n' +
'\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'【グルコン参加URL（Zoom）】\n' +
'\n' +
'{{zoomリンク}}\n' +
'\n' +
'ミーティングID: {{ミーティングID}}\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'※グルコン動画は、後日アーカイブを送付いたします。\n' +
'当日ご都合がつかない方は、アーカイブをご活用ください。\n' +
'\n' +
'\n' +
'※欠席される方は連絡不要です。\n' +
'質問をお送りいただく場合のみ、\n' +
'フォームに一言、欠席についてお書きくださいませ。\n' +
'\n' +
'\n' +
'【活動報告のご提出期限は\n' +
'　本日{{提出期限}}お昼12時まで！】\n' +
'\n' +
'\n' +
'どんな小さなことでも\n' +
'ハッピーシェアは特に大歓迎です！\n' +
'\n' +
'ご自身が活動されたことについて\n' +
'ご報告くださいませ。\n' +
'\n' +
'リストの増加、売上の増加に関することは、\n' +
'具体的な数字のご報告もぜひお願いいたします！！\n' +
'\n' +
'また、困っていること、相談したいことが\n' +
'ありましたら何でも、\n' +
'どんな小さなことでもいいのでお送りください。\n' +
'\n' +
'それぞれの成功事例、成功法則をシェアし合って、\n' +
'仲間で前へ突き進んで参りましょう〜＾＾\n' +
'\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'▼プラチナグルコン事前活動報告フォーム▼\n' +
'{{事前フォームURL}}\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'\n' +
'「プラチナグルコンの報告＆質問のまとめ」には、提出期限までに\n' +
'専用フォームよりご提出いただいた内容のみを掲載させていただきます。\n' +
'\n' +
'提出期限を過ぎてから、ヴォンドラ高橋若菜宛に\n' +
'個別でご連絡いただいた場合でも、内容の掲載はいたしかねますので\n' +
'あらかじめご了承ください。\n' +
'\n' +
'必ず提出期限内にご提出をお願いいたします。\n' +
'\n' +
'なお、受付期限を過ぎたご質問については、グルコン当日に時間がある場合、\n' +
'その場でお受けいたします。\n' +
'\n' +
'\n' +
KOUFU_BLOCK_ + '\n' +
'\n' +
'\n' +
'ご案内は以上です。\n' +
'\n' +
'ご不明な点等ある場合は\n' +
'当メールの返信にてご連絡ください。\n' +
'\n' +
'\n' +
SIGNATURE_],

  ['当日',
   '【重要】本日{{開始時}}～プラチナメンバー限定グルコン詳細',
'※このメールは、"Shine A Light"のプラチナプログラムに参加されている皆さまにお送りしております。\n' +
'\n' +
'\n' +
'こんにちは。\n' +
'“Shine A Light”運営事務局です。\n' +
'\n' +
'本日のプラチナグルコンについて\n' +
'詳細のご案内です。\n' +
'\n' +
'本日【{{日程}}{{時間帯}}】に\n' +
'プラチナグルコンがございます。\n' +
'\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'【グルコン参加URL（Zoom）】\n' +
'\n' +
'{{zoomリンク}}\n' +
'\n' +
'ミーティングID: {{ミーティングID}}\n' +
'\n' +
'＝＝＝＝＝＝＝\n' +
'\n' +
'\n' +
'※グルコン動画は、後日アーカイブを送付いたします。\n' +
'本日ご都合がつかない方は、アーカイブをご活用ください。\n' +
'\n' +
'\n' +
'ご案内は以上です。\n' +
'\n' +
'ご不明な点等ある場合は\n' +
'当メールの返信にてご連絡ください。\n' +
'\n' +
'\n' +
'それでは、後ほどよろしくお願いいたします。\n' +
'\n' +
'\n' +
SIGNATURE_],

  ['アーカイブ',
   '【重要】{{日程}}プラチナグルコンのアーカイブ動画です！',
'※このメールは、"Shine A Light"のプラチナプログラムに参加されている皆さまにお送りしております。\n' +
'\n' +
'こんにちは。\n' +
'Shine A Light 運営事務局です。\n' +
'\n' +
'{{日程}}に\n' +
'開催しましたグルコンの動画を\n' +
'お送りいたします。\n' +
'\n' +
'\n' +
'参加できなかった方や\n' +
'復習したい方は、\n' +
'とても濃い内容になっておりますので\n' +
'ご視聴くださいませ。\n' +
'\n' +
'\n' +
'＝＝＝＝＝＝\n' +
'\n' +
'【プラチナグルコンのアーカイブです】\n' +
'{{アーカイブ動画URL}}\n' +
'\n' +
'＝＝＝＝＝＝\n' +
'\n' +
'\n' +
'【プラチナメンバー活動報告まとめ】\n' +
'{{活動報告まとめURL}}\n' +
'\n' +
'プラチナメンバーの活動報告、質問をもとに\n' +
'グルコンを進めております。\n' +
'素晴らしい報告もいただいておりますので\n' +
'ぜひ目を通してくださいませ。\n' +
'\n' +
'\n' +
'\n' +
'＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n' +
'プラチナグルコン日程\n' +
'＝＝＝＝＝＝＝＝＝＝＝＝＝＝ \n' +
'\n' +
'{{今後の日程}}\n' +
'\n' +
'＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n' +
'今後のプラチナ合宿の予定\n' +
'＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n' +
'\n' +
'{{合宿予定}}\n' +
'\n' +
'\n' +
'ご案内は以上です。\n' +
'\n' +
'ご不明点のお問い合わせは\n' +
'当メールの返信にてご連絡ください。\n' +
'\n' +
'\n' +
SIGNATURE_],

];
