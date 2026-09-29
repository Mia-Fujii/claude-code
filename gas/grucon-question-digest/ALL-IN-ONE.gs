/**
 * ═══════════════════════════════════════════════════════════════
 *  事前質問まとめ 自動化（全部入り 1ファイル版）
 *  グルコン ／ ビギナーグルコン ／ 課題作業会 ／ プラチナグルコン 共用
 * ═══════════════════════════════════════════════════════════════
 *
 *  Googleフォームの「回答」スプレッドシートを開き、
 *  拡張機能 → Apps Script → コード.gs にこれを丸ごと貼り付けてください。
 *
 *  4種類とも【まったく同じコード】を使えます。
 *  貼り付けた回答スプレッドシートのIDから、どの設定を使うかを
 *  自動で判別します（PROFILES を参照）。
 *
 *  ── 貼ったあとにやること ──────────────────────────────
 *    1. 保存（Ctrl+S / ⌘S）
 *    2. スプレッドシートに戻って再読み込み
 *       →「〇〇質問まとめ」メニューが出ます
 *    3. メニュー →「① 設定状況を確認」で【対象イベント】が正しいか確認
 *    4. メニュー →「自動実行トリガーを設置」
 *
 *  ※ Chatworkのトークンはスクリプトごとに登録が必要です
 *     （setChatworkCredentials を実行）
 *
 *  詳しい手順は README.md を参照してください。
 * ═══════════════════════════════════════════════════════════════
 */


// ══════════════════════════════════════════════════════════════
// Config.gs
// ══════════════════════════════════════════════════════════════

/**
 * 事前質問まとめ 自動化
 * ── 設定 ──
 *
 * Chatwork のトークンは、コードではなく
 * 「プロジェクトの設定 > スクリプト プロパティ」に保存してください。
 *
 * 必要なスクリプトプロパティ:
 *   CHATWORK_TOKEN    ... Chatwork APIトークン
 *   CHATWORK_ROOM_ID  ... 通知先ルームID（例: 444552021）
 */

/**
 * ── 対象イベントの設定（プロファイル）──────────────────────
 *
 * このスクリプトは複数のイベントで使い回せます。
 * 貼り付けた回答スプレッドシートのIDから、どの設定を使うかを
 * 自動で判別するので、コードを書き換える必要はありません。
 *
 * 【各項目の意味】
 *   eventName    日程シートの「内容」列とこの文字列が完全一致する行を対象にする。
 *                空文字なら「内容」列を見ずに全行を対象にする。
 *   folder       ドキュメントの保存先。mode は 'term'（期フォルダ）か 'year'（年フォルダ）。
 *   titleFormat  ファイル名の日付部分。titleSuffix がその後ろに付く。
 *   sections     ドキュメントに出す区切り。回答シートの列ごとに1つ。
 */
const PROFILES = {

  'グルコン': {
    label: 'グルコン',
    eventName: 'グルコン',
    masterSpreadsheetId: '1ViN_aCddOoVa3nnqwWlUM5D5LhLEk6YwTSYPNTlNY_I',
    responseSpreadsheetId: '1GsKR1ZzsFo56CRDYtdCnYpDCvqahdH3TcKoMfG-3nHE',
    formId: '',
    folder: {
      mode: 'term',                                        // Shine A Light講座 / {期} / グルコン
      rootFolderId: '1G8svKr3uijCmSs_76-kDxZp5iUs4tUqc',
      name: 'グルコン',
    },
    titleFormat: 'M/d',
    titleSuffix: 'グルコン',                                  // 例: 9/15グルコン
    notifyTemplate: '{title}の質問をまとめました。',             // Chatworkの1行目
    sections: [
      { key: 'question', label: '質問', heading: '', column: 4 },
    ],
    formTitle: 'グルコン事前質問フォーム',
    questionItemTitle: 'ヴォンドラ高橋若菜へのご質問&ご相談',
  },

  'ビギナーグルコン': {
    label: 'ビギナーグルコン',
    eventName: 'サポート講師ビギナーグルコン',
    masterSpreadsheetId: '1ViN_aCddOoVa3nnqwWlUM5D5LhLEk6YwTSYPNTlNY_I',
    responseSpreadsheetId: '1kkXhUm5t2Pkk4iqwOUlm478FWGFkPANxoarHfjTANiw',
    formId: '10jX_9SUmPuuOwW81G64qzhUN1-ShL3ykYiTOdc47qDQ',
    folder: {
      mode: 'term',
      rootFolderId: '1G8svKr3uijCmSs_76-kDxZp5iUs4tUqc',
      name: 'ビギナーグルコン',
    },
    titleFormat: 'M/d',
    titleSuffix: 'ビギナーグルコン',
    notifyTemplate: '{title}の質問をまとめました。',
    sections: [
      { key: 'question', label: '質問', heading: '', column: 4 },
    ],
    formTitle: 'ビギナーグルコン事前質問フォーム',
    questionItemTitle: 'サポート講師へのご質問&ご相談',
  },

  '課題作業会': {
    label: '課題作業会',
    eventName: '課題作業会',
    masterSpreadsheetId: '1ViN_aCddOoVa3nnqwWlUM5D5LhLEk6YwTSYPNTlNY_I',
    responseSpreadsheetId: '1DpOFvFqiJ7cISCEqr8RAJeiSPbNW8Mc_O_xqgd0SU4Y',
    formId: '',
    folder: {
      mode: 'term',
      rootFolderId: '1G8svKr3uijCmSs_76-kDxZp5iUs4tUqc',
      /** ★ビギナーグルコンと同じフォルダに入れています。分けたいときは '課題作業会' に変更 */
      name: 'ビギナーグルコン',
    },
    titleFormat: 'M/d',
    titleSuffix: '課題作業会',
    notifyTemplate: '{title}の質問をまとめました。',
    sections: [
      { key: 'question', label: '質問', heading: '', column: 4 },
    ],
    formTitle: '課題作業会事前質問フォーム',
    questionItemTitle: '「作業会でこんな作業を一緒にしてほしい！〇〇に困っている！」という内容やご質問',
  },

  'プラチナグルコン': {
    label: 'プラチナグルコン',
    /** 日程シートに「内容」列が無く、全行がプラチナグルコンのため空にしています */
    eventName: '',
    masterSpreadsheetId: '1dtCc6zh77apMcLdI-g38NZx9wX2v_m-wZbVGepHsK-4',
    responseSpreadsheetId: '1-9cBhWf_qIPNnzLxVCAoGJH-11uBcM785z6wpNtgO6M',
    formId: '11mPH0vln2KW1nAhUEfc0cxSBe7CRfSRMXmO_eRUolmY',
    folder: {
      mode: 'year',                                        // 親フォルダ / 2026年度
      rootFolderId: '1EG4mFU-A-k9uc3ML0RvJ4UeozSOuTWLx',
      yearSuffix: '年度',                                   // 1/1〜12/31 で切り替わります
      name: '',                                            // 年フォルダの直下に入れる
    },
    titleFormat: 'yyyy/M/d',
    titleSuffix: '活動報告＆質問',                             // 例: 2026/10/6活動報告＆質問
    notifyTemplate: '{title}をまとめました。',
    sections: [
      { key: 'report',   label: '活動報告', heading: '【活動報告】', column: 4 },
      { key: 'question', label: '質問',     heading: '【質問】',     column: 5 },
    ],
    formTitle: 'プラチナグルコン質問受付フォーム',
    questionItemTitle: 'ヴォンドラ高橋若菜へのご質問&ご相談',
  },

};

/** 自動判別できなかったときに使うプロファイル */
const DEFAULT_PROFILE = 'グルコン';

var PROFILE_CACHE_ = null;

/**
 * このスクリプトがどのイベント用かを判定する。
 * ① スクリプトプロパティ PROFILE が設定されていればそれを使う
 * ② 貼り付けられている回答スプレッドシートのIDから自動判別
 * ③ どちらでもなければ DEFAULT_PROFILE
 */
function getProfile_() {
  if (PROFILE_CACHE_) return PROFILE_CACHE_;

  const forced = PropertiesService.getScriptProperties().getProperty('PROFILE');
  if (forced && PROFILES[forced]) {
    PROFILE_CACHE_ = PROFILES[forced];
    return PROFILE_CACHE_;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      const id = ss.getId();
      for (var key in PROFILES) {
        if (PROFILES[key].responseSpreadsheetId === id) {
          PROFILE_CACHE_ = PROFILES[key];
          return PROFILE_CACHE_;
        }
      }
      console.warn('このスプレッドシート（' + id + '）はPROFILESに登録されていません。'
        + '「' + DEFAULT_PROFILE + '」の設定で動きます。');
    }
  } catch (e) {
    // スプレッドシートに紐づいていない場合はここに来る
  }

  PROFILE_CACHE_ = PROFILES[DEFAULT_PROFILE];
  return PROFILE_CACHE_;
}

const CONFIG = {

  // ── マスタスプレッドシートのシート名 ───────────────────
  /** 日程シート（見つかった方を使います） */
  SCHEDULE_SHEET_NAMES: ['スケジュール', 'タスク管理'],
  /** 基本設定シート */
  SETTINGS_SHEET_NAME: '基本設定',

  /** 日程シートのヘッダー名（列の位置ではなく名前で探します） */
  SCHEDULE_HEADERS: {
    eventName: '内容',      // 無い場合は全行が対象になります
    date: '日程',
    dateShort: '日程短',
    startTime: '開始時間',
    endTime: '終了時間',
    owner: '担当者',        // 無い場合は「担当：」の行が出ません
  },

  // ── 回答スプレッドシートの共通列（1始まり） ─────────────
  RESPONSE_SHEET_NAME: '',   // 空ならブックの最初のシート
  RESPONSE_COLUMNS: {
    timestamp: 1,  // A タイムスタンプ
    email:     2,  // B メールアドレス
    name:      3,  // C お名前
    // 回答本文の列は PROFILES の sections で指定します
  },

  // ── スケジュール ────────────────────────────────────────
  /** フォームを開く：グルコン日の何日前か */
  OPEN_DAYS_BEFORE: 5,
  /** フォームを閉じる：グルコン日の何日前か（1 = 前日） */
  CLOSE_DAYS_BEFORE: 1,
  /** 締切時刻（前日 13:00） */
  CLOSE_HOUR: 13,
  CLOSE_MINUTE: 0,
  /** Chatwork送信時刻（前日 13:30） */
  NOTIFY_HOUR: 13,
  NOTIFY_MINUTE: 30,
  /** 毎日の判定処理を回す時刻 */
  PLANNER_HOUR: 6,
  /** 取りこぼし救済（13:30の処理が落ちていたらここで再実行） */
  SAFETY_NET_HOUR: 15,

  // ── 名寄せ・重複判定 ───────────────────────────────────
  /** メールアドレスが違っても、お名前が完全一致すれば同一人物とみなす */
  MERGE_BY_NAME: true,

  // ── ドキュメントの書式 ─────────────────────────────────
  DOC: {
    FONT_FAMILY: 'Arial',
    NAME_FONT_SIZE: 14,
    NAME_BOLD: true,
    /** 名前の背景色（黄色） */
    NAME_HIGHLIGHT: '#FFE599',
    BODY_FONT_SIZE: 11,
    /** 区切りの見出し（【活動報告】など）を太字にするか */
    HEADING_BOLD: true,
    /** 2件目以降の質問の前に入れる見出し */
    ADDENDUM_LABEL: '追記：',
    /** 人と人のあいだに入れる空行の数（次のお名前の手前） */
    BLANK_LINES_BETWEEN_PEOPLE: 2,
    /** 同じ人の「追記：」の手前に入れる空行の数 */
    BLANK_LINES_BEFORE_ADDENDUM: 1,
    /** 区切り（【活動報告】→【質問】）のあいだに入れる空行の数 */
    BLANK_LINES_BETWEEN_SECTIONS: 2,
    /** 自動処理メモをドキュメント末尾にも入れるか（既定は入れない＝Chatworkのみ） */
    INCLUDE_NOTES: false,
    /** 作成したドキュメントを「リンクを知っている全員が閲覧可」にするか */
    SHARE_ANYONE_WITH_LINK: true,
  },

  // ── 動作モード ─────────────────────────────────────────
  /** true にすると Chatwork に実際には送らず、ログに出すだけ */
  DRY_RUN: false,

  TIMEZONE: 'Asia/Tokyo',

  // ── フォールバック（プロファイルに無い場合のみ使われます）──
  MASTER_SPREADSHEET_ID: '',
  RESPONSE_SPREADSHEET_ID: '',
  FORM_ID: '',
};

