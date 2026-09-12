/**
 * ═══════════════════════════════════════════════════════════════
 *  グルコン事前質問まとめ 自動化（全部入り 1ファイル版）
 * ═══════════════════════════════════════════════════════════════
 *
 *  Googleフォームの「回答」スプレッドシートを開き、
 *  拡張機能 → Apps Script → コード.gs にこれを丸ごと貼り付けてください。
 *
 *  ── まず試すこと ────────────────────────────────────────
 *    1. 貼り付けて保存（Ctrl+S / ⌘S）
 *    2. スプレッドシートに戻って再読み込み
 *       → 上部に「グルコン質問まとめ」メニューが出ます
 *    3. メニュー →「① 設定状況を確認」
 *    4. メニュー →「② テスト：この回答シート全部でドキュメント作成」
 *
 *  詳しい手順は README.md を参照してください。
 * ═══════════════════════════════════════════════════════════════
 */


// ══════════════════════════════════════════════════════════════
// Config.gs
// ══════════════════════════════════════════════════════════════

/**
 * グルコン事前質問まとめ 自動化
 * ── 設定 ──
 *
 * 【ここを編集する】
 *   FORM_ID / RESPONSE_SPREADSHEET_ID は Googleフォーム作成後に埋めます。
 *   Chatwork のトークンとルームIDは、コードではなく
 *   「プロジェクトの設定 > スクリプト プロパティ」に保存してください。
 *
 * 必要なスクリプトプロパティ:
 *   CHATWORK_TOKEN    ... Chatwork APIトークン
 *   CHATWORK_ROOM_ID  ... 通知先ルームID（例: 444552021）
 *   FORM_ID           ... （任意）下のFORM_IDより優先されます
 *   RESPONSE_SPREADSHEET_ID ... （任意）同上
 *   MASTER_SPREADSHEET_ID   ... （任意）期が変わったらここを貼り替えるだけ
 */

const CONFIG = {

  // ── ファイル・フォルダID ────────────────────────────────
  /** 「Shine A Light_メール設定」スプレッドシート（期ごとのマスタ） */
  MASTER_SPREADSHEET_ID: '1ViN_aCddOoVa3nnqwWlUM5D5LhLEk6YwTSYPNTlNY_I',

  /** 「Shine A Light講座」フォルダ（この下に 21期 / グルコン と掘る） */
  COURSE_ROOT_FOLDER_ID: '1G8svKr3uijCmSs_76-kDxZp5iUs4tUqc',

  /** ★グルコン事前質問フォームのID（setupCreateForm() で自動設定されます） */
  FORM_ID: '',

  /**
   * ★フォームの回答スプレッドシートのID。
   * このスクリプトを回答スプレッドシートに貼り付けている場合は
   * 空のままでも「今開いているシート」が自動で使われます。
   */
  RESPONSE_SPREADSHEET_ID: '1GsKR1ZzsFo56CRDYtdCnYpDCvqahdH3TcKoMfG-3nHE',

  // ── マスタスプレッドシートのシート名 ───────────────────
  /** 日程シート（見つかった方を使います） */
  SCHEDULE_SHEET_NAMES: ['スケジュール', 'タスク管理'],
  /** 基本設定シート（B列に「期」が入っている） */
  SETTINGS_SHEET_NAME: '基本設定',

  /** 日程シートのヘッダー名（列の位置ではなく名前で探します） */
  SCHEDULE_HEADERS: {
    eventName: '内容',
    date: '日程',
    dateShort: '日程短',
    startTime: '開始時間',
    endTime: '終了時間',
    owner: '担当者',
  },

  /** 対象イベント名（完全一致。「サポート講師ビギナーグルコン」は拾いません） */
  TARGET_EVENT_NAME: 'グルコン',

  // ── フォームの回答スプレッドシートの列（1始まり） ───────
  RESPONSE_SHEET_NAME: '',   // 空ならブックの最初のシート
  RESPONSE_COLUMNS: {
    timestamp: 1,  // A タイムスタンプ
    email:     2,  // B メールアドレス
    name:      3,  // C お名前
    question:  4,  // D ヴォンドラ高橋若菜へのご質問&ご相談
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
    /** ファイル名のテンプレート（M/d がグルコン日に置換されます） */
    TITLE_FORMAT: 'M/d',
    TITLE_SUFFIX: 'グルコン',
    FONT_FAMILY: 'Arial',
    NAME_FONT_SIZE: 14,
    NAME_BOLD: true,
    /** 名前の背景色（黄色）。好みで '#FFFF00' や '#FCE5CD' などに変更可 */
    NAME_HIGHLIGHT: '#FFE599',
    BODY_FONT_SIZE: 11,
    /** 2件目以降の質問の前に入れる見出し */
    ADDENDUM_LABEL: '追記：',
    /** 人と人のあいだに入れる空行の数（次のお名前の手前） */
    BLANK_LINES_BETWEEN_PEOPLE: 2,
    /** 同じ人の「追記：」の手前に入れる空行の数 */
    BLANK_LINES_BEFORE_ADDENDUM: 1,
    /** 自動処理メモをドキュメント末尾にも入れるか（既定は入れない＝Chatworkのみ） */
    INCLUDE_NOTES: false,
  },

  // ── 動作モード ─────────────────────────────────────────
  /** true にすると Chatwork に実際には送らず、ログに出すだけ */
  DRY_RUN: false,

  TIMEZONE: 'Asia/Tokyo',
};

/** スクリプトプロパティを優先して設定値を取得する */
function cfg_(key) {
  const prop = PropertiesService.getScriptProperties().getProperty(key);
  if (prop !== null && String(prop).trim() !== '') return String(prop).trim();
  return CONFIG[key] || '';
}


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


// ══════════════════════════════════════════════════════════════
// Responses.gs
// ══════════════════════════════════════════════════════════════

/**
 * フォーム回答の読み取り・名寄せ・重複統合
 */

/** 回答スプレッドシートのシートを取得 */
function getResponseSheet_() {
  const id = cfg_('RESPONSE_SPREADSHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    // 回答スプレッドシートに貼り付けている場合は、そのシートを使う
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('RESPONSE_SPREADSHEET_ID が未設定です。setupCreateForm() を実行するか、手動で設定してください。');
  }
  if (CONFIG.RESPONSE_SHEET_NAME) {
    const sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME);
    if (!sheet) throw new Error('回答シート「' + CONFIG.RESPONSE_SHEET_NAME + '」が見つかりません。');
    return sheet;
  }
  return ss.getSheets()[0];
}

/**
 * 収録期間内の回答を読み込む
 * @return {Array<{timestamp: Date, email: string, name: string, question: string, row: number}>}
 */
function readResponsesInWindow_(windowStart, windowEnd) {
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const C = CONFIG.RESPONSE_COLUMNS;
  const maxCol = Math.max(C.timestamp, C.email, C.name, C.question);
  const values = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  const out = [];
  for (var i = 0; i < values.length; i++) {
    const row = values[i];
    const ts = toDate_(row[C.timestamp - 1]);
    if (!ts) continue;
    if (ts < windowStart || ts > windowEnd) continue;

    const question = String(row[C.question - 1] || '').trim();
    if (!question) continue;   // 質問が空の回答は載せない

    out.push({
      timestamp: ts,
      email: String(row[C.email - 1] || '').trim(),
      name: String(row[C.name - 1] || '').trim(),
      question: question,
      row: i + 2,
    });
  }
  out.sort(function (a, b) { return a.timestamp - b.timestamp; });
  return out;
}

/**
 * 回答を「人」でグルーピングし、完全一致の重複質問を統合する。
 *
 * @return {{groups: Array, notes: Array<string>, stats: Object}}
 *   groups: [{displayName, email, entries: [{question, timestamp}], duplicates: n, aliasNames: []}]
 *   notes : 自動処理メモ（Chatworkに載せる補足）
 */