/** スクリプトプロパティを優先して設定値を取得する */
function cfg_(key) {
  const prop = PropertiesService.getScriptProperties().getProperty(key);
  if (prop !== null && String(prop).trim() !== '') return String(prop).trim();
  return CONFIG[key] || '';
}

/** スクリプトプロパティ → プロファイル → CONFIG の順に探す */
function idFor_(propKey, profileKey) {
  const prop = PropertiesService.getScriptProperties().getProperty(propKey);
  if (prop !== null && String(prop).trim() !== '') return String(prop).trim();
  try {
    const value = getProfile_()[profileKey];
    if (value) return value;
  } catch (e) { /* noop */ }
  return CONFIG[propKey] || '';
}

function getMasterSpreadsheetId_()   { return idFor_('MASTER_SPREADSHEET_ID', 'masterSpreadsheetId'); }
function getResponseSpreadsheetId_() { return idFor_('RESPONSE_SPREADSHEET_ID', 'responseSpreadsheetId'); }
function getFormIdSetting_()         { return idFor_('FORM_ID', 'formId'); }


// ══════════════════════════════════════════════════════════════
// Util.gs
// ══════════════════════════════════════════════════════════════

/**
 * 共通ユーティリティ
 */

function tz_() { return CONFIG.TIMEZONE; }

function startOfDay_(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays_(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** セルの値を Date に変換する（Date / 文字列 の両方に対応） */
function toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v || '').trim();
  if (!s) return null;
  // 「2026年8月20日（木）」「2026/8/20」「2026-08-20」に対応
  const m = s.match(/(\d{4})\s*[年\/\-\.]\s*(\d{1,2})\s*[月\/\-\.]\s*(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** 時刻セルを "10:00" 形式の文字列にする */
function formatTime_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, tz_(), 'H:mm');
  }
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  return m ? (Number(m[1]) + ':' + ('0' + Number(m[2])).slice(-2)) : s;
}

function formatDate_(d, pattern) {
  return Utilities.formatDate(d, tz_(), pattern);
}

/** 「8/20（木）」形式 */
function formatDateJa_(d) {
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return formatDate_(d, 'M/d') + '（' + week + '）';
}

/**
 * 全角英数記号を半角に、全角スペースを半角に揃える
 */
function toHalfWidth_(s) {
  return String(s)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[！-～]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    .replace(/　/g, ' ');
}

/** 空白を一切除いた比較用の文字列を作る */
function stripSpaces_(s) {
  return String(s).replace(/[\s　]+/g, '');
}

/**
 * メールアドレスの正規化キー。
 * 前後空白の除去 → 半角化 → 小文字化 → 内部の空白除去。
 */
function normalizeEmail_(s) {
  const t = stripSpaces_(toHalfWidth_(String(s || '').trim())).toLowerCase();
  return t.indexOf('@') > 0 ? t : '';
}

/** お名前の正規化キー（空白をすべて除去して比較する） */
function normalizeName_(s) {
  return stripSpaces_(toHalfWidth_(String(s || '').trim())).toLowerCase();
}

/**
 * 質問本文の「完全一致」判定キー。
 * 改行・空白の違いと全角半角の違いだけを吸収します。
 * 言い回しが少しでも違えば別の質問として扱われます。
 */
function normalizeQuestion_(s) {
  return stripSpaces_(toHalfWidth_(String(s || ''))).toLowerCase();
}

/** 文字列からURLを取り出す（リンク化用） */
function findUrls_(text) {
  const re = /https?:\/\/[^\s　"'<>）)]+/g;
  const out = [];
  var m;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length - 1, url: m[0] });
  }
  return out;
}

function logInfo_(msg) {
  console.log(msg);
}


// ══════════════════════════════════════════════════════════════
// Schedule.gs
// ══════════════════════════════════════════════════════════════

/**
 * マスタスプレッドシート（Shine A Light_メール設定）の読み取り
 */

/** マスタスプレッドシートを開く */
function openMaster_() {
  const id = getMasterSpreadsheetId_();
  if (!id) throw new Error('日程スプレッドシートのIDが設定されていません。');
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
  const iName = header.indexOf(H.eventName);   // 無ければ -1（全行が対象）
  const iDate = col(H.date);
  const iShort = header.indexOf(H.dateShort);
  const iStart = header.indexOf(H.startTime);
  const iEnd = header.indexOf(H.endTime);
  const iOwner = header.indexOf(H.owner);

  const target = getProfile_().eventName;
  const events = [];

  for (var r = 1; r < values.length; r++) {
    const row = values[r];
    // 対象イベント名が指定されていれば「内容」列と完全一致する行だけを拾う。
    // 指定が無い（または「内容」列が無い）シートは、全行を対象とする。
    if (target && iName >= 0 && String(row[iName] || '').trim() !== target) continue;
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


// ══════════════════════════════════════════════════════════════
// Responses.gs
// ══════════════════════════════════════════════════════════════

/**
 * フォーム回答の読み取り・名寄せ・重複統合
 */

/** 回答スプレッドシートのシートを取得 */
function getResponseSheet_() {
  // ① 貼り付けられているスプレッドシートをそのまま使う
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // ② スタンドアロン実行時は、設定またはプロファイルのIDを使う
  if (!ss) {
    const id = getResponseSpreadsheetId_();
    if (!id) throw new Error('回答スプレッドシートが特定できません。');
    ss = SpreadsheetApp.openById(id);
  }
  if (CONFIG.RESPONSE_SHEET_NAME) {
    const sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME);
    if (!sheet) throw new Error('回答シート「' + CONFIG.RESPONSE_SHEET_NAME + '」が見つかりません。');
    return sheet;
  }
  return ss.getSheets()[0];
}

/**
 * 収録期間内の回答を読み込む。
 * 回答本文はプロファイルの sections で指定された列ごとに取り出します。
 * @return {Array<{timestamp: Date, email: string, name: string,
 *                 answers: Object<string,string>, row: number}>}
 */
function readResponsesInWindow_(windowStart, windowEnd) {
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const C = CONFIG.RESPONSE_COLUMNS;
  const sections = getProfile_().sections;
  var maxCol = Math.max(C.timestamp, C.email, C.name);
  sections.forEach(function (s) { maxCol = Math.max(maxCol, s.column); });

  if (sheet.getLastColumn() < maxCol) {
    throw new Error('回答シートの列が足りません（' + maxCol + '列必要）。'
      + 'A:タイムスタンプ / B:メールアドレス / C:お名前 / D以降:回答 の並びを想定しています。');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  const out = [];
  for (var i = 0; i < values.length; i++) {
    const row = values[i];
    const ts = toDate_(row[C.timestamp - 1]);
    if (!ts) continue;
    if (ts < windowStart || ts > windowEnd) continue;

    const answers = {};
    var hasAny = false;
    sections.forEach(function (s) {
      const text = String(row[s.column - 1] || '').trim();
      answers[s.key] = text;
      if (text) hasAny = true;
    });
    if (!hasAny) continue;   // すべて空欄の回答は載せない

    out.push({
      timestamp: ts,
      email: String(row[C.email - 1] || '').trim(),
      name: String(row[C.name - 1] || '').trim(),
      answers: answers,
      row: i + 2,
    });
  }
  out.sort(function (a, b) { return a.timestamp - b.timestamp; });
  return out;
}

/**
 * 回答を区切り（活動報告／質問 など）ごとに集約する。
 * 区切りが1つだけのイベントでも同じ形で扱えます。
 *
 * @return {{sections: Array, notes: Array<string>, stats: Object}}
 */
function buildSections_(responses) {
  const sections = getProfile_().sections;
  const multi = sections.length > 1;
  const notes = [];
  const built = [];

  sections.forEach(function (sec) {
    const subset = responses
      .filter(function (r) { return String(r.answers[sec.key] || '').trim() !== ''; })
      .map(function (r) {
        return {
          timestamp: r.timestamp,
          email: r.email,
          name: r.name,
          question: String(r.answers[sec.key]).trim(),
          row: r.row,
        };
      });
    const result = buildGroups_(subset, sec.label);
    // 同じ内容のメモ（名前の表記ゆれなど）が区切りをまたいで重複しないようにする
    result.notes.forEach(function (n) {
      if (notes.indexOf(n) < 0) notes.push(n);
    });
    built.push({ key: sec.key, label: sec.label, heading: sec.heading, result: result });
  });

  const stats = {
    responseCount: responses.length,
    sections: built.map(function (b) {
      return {
        label: b.label,
        personCount: b.result.stats.personCount,
        questionCount: b.result.stats.questionCount,
        duplicateCount: b.result.stats.duplicateCount,
      };
    }),
  };

  return { sections: built, notes: notes, stats: stats };
}

/**
 * 回答を「人」でグルーピングし、完全一致の重複質問を統合する。
 *
 * @return {{groups: Array, notes: Array<string>, stats: Object}}
 *   groups: [{displayName, email, entries: [{question, timestamp}], duplicates: n, aliasNames: []}]
 *   notes : 自動処理メモ（Chatworkに載せる補足）
 */
function buildGroups_(responses, noun) {
  const label = noun || '質問';
  const notes = [];
  const byKey = {};      // 正規化キー → グループ
  const order = [];      // 出現順

  // ── 第1段階：メールアドレス（無ければ名前）でグルーピング ──
  responses.forEach(function (r) {
    const emailKey = normalizeEmail_(r.email);
    const nameKey = normalizeName_(r.name);
    const key = emailKey ? 'mail:' + emailKey : (nameKey ? 'name:' + nameKey : 'row:' + r.row);

    if (!byKey[key]) {
      byKey[key] = {
        key: key,
        emailKey: emailKey,
        nameKey: nameKey,
        displayName: r.name || r.email || '(お名前未記入)',
        email: r.email,
        names: [],
        emails: [],
        entries: [],
        duplicateCount: 0,
        duplicateSamples: [],
        mergedByName: false,
      };
      order.push(key);
    }
    const g = byKey[key];
    if (r.name && g.names.indexOf(r.name) < 0) g.names.push(r.name);
    if (r.email && g.emails.indexOf(r.email) < 0) g.emails.push(r.email);
    if (!g.displayName || g.displayName === '(お名前未記入)') {
      if (r.name) g.displayName = r.name;
    }
    g.entries.push({ question: r.question, timestamp: r.timestamp, row: r.row });
  });

  var groups = order.map(function (k) { return byKey[k]; });

  // ── 第2段階：お名前が完全一致するグループを統合 ──
  if (CONFIG.MERGE_BY_NAME) {
    const nameIndex = {};
    const merged = [];
    groups.forEach(function (g) {
      const nk = g.nameKey || normalizeName_(g.displayName);
      if (nk && nameIndex[nk]) {
        const base = nameIndex[nk];
        base.entries = base.entries.concat(g.entries);
        base.entries.sort(function (a, b) { return a.timestamp - b.timestamp; });
        g.emails.forEach(function (e) { if (base.emails.indexOf(e) < 0) base.emails.push(e); });
        base.mergedByName = true;
        notes.push('【要確認】' + base.displayName + ' さん：メールアドレスが異なる回答（'
          + base.emails.join(' / ') + '）を、お名前が同じため同一人物として統合しました');
      } else {
        if (nk) nameIndex[nk] = g;
        merged.push(g);
      }
    });
    groups = merged;
  }

  // ── 第3段階：グループ内の完全一致の重複質問を除去 ──
  groups.forEach(function (g) {
    const seen = {};
    const kept = [];
    g.entries.forEach(function (e) {
      const qk = normalizeQuestion_(e.question);
      if (seen[qk]) {
        g.duplicateCount++;
        if (g.duplicateSamples.length < 3) {
          g.duplicateSamples.push(summarize_(e.question));
        }
        return;
      }
      seen[qk] = true;
      kept.push(e);
    });
    g.entries = kept;
  });

  // ── メモを組み立てる ──
  groups.forEach(function (g) {
    if (g.duplicateCount > 0) {
      notes.push(g.displayName + ' さん：まったく同じ内容の' + label + 'が '
        + (g.duplicateCount + 1) + ' 件送信されていたため、1件に統合しました'
        + (g.duplicateSamples.length ? '（「' + g.duplicateSamples[0] + '」）' : ''));
    }
    if (g.entries.length > 1) {
      notes.push(g.displayName + ' さん：内容の異なる' + label + 'が ' + g.entries.length
        + ' 件あったため、お名前の下にまとめました（2件目以降は「'
        + CONFIG.DOC.ADDENDUM_LABEL + '」として記載）');
    }
    // 空白の全角/半角など、正規化して同じになる違いは報告しない
    const distinctNames = [];
    g.names.forEach(function (n) {
      const k = normalizeName_(n);
      if (distinctNames.every(function (x) { return normalizeName_(x) !== k; })) distinctNames.push(n);
    });
    if (distinctNames.length > 1) {
      notes.push('【要確認】お名前の表記ゆれがあります：' + distinctNames.join(' / ')
        + '（メールアドレスが同じため同一人物として扱いました）');
    }
  });

  const stats = {
    responseCount: responses.length,
    personCount: groups.length,
    questionCount: groups.reduce(function (s, g) { return s + g.entries.length; }, 0),
    duplicateCount: groups.reduce(function (s, g) { return s + g.duplicateCount; }, 0),
  };

  return { groups: groups, notes: notes, stats: stats };
}

/** 長い質問文を短く要約表示する */
function summarize_(text, max) {
  const limit = max || 30;
  const oneLine = String(text).replace(/[\r\n]+/g, ' ').trim();
  return oneLine.length > limit ? oneLine.slice(0, limit) + '…' : oneLine;
}


// ══════════════════════════════════════════════════════════════
// Document.gs
// ══════════════════════════════════════════════════════════════

/**
 * Googleドキュメントの生成
 *   保存先: Shine A Light講座 / {期} / グルコン / 8/20グルコン
 */

/** 親フォルダの下から名前でフォルダを探す。無ければ作る。 */
function getOrCreateFolder_(parent, name, createdLog) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  const created = parent.createFolder(name);
  if (createdLog) createdLog.push(name);
  logInfo_('フォルダを新規作成しました: ' + name);
  return created;
}

/**
 * 保存先フォルダを用意する。
 *   mode 'term' … ルート / {期} / {name}        例: Shine A Light講座 / 21期 / グルコン
 *   mode 'year' … ルート / {開催年}年度 / {name} 例: 親フォルダ / 2026年度
 * name が空なら、その1階層は掘りません。
 */
function resolveTargetFolder_(createdLog, eventDate) {
  const profile = getProfile_();
  const spec = profile.folder;
  if (!spec || !spec.rootFolderId) {
    throw new Error('保存先フォルダ（folder.rootFolderId）が設定されていません。');
  }
  const root = DriveApp.getFolderById(spec.rootFolderId);

  var middle;
  if (spec.mode === 'year') {
    if (!eventDate) throw new Error('年フォルダを決めるための開催日がありません。');
    // 1月1日〜12月31日で切り替わります
    middle = formatDate_(eventDate, 'yyyy') + (spec.yearSuffix || '年度');
  } else {
    middle = getTermName_();          // 例: 21期
  }

  var folder = getOrCreateFolder_(root, middle, createdLog);
  var path = root.getName() + ' / ' + middle;

  if (spec.name) {
    folder = getOrCreateFolder_(folder, spec.name, createdLog);
    path += ' / ' + spec.name;
  }

  return { folder: folder, path: path, term: middle };
}

/** ドキュメントのファイル名（例: "9/15グルコン" / "2026/10/6活動報告＆質問"） */
function buildDocTitle_(eventDate) {
  const profile = getProfile_();
  return formatDate_(eventDate, profile.titleFormat) + profile.titleSuffix;
}

/** 同名のドキュメントがあればそれを使い、無ければ作る */
function getOrCreateDoc_(folder, title) {
  const it = folder.getFilesByName(title);
  while (it.hasNext()) {
    const file = it.next();
    if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
      return { doc: DocumentApp.openById(file.getId()), created: false };
    }
  }
  const doc = DocumentApp.create(title);
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  return { doc: doc, created: true };
}

/**
 * まとめドキュメントを作成（既存があれば中身を作り直す）
 *
 * @param {Object} event  対象イベント
 * @param {Object} built  buildSections_() の結果
 * @param {string=} titleOverride ファイル名を指定したいとき（テスト用）
 * @return {{url, title, path, term, createdFolders, isNew, sharing}}
 */
function buildDigestDocument_(event, built, titleOverride) {
  const createdFolders = [];
  const target = resolveTargetFolder_(createdFolders, event.date);
  const title = titleOverride || buildDocTitle_(event.date);

  const res = getOrCreateDoc_(target.folder, title);
  const doc = res.doc;
  const body = doc.getBody();

  // 何度実行しても増殖しないよう、いったん中身を空にする
  body.clear();

  const D = CONFIG.DOC;
  const sections = built.sections;
  const anyContent = sections.some(function (sec) { return sec.result.groups.length > 0; });

  if (!anyContent) {
    appendLine_(body, 'この期間に回答はありませんでした。');
  }

  var wroteSomething = false;
  sections.forEach(function (sec) {
    // 区切りが複数あるとき、中身が無い区切りは見出しごと省く
    if (sections.length > 1 && sec.result.groups.length === 0) return;

    if (wroteSomething) appendBlanks_(body, D.BLANK_LINES_BETWEEN_SECTIONS);

    if (sec.heading) {
      const h = appendLine_(body, sec.heading);
      if (D.HEADING_BOLD) h.editAsText().setBold(true);
      appendBlank_(body);
    }

    sec.result.groups.forEach(function (g, gi) {
      if (gi > 0) appendBlanks_(body, D.BLANK_LINES_BETWEEN_PEOPLE);

      // ── お名前（少し大きく・太字・黄色背景） ──
      const namePara = body.appendParagraph(g.displayName);
      namePara.editAsText()
              .setFontFamily(D.FONT_FAMILY)
              .setFontSize(D.NAME_FONT_SIZE)
              .setBold(D.NAME_BOLD)
              .setBackgroundColor(D.NAME_HIGHLIGHT);

      // ── 本文 ──
      g.entries.forEach(function (entry, ei) {
        if (ei > 0) {
          appendBlanks_(body, D.BLANK_LINES_BEFORE_ADDENDUM);
          appendLine_(body, D.ADDENDUM_LABEL);
        }
        appendBodyText_(body, entry.question);
      });
    });

    wroteSomething = true;
  });

  if (D.INCLUDE_NOTES && built.notes.length > 0) {
    appendBlanks_(body, D.BLANK_LINES_BETWEEN_SECTIONS);
    appendLine_(body, '──────────');
    appendLine_(body, '■ 自動処理メモ');
    built.notes.forEach(function (n) { appendLine_(body, '・' + n); });
  }

  // 先頭に残る空段落を掃除する
  cleanupLeadingEmpty_(body);

  doc.saveAndClose();

  const sharing = applySharing_(doc.getId());

  return {
    url: doc.getUrl(),
    title: title,
    path: target.path,
    term: target.term,
    createdFolders: createdFolders,
    isNew: res.created,
    sharing: sharing,
  };
}

/**
 * ドキュメントを「リンクを知っている全員が閲覧可」にする。
 * 会社アカウントのポリシーで外部共有が禁止されている場合は失敗するため、
 * 失敗しても処理は止めず、結果を返して通知に載せます。
 */
function applySharing_(fileId) {
  if (!CONFIG.DOC.SHARE_ANYONE_WITH_LINK) {
    return { changed: false, ok: true, label: 'フォルダの共有設定を引き継ぎ' };
  }
  try {
    DriveApp.getFileById(fileId)
      .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    logInfo_('共有設定：リンクを知っている全員が閲覧可');
    return { changed: true, ok: true, label: 'リンクを知っている全員が閲覧可' };
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.warn('共有設定の変更に失敗しました: ' + msg);
    return { changed: true, ok: false, label: '⚠ 共有設定の変更に失敗（' + msg + '）' };
  }
}