function buildGroups_(responses) {
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
      notes.push(g.displayName + ' さん：まったく同じ内容の質問が '
        + (g.duplicateCount + 1) + ' 件送信されていたため、1件に統合しました'
        + (g.duplicateSamples.length ? '（「' + g.duplicateSamples[0] + '」）' : ''));
    }
    if (g.entries.length > 1) {
      notes.push(g.displayName + ' さん：内容の異なる質問が ' + g.entries.length
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

/** 保存先フォルダ（Shine A Light講座 / {期} / グルコン）を用意する */
function resolveTargetFolder_(createdLog) {
  const rootId = cfg_('COURSE_ROOT_FOLDER_ID');
  if (!rootId) throw new Error('COURSE_ROOT_FOLDER_ID が設定されていません。');
  const root = DriveApp.getFolderById(rootId);
  const term = getTermName_();                       // 例: "21期"
  const termFolder = getOrCreateFolder_(root, term, createdLog);
  const gruconFolder = getOrCreateFolder_(termFolder, 'グルコン', createdLog);
  return {
    folder: gruconFolder,
    path: root.getName() + ' / ' + term + ' / グルコン',
    term: term,
  };
}

/** ドキュメントのファイル名（例: "8/20グルコン"） */
function buildDocTitle_(eventDate) {
  return formatDate_(eventDate, CONFIG.DOC.TITLE_FORMAT) + CONFIG.DOC.TITLE_SUFFIX;
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
 * 質問まとめドキュメントを作成（既存があれば中身を作り直す）
 * @param {Object} event  対象グルコン
 * @param {Object} result buildGroups_() の結果
 * @param {string=} titleOverride ファイル名を指定したいとき（テスト用）
 * @return {{url: string, title: string, path: string, createdFolders: Array<string>, isNew: boolean}}
 */
function buildDigestDocument_(event, result, titleOverride) {
  const createdFolders = [];
  const target = resolveTargetFolder_(createdFolders);
  const title = titleOverride || buildDocTitle_(event.date);

  const res = getOrCreateDoc_(target.folder, title);
  const doc = res.doc;
  const body = doc.getBody();

  // 何度実行しても増殖しないよう、いったん中身を空にする
  body.clear();

  const D = CONFIG.DOC;

  if (result.groups.length === 0) {
    const p = body.appendParagraph('この期間に事前質問の回答はありませんでした。');
    p.editAsText().setFontFamily(D.FONT_FAMILY).setFontSize(D.BODY_FONT_SIZE);
  }

  result.groups.forEach(function (g, gi) {
    if (gi > 0) appendBlanks_(body, D.BLANK_LINES_BETWEEN_PEOPLE);

    // ── お名前（少し大きく・太字・黄色背景） ──
    const namePara = body.appendParagraph(g.displayName);
    const nameText = namePara.editAsText();
    nameText.setFontFamily(D.FONT_FAMILY)
            .setFontSize(D.NAME_FONT_SIZE)
            .setBold(D.NAME_BOLD)
            .setBackgroundColor(D.NAME_HIGHLIGHT);

    // ── 質問本文 ──
    g.entries.forEach(function (entry, ei) {
      if (ei > 0) {
        appendBlanks_(body, D.BLANK_LINES_BEFORE_ADDENDUM);
        appendLine_(body, D.ADDENDUM_LABEL);
      }
      appendBodyText_(body, entry.question);
    });
  });

  if (D.INCLUDE_NOTES && result.notes.length > 0) {
    appendBlank_(body);
    appendLine_(body, '──────────');
    appendLine_(body, '■ 自動処理メモ');
    result.notes.forEach(function (n) { appendLine_(body, '・' + n); });
  }

  // 先頭に残る空段落を掃除する
  cleanupLeadingEmpty_(body);

  doc.saveAndClose();

  return {
    url: doc.getUrl(),
    title: title,
    path: target.path,
    term: target.term,
    createdFolders: createdFolders,
    isNew: res.created,
  };
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
 */

function openForm_() { return setFormAccepting_(true); }
function closeForm_() { return setFormAccepting_(false); }

function setFormAccepting_(accepting) {
  const id = cfg_('FORM_ID');
  if (!id) throw new Error('FORM_ID が未設定です。setupCreateForm() を実行するか、手動で設定してください。');
  const form = FormApp.openById(id);
  if (form.isAcceptingResponses() === accepting) {
    logInfo_('フォームはすでに' + (accepting ? '受付中' : '締切済み') + 'です。');
    return false;
  }
  form.setAcceptingResponses(accepting);
  logInfo_('フォームを' + (accepting ? 'オープン' : 'クローズ') + 'しました。');
  return true;
}

function isFormAccepting_() {
  const id = cfg_('FORM_ID');
  if (!id) return null;
  return FormApp.openById(id).isAcceptingResponses();
}

/**
 * 締切後の表示メッセージを、次回グルコンの日付に合わせて更新する
 */
function updateClosedMessage_(nextEvent) {
  const id = cfg_('FORM_ID');
  if (!id) return;
  const form = FormApp.openById(id);
  var msg = '事前質問の受付は終了しました。ご質問ありがとうございました。';
  if (nextEvent) {
    msg += '\n次回グルコン（' + formatDateJa_(nextEvent.date) + '）の受付は '
        + formatDateJa_(addDays_(nextEvent.date, -CONFIG.OPEN_DAYS_BEFORE)) + ' に開始します。';
  }
  form.setCustomClosedFormMessage(msg);
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
function buildNotificationMessage_(event, result, docInfo) {
  const settings = readSettings_();
  const mention = String(settings['Chatwork メンション先'] || '').trim();

  const lines = [];
  lines.push('[info][title]' + docInfo.title + '　事前質問まとめ[/title]');
  if (mention) lines.push(mention);
  lines.push('');

  const when = formatDateJa_(event.date)
    + (event.startTime ? ' ' + event.startTime : '')
    + (event.endTime ? '〜' + event.endTime : '');
  lines.push(when + ' 開催グルコンの事前質問をまとめました。');
  lines.push('');
  lines.push('▼ドキュメント');
  lines.push(docInfo.url);
  lines.push('');
  lines.push('保存先：' + docInfo.path);
  lines.push('');

  const s = result.stats;
  lines.push('回答 ' + s.responseCount + '件 ／ 質問者 ' + s.personCount
    + '名 ／ 掲載 ' + s.questionCount + '件'
    + (s.duplicateCount > 0 ? '（重複 ' + s.duplicateCount + '件を除外）' : ''));

  if (result.notes.length > 0) {
    lines.push('');
    lines.push('■ 自動処理の補足');
    result.notes.forEach(function (n) { lines.push('・' + n); });
  }

  if (docInfo.createdFolders.length > 0) {
    lines.push('');
    lines.push('※ フォルダを新規作成しました：' + docInfo.createdFolders.join(' / '));
    lines.push('　 期の設定が正しいかご確認ください（「基本設定」B2 ＝ ' + docInfo.term + '）');
  }

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
  showStatus();
}

/** すべてのトリガーを削除する */
function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  logInfo_('既存のトリガーをすべて削除しました。');
}

/** 現在の設定状況をログに出す（設定確認用） */
function showStatus() {
  const lines = [];
  lines.push('── 設定状況 ──────────────────────────');
  try {
    lines.push('期（基本設定B2）      : ' + getTermName_());
  } catch (e) {
    lines.push('期（基本設定B2）      : ⚠ ' + e.message);
  }
  lines.push('マスタSS ID           : ' + (cfg_('MASTER_SPREADSHEET_ID') || '⚠ 未設定'));
  lines.push('講座ルートフォルダID  : ' + (cfg_('COURSE_ROOT_FOLDER_ID') || '⚠ 未設定'));
  lines.push('フォームID            : ' + (cfg_('FORM_ID') || '⚠ 未設定'));
  lines.push('回答スプレッドシートID: ' + (cfg_('RESPONSE_SPREADSHEET_ID') || '⚠ 未設定'));

  const props = PropertiesService.getScriptProperties();
  lines.push('CHATWORK_TOKEN        : ' + (props.getProperty('CHATWORK_TOKEN') ? '設定済み' : '⚠ 未設定'));
  lines.push('CHATWORK_ROOM_ID      : ' + (props.getProperty('CHATWORK_ROOM_ID') || '⚠ 未設定'));
  lines.push('DRY_RUN               : ' + CONFIG.DRY_RUN);

  try {
    const accepting = isFormAccepting_();
    lines.push('フォームの状態        : ' + (accepting === null ? '不明' : (accepting ? '受付中' : '締切中')));
  } catch (e) {
    lines.push('フォームの状態        : ⚠ ' + e.message);
  }

  try {
    const rootId = cfg_('COURSE_ROOT_FOLDER_ID');
    if (rootId) {
      const names = [];
      const it = DriveApp.getFolderById(rootId).getFolders();
      while (it.hasNext() && names.length < 30) names.push(it.next().getName());
      lines.push('講座ルート直下フォルダ: ' + (names.length ? names.join(' / ') : '(なし)'));
    }
  } catch (e) {
    lines.push('講座ルート直下フォルダ: ⚠ ' + e.message);
  }

  try {
    const events = listTargetEvents_();
    lines.push('グルコン件数          : ' + events.length + '件');
    const next = findNextEvent_();
    lines.push('次回グルコン          : ' + (next
      ? formatDateJa_(next.date) + ' ' + next.startTime + '〜' + next.endTime
      : '（今日以降の予定なし）'));
    if (next) {
      const w = getCollectionWindow_(next.date);
      lines.push('　受付期間            : ' + formatDate_(w.start, 'M/d HH:mm')
        + ' 〜 ' + formatDate_(w.end, 'M/d HH:mm'));
      lines.push('　ドキュメント名      : ' + buildDocTitle_(next.date));
    }
  } catch (e) {
    lines.push('グルコン一覧          : ⚠ ' + e.message);
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
      openForm_();
      logInfo_('【オープン】' + formatDateJa_(openTarget.date) + ' のグルコンに向けてフォームを開きました。');
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
    closeForm_();
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
      closeForm_();
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
    openForm_();
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
  const result = buildGroups_(responses);
  const docInfo = buildDigestDocument_(event, result);

  logInfo_('ドキュメント：' + docInfo.title + ' → ' + docInfo.url);
  logInfo_('回答 ' + result.stats.responseCount + '件 ／ 質問者 ' + result.stats.personCount
    + '名 ／ 掲載 ' + result.stats.questionCount + '件');
  result.notes.forEach(function (n) { logInfo_('・' + n); });

  if (notify) {
    sendChatwork_(buildNotificationMessage_(event, result, docInfo));
  }
  return { result: result, docInfo: docInfo };
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
      .createMenu('グルコン質問まとめ')
      .addItem('① 設定状況を確認', 'menuShowStatus')
      .addItem('② テスト：この回答シート全部でドキュメント作成', 'menuTestAllRows')
      .addSeparator()
      .addItem('質問まとめを作成（Chatwork送信なし）', 'menuBuildPreview')
      .addItem('質問まとめを作成してChatworkへ送信', 'menuBuildAndNotify')
      .addSeparator()
      .addItem('フォームを開く', 'menuOpenForm')
      .addItem('フォームを閉じる', 'menuCloseForm')
      .addSeparator()
      .addItem('Chatworkへの接続テスト', 'menuTestChatwork')
      .addItem('自動実行トリガーを設置', 'menuInstallTriggers')
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
    openForm_();
    return 'フォームを受付中にしました。';
  });
}

function menuCloseForm() {
  runFromMenu_('フォームを閉じる', function () {
    closeForm_();
    return 'フォームを締切にしました。';
  });
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

function menuInstallTriggers() {
  runFromMenu_('トリガー設置', function () {
    setupInstallTriggers();
    return '自動実行トリガーを設置しました。\n\n'
      + '・毎日 ' + CONFIG.PLANNER_HOUR + ':00 … フォームのオープン判定\n'
      + '・前日 ' + CONFIG.CLOSE_HOUR + ':00 … フォームの締切\n'
      + '・前日 ' + CONFIG.NOTIFY_HOUR + ':' + CONFIG.NOTIFY_MINUTE + ' … ドキュメント作成＆Chatwork送信\n'
      + '・毎日 ' + CONFIG.SAFETY_NET_HOUR + ':00 … 取りこぼしの救済';
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

const FORM_TITLE = 'グルコン事前質問フォーム';
const QUESTION_ITEM_TITLE = 'ヴォンドラ高橋若菜へのご質問&ご相談';

/**
 * ★フォームと回答スプレッドシートを作り、スクリプトプロパティに登録します。
 * 実行後、ログに出るURLを「基本設定」の
 * 「グルコン事前フォームURL」に貼り替えてください。
 */
function setupCreateForm() {
  const form = FormApp.create(FORM_TITLE);
  form.setDescription(
    'グルコン当日にヴォンドラ高橋若菜先生へ相談したいこと・質問したいことをご記入ください。\n'
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

  form.addParagraphTextItem()
    .setTitle(QUESTION_ITEM_TITLE)
    .setHelpText('困っていること、相談したいことを具体的にご記入ください。')
    .setRequired(true);

  // ── 回答設定 ──
  form.setAllowResponseEdits(false);      // 締切後に内容が変わらないように
  form.setLimitOneResponsePerUser(false); // 何度でも質問を送れるように
  form.setProgressBar(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('ご質問ありがとうございました。グルコンでお答えいたします。');
  form.setAcceptingResponses(false);      // 最初は閉じた状態。5日前に自動で開きます。

  // ── 回答スプレッドシートを作成して紐付け ──
  const ss = SpreadsheetApp.create(FORM_TITLE + '（回答）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ── フォルダへ移動（講座ルート直下） ──
  try {
    const root = DriveApp.getFolderById(cfg_('COURSE_ROOT_FOLDER_ID'));
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
 * フォームも回答データも無い状態で、サンプルの質問から
 * 実際のフォルダに「(サンプル)」付きのドキュメントを作ります。
 *
 * これで確認できること：
 *   ・「基本設定」B2 から期を正しく読めているか
 *   ・Shine A Light講座 / {期} / グルコン に保存できるか
 *   ・お名前の書式（大きさ・太字・黄色背景）が好みか
 *   ・同じ質問の統合、「追記：」のまとめ方が意図通りか
 *   ・Chatworkに送られる文面が意図通りか
 */
function demoBuildSampleDocument() {
  const sampleDate = findNextEvent_() ? findNextEvent_().date : addDays_(new Date(), 3);
  const event = {
    date: sampleDate,
    dateShort: formatDateJa_(sampleDate),
    startTime: '10:00',
    endTime: '11:00',
    owner: '若菜先生',
  };

  const base = addDays_(sampleDate, -3);
  function at(dayOffset, h, m) {
    const d = addDays_(base, dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  }

  // ── サンプル回答 ──────────────────────────────────────
  const responses = [
    {
      timestamp: at(0, 9, 12),
      email: 'yamada@example.com',
      name: '山田絵里香',
      row: 2,
      question: [
        '質問①',
        'まだYouTubeアップの課題は提出できてないのですが、今後の為にお聞きしたいです。',
        '発表会の演奏動画をYouTubeに載せているお教室がありますが、それはスマホでの撮影なのか？ビデオカメラなのか？それとも他にいいものがあるのかを知りたいです。',
        '',
        '質問②',
        'ホームページの添削をしていただきたいです。',
        '若菜先生との個別コンサルのあと、ホームページをリニューアルしました。',
        'お聞きしたいのは、その情報をどのような順番で載せたら良いのかを知りたいです。',
        'ホームページURLはこちらです',
        'https://pianonomori-musica.jimdofree.com/',
        'どうぞよろしくお願いいたします。',
      ].join('\n'),
    },
    {
      // ↑と同一人物・別内容 → 「追記：」としてまとめられる
      timestamp: at(1, 21, 4),
      email: 'YAMADA@example.com ',   // 大文字・余分な空白もメアド照合で吸収されます
      name: '山田絵里香',
      row: 3,
      question: [
        '先程質問させていただきました、',
        '質問②のホームページのヘッダーの（自分の）写真ですが、プロフィール写真と一緒のものと直せましたので、その部分は訂正させてください。',
        'どうぞよろしくお願いいたします。',
      ].join('\n'),
    },
    {
      timestamp: at(1, 10, 30),
      email: 'kawamoto@example.com',
      name: '川元　弓子',
      row: 4,
      question: '今さらの疑問です。\nお恥ずかしいのですが、分かっていないため教えてください。',
    },
    {
      // ↑とまったく同じ内容を誤送信 → 1件に統合される
      timestamp: at(1, 10, 31),
      email: 'kawamoto@example.com',
      name: '川元 弓子',
      row: 5,
      question: '今さらの疑問です。\r\nお恥ずかしいのですが、分かっていないため教えてください。  ',
    },
    {
      timestamp: at(2, 8, 0),
      email: 'suzuki@example.com',
      name: '鈴木美咲',
      row: 6,
      question: 'インスタの投稿頻度はどのくらいが良いでしょうか。',
    },
  ];

  const result = buildGroups_(responses);
  const docInfo = buildDigestDocument_(event, result, '(サンプル)' + buildDocTitle_(sampleDate));

  const lines = [];
  lines.push('── サンプル作成結果 ───────────────────');
  lines.push('ドキュメント : ' + docInfo.url);
  lines.push('ファイル名   : ' + docInfo.title);
  lines.push('保存先       : ' + docInfo.path);
  if (docInfo.createdFolders.length) {
    lines.push('※フォルダを新規作成しました: ' + docInfo.createdFolders.join(' / '));
  }
  lines.push('');
  lines.push('回答 ' + result.stats.responseCount + '件 → 質問者 ' + result.stats.personCount
    + '名 / 掲載 ' + result.stats.questionCount + '件 / 重複除外 ' + result.stats.duplicateCount + '件');
  lines.push('');
  lines.push('── Chatworkに送られる文面（今回は送信していません） ──');
  lines.push(buildNotificationMessage_(event, result, docInfo));
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
 *   ① スクリプトプロパティに RESPONSE_SPREADSHEET_ID を設定している場合
 *        testBuildFromAllRows()
 *   ② まだ設定していない場合（URLでもIDでもOK）
 *        testBuildFromAllRows('https://docs.google.com/spreadsheets/d/xxxx/edit')
 *
 * Chatworkには送信しません。ログに文面が出るだけです。
 */
function testBuildFromAllRows(spreadsheetUrlOrId) {
  const ss = spreadsheetUrlOrId
    ? SpreadsheetApp.openById(extractId_(spreadsheetUrlOrId))
    : SpreadsheetApp.openById(cfg_('RESPONSE_SPREADSHEET_ID'));
  const sheet = CONFIG.RESPONSE_SHEET_NAME
    ? ss.getSheetByName(CONFIG.RESPONSE_SHEET_NAME)
    : ss.getSheets()[0];
  if (!sheet) throw new Error('シートが見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('「' + ss.getName() + '」の「' + sheet.getName() + '」にデータがありません。');

  const C = CONFIG.RESPONSE_COLUMNS;
  const maxCol = Math.max(C.timestamp, C.email, C.name, C.question);
  if (sheet.getLastColumn() < maxCol) {
    throw new Error('列が足りません。A:タイムスタンプ / B:メールアドレス / C:お名前 / D:ご質問 の並びを想定しています。');
  }

  const header = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  const responses = [];
  const skipped = [];
  values.forEach(function (row, i) {
    const question = String(row[C.question - 1] || '').trim();
    if (!question) {
      if (String(row[C.name - 1] || '').trim() || String(row[C.email - 1] || '').trim()) {
        skipped.push((i + 2) + '行目（質問が空欄）');
      }
      return;
    }
    responses.push({
      timestamp: toDate_(row[C.timestamp - 1]) || new Date(2000, 0, 1 + i),
      email: String(row[C.email - 1] || '').trim(),
      name: String(row[C.name - 1] || '').trim(),
      question: question,
      row: i + 2,
    });
  });
  responses.sort(function (a, b) { return a.timestamp - b.timestamp; });

  if (responses.length === 0) {
    throw new Error('質問が入力された行が1件もありませんでした。D列（ご質問）を確認してください。');
  }

  const next = findNextEvent_();
  const eventDate = next ? next.date : addDays_(new Date(), 3);
  const event = next || {
    date: eventDate,
    dateShort: formatDateJa_(eventDate),
    startTime: '',
    endTime: '',
    owner: '',
  };

  const result = buildGroups_(responses);
  const docInfo = buildDigestDocument_(event, result, '(テスト)' + buildDocTitle_(eventDate));

  const lines = [];
  lines.push('── 読み込んだスプレッドシート ───────────────');
  lines.push('ファイル : ' + ss.getName());
  lines.push('シート   : ' + sheet.getName());
  lines.push('列の対応 : A「' + header[C.timestamp - 1] + '」 / B「' + header[C.email - 1]
    + '」 / C「' + header[C.name - 1] + '」 / D「' + header[C.question - 1] + '」');
  lines.push('　★上の列名がタイムスタンプ／メールアドレス／お名前／ご質問 の順になっているか確認してください');
  lines.push('読み込み : ' + responses.length + '行');
  if (skipped.length) lines.push('スキップ : ' + skipped.join('、'));
  lines.push('');
  lines.push('── 集約結果 ─────────────────────────────');
  result.groups.forEach(function (g) {
    lines.push('■ ' + g.displayName + '（質問 ' + g.entries.length + '件'
      + (g.duplicateCount ? ' / 重複 ' + g.duplicateCount + '件を除外' : '') + '）');
    g.entries.forEach(function (e, i) {
      lines.push('   ' + (i > 0 ? '追記：' : '　　　') + summarize_(e.question, 50));
    });
  });
  lines.push('');
  lines.push('── 作成したドキュメント ─────────────────');
  lines.push(docInfo.url);
  lines.push('ファイル名 : ' + docInfo.title);
  lines.push('保存先     : ' + docInfo.path);
  if (docInfo.createdFolders.length) {
    lines.push('※フォルダを新規作成しました: ' + docInfo.createdFolders.join(' / '));
  }
  lines.push('');
  lines.push('── Chatworkに送られる文面（送信はしていません） ──');
  lines.push(buildNotificationMessage_(event, result, docInfo));
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
  if (!s) throw new Error('スプレッドシートのURLまたはIDを渡してください。');
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}