/** 空行を指定した数だけ追加 */
function appendBlanks_(body, count) {
  const n = (typeof count === 'number' && count >= 0) ? count : 1;
  for (var i = 0; i < n; i++) appendBlank_(body);
}

/** 空行を1つ追加 */
function appendBlank_(body) {
  const p = body.appendParagraph('');
  p.editAsText().setFontFamily(CONFIG.DOC.FONT_FAMILY).setFontSize(CONFIG.DOC.BODY_FONT_SIZE);
  return p;
}

/** 1行を本文書式で追加 */
function appendLine_(body, line) {
  const p = body.appendParagraph(line);
  const t = p.editAsText();
  t.setFontFamily(CONFIG.DOC.FONT_FAMILY)
   .setFontSize(CONFIG.DOC.BODY_FONT_SIZE)
   .setBold(false)
   .setBackgroundColor(null);
  return p;
}

/**
 * 複数行の本文を、改行を保ったまま追加する。
 * 本文中のURLは自動でリンクにします。
 */
function appendBodyText_(body, text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  lines.forEach(function (line) {
    const p = appendLine_(body, line);
    if (!line) return;
    const t = p.editAsText();
    findUrls_(line).forEach(function (u) {
      t.setLinkUrl(u.start, u.end, u.url);
    });
  });
}

/** body.clear() 直後に残る空段落を取り除く */
function cleanupLeadingEmpty_(body) {
  while (body.getNumChildren() > 1) {
    const first = body.getChild(0);
    if (first.getType() === DocumentApp.ElementType.PARAGRAPH &&
        first.asParagraph().getText() === '') {
      body.removeChild(first);
    } else {
      break;
    }
  }
}


// ══════════════════════════════════════════════════════════════
// FormControl.gs
// ══════════════════════════════════════════════════════════════

/**
 * Googleフォームの自動開閉
 *
 * フォームIDは、この回答スプレッドシートに紐づいているフォームから
 * 自動で判別します。手で設定する必要はありません。
 * （うまくいかない場合だけ setFormIds() でIDを登録してください）
 */

/**
 * 対象のフォームを取得する。見つからなければ null を返す。
 */
function getFormOrNull_() {
  // ① スクリプトプロパティ／プロファイル／CONFIG のIDを使う
  const id = getFormIdSetting_();
  if (id) {
    try {
      return FormApp.openById(id);
    } catch (e) {
      console.warn('設定されたフォームIDで開けませんでした: ' + e);
    }
  }

  // ② 回答スプレッドシートに紐づいているフォームを自動検出する
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      const responseId = getResponseSpreadsheetId_();
      if (responseId) ss = SpreadsheetApp.openById(responseId);
    }
    if (ss) {
      const formUrl = ss.getFormUrl();
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        // 次回以降のために覚えておく
        PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());
        logInfo_('回答シートに紐づくフォームを自動検出しました：' + form.getTitle());
        return form;
      }
    }
  } catch (e) {
    console.warn('フォームの自動検出に失敗しました: ' + e);
  }

  return null;
}

/** 対象のフォームを取得する（見つからなければエラー） */
function getForm_() {
  const form = getFormOrNull_();
  if (!form) {
    throw new Error(
      'フォームが見つかりませんでした。\n\n'
      + 'この回答スプレッドシートにGoogleフォームが紐づいていないようです。\n'
      + '・Googleフォームの「回答」タブ →「スプレッドシートにリンク」で\n'
      + '　このシートに紐づけてください。\n'
      + '・または setFormIds() でフォームのIDを登録してください。'
    );
  }
  return form;
}

/** フォームが使える状態かどうか */
function hasForm_() {
  return getFormOrNull_() !== null;
}

function openForm_() { return setFormAccepting_(true); }
function closeForm_() { return setFormAccepting_(false); }

/**
 * フォームの受付状態を変更する
 * @return {'changed'|'unchanged'} 変更したか
 */
function setFormAccepting_(accepting) {
  const form = getForm_();
  if (form.isAcceptingResponses() === accepting) {
    logInfo_('フォームはすでに' + (accepting ? '受付中' : '締切済み') + 'です。');
    return 'unchanged';
  }
  form.setAcceptingResponses(accepting);
  logInfo_('フォームを' + (accepting ? 'オープン' : 'クローズ') + 'しました。');
  return 'changed';
}

/**
 * 自動実行から呼ぶ用。フォーム未設定なら、エラーにせずログだけ残してスキップする。
 * @return {boolean} 実行できたか
 */
function setFormAcceptingIfAvailable_(accepting) {
  if (!hasForm_()) {
    logInfo_('⚠ フォームが未設定のため、'
      + (accepting ? 'オープン' : 'クローズ') + '処理をスキップしました。');
    return false;
  }
  setFormAccepting_(accepting);
  return true;
}

/** フォームの受付状態（未設定なら null） */
function isFormAccepting_() {
  const form = getFormOrNull_();
  return form ? form.isAcceptingResponses() : null;
}

/** フォームの回答用URL（未設定なら空文字） */
function getFormPublishedUrl_() {
  const form = getFormOrNull_();
  return form ? form.getPublishedUrl() : '';
}

/**
 * 締切後の表示メッセージを、次回グルコンの日付に合わせて更新する
 */
function updateClosedMessage_(nextEvent) {
  const form = getFormOrNull_();
  if (!form) return;
  var msg = '事前質問の受付は終了しました。ご質問ありがとうございました。';
  if (nextEvent) {
    msg += '\n次回グルコン（' + formatDateJa_(nextEvent.date) + '）の受付は '
        + formatDateJa_(addDays_(nextEvent.date, -CONFIG.OPEN_DAYS_BEFORE)) + ' に開始します。';
  }
  try {
    form.setCustomClosedFormMessage(msg);
  } catch (e) {
    console.warn('締切メッセージの更新に失敗しました: ' + e);
  }
}


// ══════════════════════════════════════════════════════════════
// Chatwork.gs
// ══════════════════════════════════════════════════════════════

/**
 * Chatwork通知
 *
 * トークンとルームIDは「プロジェクトの設定 > スクリプト プロパティ」に
 * CHATWORK_TOKEN / CHATWORK_ROOM_ID として保存してください。
 */

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

function getChatworkCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('CHATWORK_TOKEN') || '').trim();
  const roomId = (props.getProperty('CHATWORK_ROOM_ID') || '').trim();
  if (!token) throw new Error('スクリプトプロパティ CHATWORK_TOKEN が未設定です。');
  if (!roomId) throw new Error('スクリプトプロパティ CHATWORK_ROOM_ID が未設定です。');
  return { token: token, roomId: roomId };
}

/** Chatworkにメッセージを送信する */
function sendChatwork_(message) {
  if (CONFIG.DRY_RUN) {
    logInfo_('[DRY_RUN] Chatworkには送信していません。本文:\n' + message);
    return { dryRun: true };
  }
  const cred = getChatworkCredentials_();
  const res = UrlFetchApp.fetch(
    CHATWORK_API_BASE + '/rooms/' + encodeURIComponent(cred.roomId) + '/messages',
    {
      method: 'post',
      headers: { 'X-ChatWorkToken': cred.token },
      payload: { body: message },
      muteHttpExceptions: true,
    }
  );
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Chatwork送信に失敗しました (HTTP ' + code + '): ' + res.getContentText());
  }
  logInfo_('Chatworkに送信しました。');
  return JSON.parse(res.getContentText());
}

/**
 * 質問まとめの通知メッセージを組み立てる
 */
function buildNotificationMessage_(event, built, docInfo) {
  const settings = readSettings_();
  const mention = String(settings['Chatwork メンション先'] || '').trim();

  // ── 本文 ──────────────────────────────────────────────
  const lines = [];
  if (mention) lines.push(mention);
  if (event && event.owner) lines.push('担当：' + event.owner);
  if (lines.length > 0) lines.push('');

  const template = getProfile_().notifyTemplate || '{title}の質問をまとめました。';
  lines.push(template.replace('{title}', docInfo.title));
  lines.push('ご確認お願いいたします！');
  lines.push(docInfo.url);

  // ── 補足 ──────────────────────────────────────────────
  const notes = [];
  const s = built.stats;
  notes.push('回答 ' + s.responseCount + '件');
  s.sections.forEach(function (sec) {
    notes.push('　' + sec.label + '：' + sec.personCount + '名 ／ 掲載 ' + sec.questionCount + '件'
      + (sec.duplicateCount > 0 ? '（重複 ' + sec.duplicateCount + '件を除外）' : ''));
  });
  notes.push('保存先：' + docInfo.path);
  if (docInfo.sharing) notes.push('共有　：' + docInfo.sharing.label);

  if (built.notes.length > 0) {
    notes.push('');
    notes.push('■ 自動処理の補足');
    built.notes.forEach(function (n) { notes.push('・' + n); });
  }

  if (docInfo.createdFolders.length > 0) {
    notes.push('');
    notes.push('※ フォルダを新規作成しました：' + docInfo.createdFolders.join(' / '));
    notes.push('　 保存先が正しいかご確認ください');
  }

  lines.push('');
  lines.push('[info][title]補足[/title]');
  lines.push(notes.join('\n'));
  lines.push('[/info]');

  return lines.join('\n');
}

/** エラーをChatworkに知らせる */
function notifyError_(context, err) {
  try {
    const message = '[info][title]⚠ グルコン質問まとめ処理でエラー[/title]'
      + '\n処理：' + context
      + '\n内容：' + (err && err.message ? err.message : String(err))
      + '\n\n手動で manualBuildAndNotify() を実行してください。[/info]';
    sendChatwork_(message);
  } catch (e) {
    console.error('エラー通知自体に失敗しました: ' + e);
  }
}


// ══════════════════════════════════════════════════════════════
// Main.gs
// ══════════════════════════════════════════════════════════════

/**
 * エントリポイントとトリガー管理
 *
 * ── 動作の流れ ────────────────────────────────────────────
 *   毎日 6:00  dailyPlanner()
 *       ・今日がグルコンの5日前 → フォームをオープン
 *       ・今日がグルコンの前日   → 13:00 と 13:30 の単発トリガーを仕込む
 *   前日 13:00  closeFormNow()        フォームをクローズ
 *   前日 13:30  buildAndNotifyNow()   ドキュメント作成 → Chatwork送信
 *   毎日 15:00  dailySafetyNet()      上が落ちていたらここで実行し直す
 *
 *   ※ GASの定期トリガーは指定時刻から±15分ほどずれます。
 *      13:00 / 13:30 だけは単発トリガー（at）を使い、ずれを最小にしています。
 */

// ─────────────────────────────────────────────────────────
//  セットアップ
// ─────────────────────────────────────────────────────────

/** ★最初に1回だけ実行する：トリガーを設置します */
function setupInstallTriggers() {
  removeAllTriggers();

  ScriptApp.newTrigger('dailyPlanner')
    .timeBased().atHour(CONFIG.PLANNER_HOUR).nearMinute(0).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();

  ScriptApp.newTrigger('dailySafetyNet')
    .timeBased().atHour(CONFIG.SAFETY_NET_HOUR).nearMinute(0).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();

  logInfo_('トリガーを設置しました：dailyPlanner（'
    + CONFIG.PLANNER_HOUR + '時）／ dailySafetyNet（' + CONFIG.SAFETY_NET_HOUR + '時）');

  // ★今日の朝の処理を取り逃していないか、その場で追いつかせる。
  //   （朝6時を過ぎてから設置した場合、次に走るのは翌朝になってしまうため）
  logInfo_('本日分の処理に追いつかせます…');
  catchUpToday();

  showStatus();
}

/**
 * 「今日やるべきだったこと」をその場で実行する。
 *
 * ・今日がグルコンの5日前なら → フォームを開く
 * ・今日が前日なら → 締切時刻を過ぎていればフォームを閉じ、
 *   送信時刻を過ぎていれば質問まとめを作ってChatworkへ送る。
 *   まだ時刻前なら、その時刻の単発トリガーを仕込む。
 *
 * トリガーを朝6時より後に設置したときや、
 * 何らかの理由で自動実行が飛んだときの追いつき用です。
 */
function catchUpToday() {
  const done = [];

  // ① フォームのオープン（5日前）＋受付期間中の開けっ放し確認
  const openTarget = findEventByDaysAhead_(CONFIG.OPEN_DAYS_BEFORE);
  if (openTarget && setFormAcceptingIfAvailable_(true)) {
    done.push('フォームを開きました（' + formatDateJa_(openTarget.date) + ' のグルコン向け）');
  }
  ensureFormStateForToday_();

  // ② 今日が前日でなければここまで
  const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
  if (!event) {
    done.push('今日は前日ではないため、締切・まとめの処理はありません。');
    logInfo_(done.join('\n'));
    return done.join('\n');
  }

  const now = new Date();
  const closeAt = new Date(now.getTime());
  closeAt.setHours(CONFIG.CLOSE_HOUR, CONFIG.CLOSE_MINUTE, 0, 0);
  const notifyAt = new Date(now.getTime());
  notifyAt.setHours(CONFIG.NOTIFY_HOUR, CONFIG.NOTIFY_MINUTE, 0, 0);

  // ③ 締切時刻を過ぎていれば今すぐ閉じる。まだなら単発トリガーを仕込む。
  if (now >= closeAt) {
    if (setFormAcceptingIfAvailable_(false)) {
      done.push('締切時刻を過ぎていたため、フォームを閉じました。');
    }
    updateClosedMessage_(findEventAfter_(event.date));
  }

  // ④ 送信時刻を過ぎていて未送信なら今すぐ作って送る
  if (now >= notifyAt) {
    if (isDone_(event.date)) {
      done.push('質問まとめは送信済みです。');
    } else {
      const out = runDigest_(event, true);
      setDoneFlag_(event.date);
      done.push('質問まとめを作成してChatworkへ送信しました。\n' + out.docInfo.url);
    }
  }

  // ⑤ まだ時刻前のものは、通常どおり単発トリガーで予約する
  if (now < closeAt || now < notifyAt) {
    scheduleExactJobsForToday_();
    done.push('本日の残りの処理を予約しました。');
  }

  const out = done.join('\n');
  logInfo_(out);
  return out;
}

/** すべてのトリガーを削除する */
function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  logInfo_('既存のトリガーをすべて削除しました。');
}

/** 現在の設定状況をログに出す（設定確認用） */
function showStatus() {
  const lines = [];
  const profile = getProfile_();
  lines.push('── 設定状況 ──────────────────────────');
  lines.push('対象イベント          : ' + profile.label);
  lines.push('　日程シートの内容列  : 「' + profile.eventName + '」と完全一致する行');
  lines.push('　保存フォルダ名      : ' + profile.folderName);
  if (profile.folder && profile.folder.mode === 'year') {
    lines.push('保存先の年フォルダ    : 開催年から自動（例 2026' + (profile.folder.yearSuffix || '年度') + '）');
  } else {
    try {
      lines.push('期（基本設定B2）      : ' + getTermName_());
    } catch (e) {
      lines.push('期（基本設定B2）      : ⚠ ' + e.message);
    }
  }
  lines.push('日程スプレッドシート  : ' + (getMasterSpreadsheetId_() || '⚠ 未設定'));
  lines.push('保存先ルートフォルダ  : ' + ((profile.folder && profile.folder.rootFolderId) || '⚠ 未設定')
    + '（' + (profile.folder && profile.folder.mode === 'year' ? '年フォルダ方式' : '期フォルダ方式') + '）');
  try {
    const form = getFormOrNull_();
    if (form) {
      lines.push('フォーム              : ' + form.getTitle());
      lines.push('　回答用URL          : ' + form.getPublishedUrl());
    } else {
      lines.push('フォーム              : ⚠ 見つかりません（この回答シートに紐づいていません）');
    }
  } catch (e) {
    lines.push('フォーム              : ⚠ ' + e.message);
  }
  lines.push('回答スプレッドシート  : ' + (getResponseSpreadsheetId_() || '（開いているシート）'));
  lines.push('回答の区切り          : ' + profile.sections.map(function (x) {
    return x.label + '（' + String.fromCharCode(64 + x.column) + '列）';
  }).join(' ／ '));

  const props = PropertiesService.getScriptProperties();
  lines.push('CHATWORK_TOKEN        : ' + (props.getProperty('CHATWORK_TOKEN') ? '設定済み' : '⚠ 未設定'));
  lines.push('CHATWORK_ROOM_ID      : ' + (props.getProperty('CHATWORK_ROOM_ID') || '⚠ 未設定'));
  lines.push('DRY_RUN               : ' + CONFIG.DRY_RUN);

  try {
    const accepting = isFormAccepting_();
    lines.push('フォームの状態        : ' + (accepting === null ? '―' : (accepting ? '受付中' : '締切中')));
  } catch (e) {
    lines.push('フォームの状態        : ⚠ ' + e.message);
  }

  try {
    const rootId = profile.folder && profile.folder.rootFolderId;
    if (rootId) {
      const names = [];
      const it = DriveApp.getFolderById(rootId).getFolders();
      while (it.hasNext() && names.length < 30) names.push(it.next().getName());
      lines.push('ルート直下のフォルダ  : ' + (names.length ? names.join(' / ') : '(なし)'));
    }
  } catch (e) {
    lines.push('ルート直下のフォルダ  : ⚠ ' + e.message);
  }

  try {
    const events = listTargetEvents_();
    lines.push(profile.label + '件数' + '          : ' + events.length + '件');
    const next = findNextEvent_();
    lines.push('次回' + profile.label + '          : ' + (next
      ? formatDateJa_(next.date) + ' ' + next.startTime + '〜' + next.endTime
      : '（今日以降の予定なし）'));
    if (next) {
      const w = getCollectionWindow_(next.date);
      lines.push('　受付期間            : ' + formatDate_(w.start, 'M/d HH:mm')
        + ' 〜 ' + formatDate_(w.end, 'M/d HH:mm'));
      lines.push('　ドキュメント名      : ' + buildDocTitle_(next.date));
    }
  } catch (e) {
    lines.push(profile.label + '一覧          : ⚠ ' + e.message);
  }

  const triggers = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });
  lines.push('設置済みトリガー      : ' + (triggers.length ? triggers.join(' / ') : '(なし)'));
  lines.push('────────────────────────────────────');

  const out = lines.join('\n');
  console.log(out);
  return out;
}

// ─────────────────────────────────────────────────────────
//  定期処理
// ─────────────────────────────────────────────────────────

/** 毎日 6:00 に実行される司令塔 */
function dailyPlanner() {
  try {
    // ① フォームのオープン（5日前）
    const openTarget = findEventByDaysAhead_(CONFIG.OPEN_DAYS_BEFORE);
    if (openTarget) {
      if (setFormAcceptingIfAvailable_(true)) {
        logInfo_('【オープン】' + formatDateJa_(openTarget.date) + ' のグルコンに向けてフォームを開きました。');
      }
    }

    // ② 受付期間中なのに閉じていたら開け直す（取りこぼし防止）
    ensureFormStateForToday_();

    // ③ 今日が前日なら、13:00 と 13:30 の単発トリガーを仕込む
    const closeTarget = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (closeTarget) {
      scheduleExactJobsForToday_();
      clearDoneFlag_(closeTarget.date);
    }
  } catch (err) {
    console.error(err);
    notifyError_('dailyPlanner', err);
  }
}

/** 今日の 13:00 / 13:30 に単発トリガーを仕込む */
function scheduleExactJobsForToday_() {
  removeOneShotTriggers_();

  const now = new Date();
  const closeAt = new Date(now.getTime());
  closeAt.setHours(CONFIG.CLOSE_HOUR, CONFIG.CLOSE_MINUTE, 0, 0);
  const notifyAt = new Date(now.getTime());
  notifyAt.setHours(CONFIG.NOTIFY_HOUR, CONFIG.NOTIFY_MINUTE, 0, 0);

  if (closeAt > now) {
    ScriptApp.newTrigger('closeFormNow').timeBased().at(closeAt).create();
    logInfo_('単発トリガーを設置：closeFormNow @ ' + formatDate_(closeAt, 'M/d HH:mm'));
  }
  if (notifyAt > now) {
    ScriptApp.newTrigger('buildAndNotifyNow').timeBased().at(notifyAt).create();
    logInfo_('単発トリガーを設置：buildAndNotifyNow @ ' + formatDate_(notifyAt, 'M/d HH:mm'));
  }
}

function removeOneShotTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'closeFormNow' || fn === 'buildAndNotifyNow') ScriptApp.deleteTrigger(t);
  });
}

/** 13:00 ちょうどに走る：フォームを閉じる */
function closeFormNow() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) {
      logInfo_('今日は前日ではないため、締切処理をスキップしました。');
      return;
    }
    setFormAcceptingIfAvailable_(false);
    updateClosedMessage_(findEventAfter_(event.date));
  } catch (err) {
    console.error(err);
    notifyError_('closeFormNow（フォーム締切）', err);
  }
}

/** 13:30 ちょうどに走る：ドキュメント作成 → Chatwork送信 */
function buildAndNotifyNow() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) {
      logInfo_('今日は前日ではないため、質問まとめをスキップしました。');
      return;
    }
    runDigest_(event, true);
    setDoneFlag_(event.date);
  } catch (err) {
    console.error(err);
    notifyError_('buildAndNotifyNow（質問まとめ作成・送信）', err);
  }
}

/** 毎日 15:00：13:00/13:30 の処理が落ちていた場合の救済 */
function dailySafetyNet() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) return;

    if (isFormAccepting_() === true) {
      logInfo_('【救済】フォームが開いたままだったため締切処理を実行します。');
      setFormAcceptingIfAvailable_(false);
      updateClosedMessage_(findEventAfter_(event.date));
    }
    if (!isDone_(event.date)) {
      logInfo_('【救済】質問まとめが未送信のため実行します。');
      runDigest_(event, true);
      setDoneFlag_(event.date);
    }
  } catch (err) {
    console.error(err);
    notifyError_('dailySafetyNet', err);
  }
}

/** 受付期間中ならフォームが開いていることを保証する */
function ensureFormStateForToday_() {
  const next = findNextEvent_();
  if (!next) return;
  const w = getCollectionWindow_(next.date);
  const now = new Date();
  if (now >= w.start && now < w.end && isFormAccepting_() === false) {
    setFormAcceptingIfAvailable_(true);
    logInfo_('受付期間中にフォームが閉じていたため開き直しました。');
  }
}

// ─────────────────────────────────────────────────────────
//  本処理
// ─────────────────────────────────────────────────────────

/**
 * 質問まとめの本体
 * @param {Object} event  対象グルコン
 * @param {boolean} notify Chatworkに送信するか
 */
function runDigest_(event, notify) {
  const w = getCollectionWindow_(event.date);
  logInfo_('対象グルコン：' + formatDateJa_(event.date)
    + ' ／ 収録期間：' + formatDate_(w.start, 'M/d HH:mm') + ' 〜 ' + formatDate_(w.end, 'M/d HH:mm'));

  const responses = readResponsesInWindow_(w.start, w.end);
  const built = buildSections_(responses);
  const docInfo = buildDigestDocument_(event, built);

  logInfo_('ドキュメント：' + docInfo.title + ' → ' + docInfo.url);
  logInfo_('回答 ' + built.stats.responseCount + '件');
  built.stats.sections.forEach(function (sec) {
    logInfo_('　' + sec.label + '：' + sec.personCount + '名 ／ 掲載 ' + sec.questionCount + '件'
      + (sec.duplicateCount ? '（重複 ' + sec.duplicateCount + '件を除外）' : ''));
  });
  built.notes.forEach(function (n) { logInfo_('・' + n); });

  if (notify) {
    sendChatwork_(buildNotificationMessage_(event, built, docInfo));
  }
  return { result: built, docInfo: docInfo };
}

/** 指定日より後の最初のグルコンを返す */
function findEventAfter_(date) {
  const base = startOfDay_(date).getTime();
  const events = listTargetEvents_();
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() > base) return events[i];
  }
  return null;
}

// ── 二重送信ガード ────────────────────────────────────────

function doneKey_(eventDate) { return 'DIGEST_DONE_' + formatDate_(eventDate, 'yyyyMMdd'); }
function isDone_(eventDate) {
  return PropertiesService.getScriptProperties().getProperty(doneKey_(eventDate)) === '1';
}
function setDoneFlag_(eventDate) {
  PropertiesService.getScriptProperties().setProperty(doneKey_(eventDate), '1');
}
function clearDoneFlag_(eventDate) {
  PropertiesService.getScriptProperties().deleteProperty(doneKey_(eventDate));
}

// ─────────────────────────────────────────────────────────
//  手動実行用（エディタの「実行」から呼べます）
// ─────────────────────────────────────────────────────────

/** 次回グルコンの質問まとめを今すぐ作る（Chatworkには送らない：動作確認用） */
function manualBuildPreview() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のグルコンが日程シートに見つかりません。');
  const out = runDigest_(event, false);
  logInfo_('▼プレビュー用に作成しました（Chatwork未送信）\n' + out.docInfo.url);
  logInfo_('▼送信されるはずのメッセージ:\n' + buildNotificationMessage_(event, out.result, out.docInfo));
  return out.docInfo.url;
}

/** 次回グルコンの質問まとめを作り、Chatworkにも送る */
function manualBuildAndNotify() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のグルコンが日程シートに見つかりません。');
  const out = runDigest_(event, true);
  setDoneFlag_(event.date);
  return out.docInfo.url;
}

/** 手動でフォームを開く */
function manualOpenForm() { openForm_(); showStatus(); }

/** 手動でフォームを閉じる */
function manualCloseForm() { closeForm_(); showStatus(); }


// ══════════════════════════════════════════════════════════════
// Menu.gs
// ══════════════════════════════════════════════════════════════

/**
 * スプレッドシート上のメニュー
 *
 * このスクリプトをフォームの回答スプレッドシートに貼り付けている場合、
 * シートを開くと上部に「グルコン質問まとめ」メニューが出ます。
 * スクリプトエディタを開かずに実行できます。
 *
 * ※メニューが出ないときは、一度シートを再読み込みしてください。
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu(getProfile_().label + '質問まとめ')
      .addItem('① 設定状況を確認', 'menuShowStatus')
      .addItem('② テスト：この回答シート全部でドキュメント作成', 'menuTestAllRows')
      .addSeparator()
      .addItem('質問まとめを作成（Chatwork送信なし）', 'menuBuildPreview')
      .addItem('質問まとめを作成してChatworkへ送信', 'menuBuildAndNotify')
      .addSeparator()
      .addItem('フォームを開く', 'menuOpenForm')
      .addItem('フォームを閉じる', 'menuCloseForm')
      .addItem('フォームの診断', 'menuDiagnoseForm')
      .addItem('フォームを登録（URLを貼る）', 'menuSetFormId')
      .addSeparator()
      .addItem('Chatworkへの接続テスト', 'menuTestChatwork')
      .addItem('自動実行トリガーを設置', 'menuInstallTriggers')
      .addItem('本日分の処理に追いつかせる', 'menuCatchUpToday')
      .addToUi();
  } catch (e) {
    console.warn('メニューを作れませんでした（スプレッドシートに紐づいていない可能性）: ' + e);
  }
}

// ── メニューから呼ばれる関数 ──────────────────────────────

function menuShowStatus() {
  runFromMenu_('設定状況', function () { return showStatus(); });
}

function menuTestAllRows() {
  runFromMenu_('テスト作成', function () { return testBuildFromAllRows(); });
}

function menuBuildPreview() {
  runFromMenu_('質問まとめ（送信なし）', function () {
    const event = findNextEvent_();
    if (!event) throw new Error('今日以降のグルコンが日程シートに見つかりません。\n「スケジュール」シートの日程をご確認ください。');
    const out = runDigest_(event, false);
    return 'ドキュメントを作成しました。\n\n' + out.docInfo.url
      + '\n\n保存先: ' + out.docInfo.path
      + (out.docInfo.sharing ? '\n共有  : ' + out.docInfo.sharing.label : '')
      + '\n\n── Chatworkに送られる文面 ──\n'
      + buildNotificationMessage_(event, out.result, out.docInfo);
  });
}

function menuBuildAndNotify() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('確認',
    'ドキュメントを作成し、Chatworkへ実際に送信します。よろしいですか？',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runFromMenu_('質問まとめ＋送信', function () {
    return 'Chatworkへ送信しました。\n\n' + manualBuildAndNotify();
  });
}

function menuOpenForm() {
  runFromMenu_('フォームを開く', function () {
    const r = setFormAccepting_(true);
    return r === 'changed'
      ? 'フォームを受付中にしました。\n\n' + getFormPublishedUrl_()
      : 'フォームはすでに受付中です。\n\n' + getFormPublishedUrl_();
  });
}

function menuCloseForm() {
  runFromMenu_('フォームを閉じる', function () {
    const r = setFormAccepting_(false);
    return r === 'changed' ? 'フォームを締切にしました。' : 'フォームはすでに締切です。';
  });
}

/**
 * フォームのURLを貼って登録する。
 * 回答シートとフォームが紐づいていない場合の手動登録用。
 */
function menuSetFormId() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'フォームを登録',
    'Googleフォームの【編集用URL】を貼り付けてください。\n\n'
    + '例：https://docs.google.com/forms/d/xxxxxxxx/edit\n\n'
    + '※フォームを開いた状態のアドレスバーのURLです。\n'
    + '　「/forms/d/e/」で始まる回答用URLでは登録できません。',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const input = String(res.getResponseText() || '').trim();
  if (!input) return;

  runFromMenu_('フォームを登録', function () {
    if (input.indexOf('/forms/d/e/') >= 0) {
      throw new Error(
        'これは【回答用URL】です。編集用URLを貼ってください。\n\n'
        + 'フォームを編集画面で開き、アドレスバーの\n'
        + 'https://docs.google.com/forms/d/●●●●/edit\n'
        + 'をコピーしてください。'
      );
    }
    const form = FormApp.openById(extractId_(input));
    PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());
    return '登録しました。\n\n'
      + 'フォーム名 : ' + form.getTitle() + '\n'
      + 'フォームID : ' + form.getId() + '\n'
      + '現在の状態 : ' + (form.isAcceptingResponses() ? '受付中' : '締切中') + '\n'
      + '回答用URL  : ' + form.getPublishedUrl();
  });
}

function menuDiagnoseForm() {
  runFromMenu_('フォームの診断', function () { return diagnoseForm(); });
}

function menuTestChatwork() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('確認',
    'Chatworkにテスト投稿を1件送ります。よろしいですか？',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runFromMenu_('Chatwork接続テスト', function () {
    testChatworkConnection();
    return 'Chatworkに投稿しました。ルームを確認してください。';
  });
}

function menuCatchUpToday() {
  runFromMenu_('本日分の処理', function () { return catchUpToday(); });
}

function menuInstallTriggers() {
  runFromMenu_('トリガー設置', function () {
    setupInstallTriggers();
    return '自動実行トリガーを設置しました。\n\n'
      + '・毎日 ' + CONFIG.PLANNER_HOUR + ':00 … フォームのオープン判定\n'
      + '・前日 ' + CONFIG.CLOSE_HOUR + ':00 … フォームの締切\n'
      + '・前日 ' + CONFIG.NOTIFY_HOUR + ':' + CONFIG.NOTIFY_MINUTE + ' … ドキュメント作成＆Chatwork送信\n'
      + '・毎日 ' + CONFIG.SAFETY_NET_HOUR + ':00 … 取りこぼしの救済\n\n'
      + '※本日分の処理にも、その場で追いつかせました。';
  });
}

/** メニュー実行の共通処理（結果とエラーをダイアログで見せる） */
function runFromMenu_(label, fn) {
  const ui = SpreadsheetApp.getUi();
  try {
    const message = fn();
    ui.alert(label, String(message || '完了しました。'), ui.ButtonSet.OK);
  } catch (err) {
    console.error(err);
    ui.alert('エラー：' + label,
      (err && err.message ? err.message : String(err))
      + '\n\n詳しくは 拡張機能 → Apps Script → 実行ログ をご確認ください。',
      ui.ButtonSet.OK);
  }
}


// ══════════════════════════════════════════════════════════════
// SetupForm.gs
// ══════════════════════════════════════════════════════════════

/**
 * Googleフォームの新規作成（初回セットアップ用）
 *
 * formzu（フォームズ）から移行するときに1回だけ実行します。
 * 既にフォームを手作りしてある場合は実行不要です。
 * その場合は setFormIds() でIDを登録してください。
 */

// フォーム名と質問文はプロファイル（PROFILES）から取ります。

/**
 * ★フォームと回答スプレッドシートを作り、スクリプトプロパティに登録します。
 * 実行後、ログに出るURLを「基本設定」の
 * 「グルコン事前フォームURL」に貼り替えてください。
 */
function setupCreateForm() {
  const profile = getProfile_();
  const form = FormApp.create(profile.formTitle);
  form.setDescription(
    profile.label + '当日に相談したいこと・質問したいことをご記入ください。\n'
    + '※添削をご希望の場合は、対象物のURLを必ず貼り付け、'
    + '「リンクを知っている全員が閲覧可」に設定してください。'
  );

  // ── メールアドレス収集：Googleログイン不要の「回答者からの入力」 ──
  var emailOk = false;
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.RESPONDER_INPUT);
    emailOk = true;
  } catch (e) {
    console.warn('setEmailCollectionType が使えませんでした: ' + e);
  }
  if (!emailOk) {
    console.warn(
      '⚠ メールアドレスの収集を手動で設定してください。\n'
      + '　 フォームの「設定」→「回答」→「メールアドレスを収集する」を\n'
      + '　 必ず【回答者からの入力】にしてください。\n'
      + '　 【確認済み】にするとGoogleアカウントが必須になり、回答できない方が出ます。'
    );
  }

  // ── 設問 ──
  form.addTextItem()
    .setTitle('お名前')
    .setHelpText('フルネームでご記入ください')
    .setRequired(true);

  // 区切り（活動報告／質問 など）の数だけ設問を作ります
  profile.sections.forEach(function (sec, i) {
    form.addParagraphTextItem()
      .setTitle(i === 0 && profile.sections.length === 1
        ? profile.questionItemTitle
        : sec.label)
      .setRequired(false);
  });

  // ── 回答設定 ──
  form.setAllowResponseEdits(false);      // 締切後に内容が変わらないように
  form.setLimitOneResponsePerUser(false); // 何度でも質問を送れるように
  form.setProgressBar(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('ご質問ありがとうございました。グルコンでお答えいたします。');
  form.setAcceptingResponses(false);      // 最初は閉じた状態。5日前に自動で開きます。

  // ── 回答スプレッドシートを作成して紐付け ──
  const ss = SpreadsheetApp.create(profile.formTitle + '（回答）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ── フォルダへ移動（講座ルート直下） ──
  try {
    const root = DriveApp.getFolderById(profile.folder.rootFolderId);
    DriveApp.getFileById(form.getId()).moveTo(root);
    DriveApp.getFileById(ss.getId()).moveTo(root);
  } catch (e) {
    console.warn('フォルダへの移動に失敗しました（マイドライブ直下に作成されています）: ' + e);
  }

  // ── IDを保存 ──
  PropertiesService.getScriptProperties().setProperties({
    FORM_ID: form.getId(),
    RESPONSE_SPREADSHEET_ID: ss.getId(),
  }, false);

  const info = [
    '── フォームを作成しました ─────────────────',
    '回答用URL（案内メールに載せるURL）:',
    '  ' + form.getPublishedUrl(),
    '',
    '編集用URL:',
    '  ' + form.getEditUrl(),
    '',
    '回答スプレッドシート:',
    '  ' + ss.getUrl(),
    '',
    'FORM_ID / RESPONSE_SPREADSHEET_ID はスクリプトプロパティに保存済みです。',
    '',
    '【手動で設定が必要な項目】',
    '  ・設定 → 回答 → メールアドレスを収集する ＝【回答者からの入力】'
      + (emailOk ? '（設定済み）' : '（★未設定：必ず設定してください）'),
    '  ・設定 → 回答 → 回答のコピーを回答者に送信 ＝ 常に表示',
    '    （フォームズの自動返信メールの代わりです。APIから設定できないため手動でお願いします）',
    '',
    '【次にやること】',
    '  ・「基本設定」の「グルコン事前フォームURL」を上の回答用URLに貼り替える',
    '  ・回答スプレッドシートの列が A:タイムスタンプ / B:メールアドレス /'
      + ' C:お名前 / D:ご質問 の順になっているか確認する',
    '────────────────────────────────────',
  ].join('\n');

  console.log(info);
  return info;
}

/**
 * 既に作ってあるフォームを使う場合：IDをここに貼って実行します。
 * URLではなくIDです（.../d/【ここ】/edit の部分）。
 */
function setFormIds() {
  const formId = '';                  // ← フォームのID
  const responseSpreadsheetId = '';   // ← 回答スプレッドシートのID

  if (!formId || !responseSpreadsheetId) {
    throw new Error('setFormIds() の中の formId / responseSpreadsheetId を埋めてから実行してください。');
  }
  PropertiesService.getScriptProperties().setProperties({
    FORM_ID: formId,
    RESPONSE_SPREADSHEET_ID: responseSpreadsheetId,
  }, false);
  showStatus();
}

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


// ══════════════════════════════════════════════════════════════
// Test.gs
// ══════════════════════════════════════════════════════════════

/**
 * テスト用の関数
 *
 * 先方に提案する前に、これらを実行して動作を確認できます。
 * どれも Chatwork には送信しません（ログに出るだけ）。
 */

/**
 * ★いちばん最初に試す関数。
 *
 * フォームも回答データも無い状態で、サンプルの回答から
 * 実際のフォルダに「(サンプル)」付きのドキュメントを作ります。
 *
 * これで確認できること：
 *   ・保存先フォルダを正しく作れるか
 *   ・お名前の書式（大きさ・太字・黄色背景）が好みか
 *   ・同じ内容の統合、「追記：」のまとめ方が意図通りか
 *   ・Chatworkに送られる文面が意図通りか
 */
function demoBuildSampleDocument() {
  const profile = getProfile_();
  const next = findNextEvent_();
  const sampleDate = next ? next.date : addDays_(new Date(), 3);
  const event = next || {
    date: sampleDate,
    dateShort: formatDateJa_(sampleDate),
    startTime: '10:00',
    endTime: '11:00',
    owner: '',
  };

  const base = addDays_(sampleDate, -3);
  function at(dayOffset, h, m) {
    const d = addDays_(base, dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const keys = profile.sections.map(function (x) { return x.key; });
  function answer(first, second) {
    const a = {};
    keys.forEach(function (k, i) { a[k] = i === 0 ? first : (second || ''); });
    return a;
  }

  // ── サンプル回答 ──────────────────────────────────────
  const responses = [
    { timestamp: at(0, 9, 12), email: 'yamada@example.com', name: '山田絵里香', row: 2,
      answers: answer(
        'プレゼントと肩書きが決まり、ライン公式への導線までは完了しました。\n'
        + 'ここからは、インスタグラムの発信に力を入れていきたいと思います。',
        '質問①\nホームページの添削をしていただきたいです。\n'
        + 'https://pianonomori-musica.jimdofree.com/') },

    // ↑と同一人物・別内容 → 「追記：」としてまとめられる
    { timestamp: at(1, 21, 4), email: 'YAMADA@example.com ', name: '山田絵里香', row: 3,
      answers: answer('体験レッスンのお申し込みが2件ありました。', '') },

    { timestamp: at(1, 10, 30), email: 'kawamoto@example.com', name: '川元　弓子', row: 4,
      answers: answer('継続講座の1回目が無事に終わりました。', '今さらの疑問です。\n教えてください。') },

    // ↑とまったく同じ内容を誤送信 → 1件に統合される
    { timestamp: at(1, 10, 31), email: 'kawamoto@example.com', name: '川元 弓子', row: 5,
      answers: answer('継続講座の1回目が無事に終わりました。', '今さらの疑問です。\r\n教えてください。  ') },

    // 1つ目の区切りだけ回答した人（質問なし）
    { timestamp: at(2, 8, 0), email: 'suzuki@example.com', name: '鈴木美咲', row: 6,
      answers: answer('インスタのフォロワーが1200名を超えました。', '') },
  ];

  const built = buildSections_(responses);
  const docInfo = buildDigestDocument_(event, built, '(サンプル)' + buildDocTitle_(sampleDate));

  const lines = [];
  lines.push('── サンプル作成結果 ───────────────────');
  lines.push('対象イベント : ' + profile.label);
  lines.push('ドキュメント : ' + docInfo.url);
  lines.push('ファイル名   : ' + docInfo.title);
  lines.push('保存先       : ' + docInfo.path);
  if (docInfo.sharing) lines.push('共有         : ' + docInfo.sharing.label);
  if (docInfo.createdFolders.length) {
    lines.push('※フォルダを新規作成しました: ' + docInfo.createdFolders.join(' / '));
  }
  lines.push('');
  lines.push('── Chatworkに送られる文面（今回は送信していません） ──');
  lines.push(buildNotificationMessage_(event, built, docInfo));
  lines.push('────────────────────────────────────');
  lines.push('');
  lines.push('※確認できたら、作られた「(サンプル)…」のドキュメントは削除して構いません。');

  const out = lines.join('\n');
  console.log(out);
  return out;
}

/**
 * 日付を指定して質問まとめを作る（Chatworkには送りません）。
 * 過去のグルコンでテストしたいときに使います。
 *
 * 例: manualBuildPreviewForDate('2026/8/20')
 */
function manualBuildPreviewForDate(dateStr) {
  const date = toDate_(dateStr);
  if (!date) throw new Error('日付を "2026/8/20" のような形式で渡してください。');

  const events = listTargetEvents_();
  var event = null;
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() === startOfDay_(date).getTime()) {
      event = events[i];
      break;
    }
  }
  if (!event) {
    logInfo_('日程シートに ' + formatDate_(date, 'yyyy/M/d') + ' のグルコンが無いため、日付だけで処理します。');
    event = { date: date, dateShort: formatDateJa_(date), startTime: '', endTime: '', owner: '' };
  }

  const out = runDigest_(event, false);
  logInfo_('▼作成しました（Chatwork未送信）\n' + out.docInfo.url);
  logInfo_('▼送信されるはずの文面:\n' + buildNotificationMessage_(event, out.result, out.docInfo));
  return out.docInfo.url;
}

/**
 * Chatworkへの送信だけをテストします（ドキュメントは作りません）。
 * トークンとルームIDが正しいかの確認用です。
 */
function testChatworkConnection() {
  const msg = '[info][title]接続テスト[/title]'
    + 'グルコン質問まとめの自動化テストです。この投稿が見えていれば設定は正常です。[/info]';
  const res = sendChatwork_(msg);
  logInfo_('送信結果: ' + JSON.stringify(res));
  return res;
}

/**
 * ★テストデータでドキュメントを作る（日付の絞り込みを無視します）
 *
 * 本番は「5日前00:00〜前日13:00」で絞りますが、テスト中は日程と
 * タイムスタンプが噛み合わず全部除外されてしまうため、
 * この関数は【シートの全行】を対象にします。
 *
 * 使い方：
 *   ① このスクリプトを回答シートに貼っている場合
 *        testBuildFromAllRows()
 *   ② 別のシートを指定したい場合（URLでもIDでもOK）
 *        testBuildFromAllRows('https://docs.google.com/spreadsheets/d/xxxx/edit')
 *
 * Chatworkには送信しません。ログに文面が出るだけです。
 */
function testBuildFromAllRows(spreadsheetUrlOrId) {
  const profile = getProfile_();
  const ss = spreadsheetUrlOrId
    ? SpreadsheetApp.openById(extractId_(spreadsheetUrlOrId))
    : (SpreadsheetApp.getActiveSpreadsheet()
       || SpreadsheetApp.openById(getResponseSpreadsheetId_()));
  const sheet = CONFIG.RESPONSE_SHEET_NAME
    ? ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME)
    : ss.getSheets()[0];
  if (!sheet) throw new Error('シートが見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('「' + ss.getName() + '」の「' + sheet.getName() + '」にデータがありません。');

  const C = CONFIG.RESPONSE_COLUMNS;
  var maxCol = Math.max(C.timestamp, C.email, C.name);
  profile.sections.forEach(function (x) { maxCol = Math.max(maxCol, x.column); });
  if (sheet.getLastColumn() < maxCol) {
    throw new Error('列が足りません（' + maxCol + '列必要）。'
      + 'A:タイムスタンプ / B:メールアドレス / C:お名前 / D以降:回答 を想定しています。');
  }

  const header = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  const responses = [];
  const skipped = [];
  values.forEach(function (row, i) {
    const answers = {};
    var hasAny = false;
    profile.sections.forEach(function (sec) {
      const text = String(row[sec.column - 1] || '').trim();
      answers[sec.key] = text;
      if (text) hasAny = true;
    });
    if (!hasAny) {
      if (String(row[C.name - 1] || '').trim() || String(row[C.email - 1] || '').trim()) {
        skipped.push((i + 2) + '行目（回答が空欄）');
      }
      return;
    }
    responses.push({
      timestamp: toDate_(row[C.timestamp - 1]) || new Date(2000, 0, 1 + i),
      email: String(row[C.email - 1] || '').trim(),
      name: String(row[C.name - 1] || '').trim(),
      answers: answers,
      row: i + 2,
    });
  });
  responses.sort(function (a, b) { return a.timestamp - b.timestamp; });

  if (responses.length === 0) {
    throw new Error('回答が入力された行が1件もありませんでした。');
  }

  const next = findNextEvent_();
  const eventDate = next ? next.date : addDays_(new Date(), 3);
  const event = next || {
    date: eventDate, dateShort: formatDateJa_(eventDate),
    startTime: '', endTime: '', owner: '',
  };

  const built = buildSections_(responses);
  const docInfo = buildDigestDocument_(event, built, '(テスト)' + buildDocTitle_(eventDate));

  const lines = [];
  lines.push('── 読み込んだスプレッドシート ───────────────');
  lines.push('対象イベント : ' + profile.label);
  lines.push('ファイル     : ' + ss.getName());
  lines.push('シート       : ' + sheet.getName());
  lines.push('列の対応     : A「' + header[C.timestamp - 1] + '」 / B「' + header[C.email - 1]
    + '」 / C「' + header[C.name - 1] + '」');
  profile.sections.forEach(function (sec) {
    lines.push('　　' + String.fromCharCode(64 + sec.column) + '「'
      + String(header[sec.column - 1] || '').replace(/[\r\n]+/g, ' ') + '」 → ' + sec.label);
  });
  lines.push('　★上の列名が想定どおりか確認してください');
  lines.push('読み込み     : ' + responses.length + '行');
  if (skipped.length) lines.push('スキップ     : ' + skipped.join('、'));
  lines.push('');
  lines.push('── 集約結果 ─────────────────────────────');
  built.sections.forEach(function (sec) {
    lines.push('【' + sec.label + '】');
    if (sec.result.groups.length === 0) {
      lines.push('　（該当なし）');
    }
    sec.result.groups.forEach(function (g) {
      lines.push('■ ' + g.displayName + '（' + g.entries.length + '件'
        + (g.duplicateCount ? ' / 重複 ' + g.duplicateCount + '件を除外' : '') + '）');
      g.entries.forEach(function (e, i) {
        lines.push('   ' + (i > 0 ? '追記：' : '　　　') + summarize_(e.question, 50));
      });
    });
    lines.push('');
  });
  lines.push('── 作成したドキュメント ─────────────────');
  lines.push(docInfo.url);
  lines.push('ファイル名 : ' + docInfo.title);
  lines.push('保存先     : ' + docInfo.path);
  if (docInfo.sharing) lines.push('共有       : ' + docInfo.sharing.label);
  if (docInfo.createdFolders.length) {
    lines.push('※フォルダを新規作成しました: ' + docInfo.createdFolders.join(' / '));
  }
  lines.push('');
  lines.push('── Chatworkに送られる文面（送信はしていません） ──');
  lines.push(buildNotificationMessage_(event, built, docInfo));
  lines.push('────────────────────────────────────');
  lines.push('');
  lines.push('※この関数は日付の絞り込みを無視しています。');
  lines.push('　本番は「5日前00:00〜前日13:00」の回答だけが対象になります。');

  const out = lines.join('\n');
  console.log(out);
  return out;
}

/** スプレッドシート/フォームのURLからIDを取り出す（IDをそのまま渡してもOK） */
function extractId_(urlOrId) {
  const s = String(urlOrId || '').trim();
  if (!s) throw new Error('URLまたはIDを渡してください。');
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  throw new Error('URLからIDを取り出せませんでした：' + s);
}

/**
 * ★「フォームを開く」が失敗するときの原因診断
 *
 * どこで止まっているかを1段ずつ確認してログに出します。
 * メニュー →「フォームの診断」から実行できます。
 */
function diagnoseForm() {
  const lines = [];
  lines.push('── フォーム診断 ────────────────────────');

  // ① このスクリプトを動かしているアカウント
  var runningAs = '(取得できません)';
  try { runningAs = Session.getEffectiveUser().getEmail() || '(空)'; } catch (e) { runningAs = '⚠ ' + e; }
  lines.push('① 実行アカウント   : ' + runningAs);
  lines.push('   ※フォームの編集権限がこのアカウントに無いと開閉できません');

  // ② 回答スプレッドシート
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    lines.push('② 回答シート       : ' + (ss ? ss.getName() + '（' + ss.getId() + '）' : '⚠ 取得できません'));
  } catch (e) {
    lines.push('② 回答シート       : ⚠ ' + e);
  }

  // ③ プロファイル判別
  try {
    const p = getProfile_();
    lines.push('③ 対象イベント     : ' + p.label);
    if (ss && p.responseSpreadsheetId !== ss.getId()) {
      lines.push('   ⚠ このシートのIDがPROFILESの登録と違います。');
      lines.push('     PROFILES の responseSpreadsheetId を ' + ss.getId() + ' に直してください。');
    }
  } catch (e) {
    lines.push('③ 対象イベント     : ⚠ ' + e);
  }

  // ④ フォームが紐づいているか
  var formUrl = null;
  try {
    formUrl = ss ? ss.getFormUrl() : null;
    if (formUrl) {
      lines.push('④ 紐づくフォーム   : あり');
      lines.push('   編集用URL       : ' + formUrl);
    } else {
      lines.push('④ 紐づくフォーム   : ⚠ なし');
      lines.push('   → このスプレッドシートはフォームの回答先になっていません。');
      lines.push('     Googleフォームの「回答」タブ →「スプレッドシートにリンク」で');
      lines.push('     このシートに紐づけてください。');
    }
  } catch (e) {
    lines.push('④ 紐づくフォーム   : ⚠ ' + e);
  }

  // ⑤ 設定済みのFORM_ID
  const savedId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  lines.push('⑤ 保存済みFORM_ID  : ' + (savedId || '(なし)'));
  try {
    lines.push('   プロファイルのID : ' + (getProfile_().formId || '(なし)'));
  } catch (e) { /* noop */ }

  // ⑤-2 実際に使われるフォーム
  try {
    const resolved = getFormOrNull_();
    lines.push('   実際に使うフォーム: ' + (resolved ? resolved.getTitle() : '⚠ 見つかりません'));
  } catch (e) {
    lines.push('   実際に使うフォーム: ⚠ ' + e);
  }

  // ⑥ フォームを開けるか
  var form = null;
  var openError = '';
  try {
    form = getFormOrNull_();
  } catch (e) {
    openError = (e && e.message) ? e.message : String(e);
  }
  if (!form && formUrl && !openError) {
    try {
      form = FormApp.openByUrl(formUrl);
    } catch (e) {
      openError = (e && e.message) ? e.message : String(e);
    }
  }
  if (form) {
    lines.push('⑥ フォームを開く   : ✅ 成功 —「' + form.getTitle() + '」');
  } else {
    lines.push('⑥ フォームを開く   : ⚠ 失敗' + (openError ? ' — ' + openError : ''));
    if (/permission|権限|アクセス|not have access/i.test(openError)) {
      lines.push('   → 実行アカウント（' + runningAs + '）にフォームの編集権限がありません。');
      lines.push('     フォームの所有者に、このアドレスを「編集者」として追加してもらってください。');
    } else if (!formUrl) {
      lines.push('   → フォームIDが未登録で、シートにも紐づいていません。');
      lines.push('     メニュー →「フォームを登録（URLを貼る）」から登録してください。');
    }
  }

  // ⑦ 受付状態の読み取り／書き込み可否
  if (form) {
    try {
      lines.push('⑦ 受付状態         : ' + (form.isAcceptingResponses() ? '受付中' : '締切中'));
    } catch (e) {
      lines.push('⑦ 受付状態         : ⚠ ' + e);
    }
    try {
      // 現在の状態を同じ値で書き直して、書き込み権限があるか確認する
      form.setAcceptingResponses(form.isAcceptingResponses());
      lines.push('⑧ 開閉の書き込み   : ✅ 可能');
    } catch (e) {
      lines.push('⑧ 開閉の書き込み   : ⚠ 不可 — ' + ((e && e.message) ? e.message : e));
      lines.push('   → 閲覧権限しかない可能性があります。編集者権限が必要です。');
    }
  }

  lines.push('────────────────────────────────────');
  const out = lines.join('\n');
  console.log(out);
  return out;
}
