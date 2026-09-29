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
 *
 * ① スクリプトプロパティ PROFILE が設定されていればそれを使う
 * ② 貼り付けられているスプレッドシートのIDから自動判別
 *    ・回答スプレッドシート  → そのプロファイル
 *    ・日程スプレッドシート  → そのプロファイル（1つに絞れる場合のみ）
 * ③ どちらでもなければ DEFAULT_PROFILE
 *
 * 回答シート・日程シートのどちらに貼っても正しく動きます。
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

      // ── 回答スプレッドシートに貼られている場合 ──
      for (var key in PROFILES) {
        if (PROFILES[key].responseSpreadsheetId === id) {
          PROFILE_CACHE_ = PROFILES[key];
          return PROFILE_CACHE_;
        }
      }

      // ── 日程スプレッドシートに貼られている場合 ──
      //    複数のイベントが同じ日程シートを使っていると絞れないため、
      //    1つだけ一致するときに限って採用します。
      const byMaster = [];
      for (var k2 in PROFILES) {
        if (PROFILES[k2].masterSpreadsheetId === id) byMaster.push(PROFILES[k2]);
      }
      if (byMaster.length === 1) {
        PROFILE_CACHE_ = byMaster[0];
        return PROFILE_CACHE_;
      }
      if (byMaster.length > 1) {
        console.warn('この日程スプレッドシートは複数のイベントで共用されているため、'
          + 'どのイベントか判別できません（' + byMaster.map(function (p) { return p.label; }).join(' / ')
          + '）。スクリプトプロパティ PROFILE でイベント名を指定してください。');
      } else {
        console.warn('このスプレッドシート（' + id + '）はPROFILESに登録されていません。'
          + '「' + DEFAULT_PROFILE + '」の設定で動きます。');
      }
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
    // ── メール下書き機能で使う列（無くても動きます）──
    mailSet: 'メールセット',          // この日付の朝に事前案内3通の下書きを作ります
    archiveUrl: 'アーカイブ動画URL',   // 手入力
    digestUrl: '活動報告まとめURL',    // まとめ作成時に自動で書き込まれます
    draftStatus: '下書き作成',         // 下書きを作った記録（自動）
  },

  /** メール下書きを作る時刻（毎朝） */
  DRAFT_HOUR: 7,

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
    // ── 区切りの見出し（【活動報告】【質問】）──
    /**
     * 見出しスタイル。'HEADING1'〜'HEADING4' にすると
     * Googleドキュメントの「概要（アウトライン）」パネルに目次として出ます。
     * 'NORMAL' にすると、ただの太字テキストになります。
     */
    HEADING_LEVEL: 'HEADING1',
    HEADING_FONT_SIZE: 16,
    /**
     * 見出しの文字色（ピンク）。濃さの好みで差し替えてください。
     *   '#D81B60' … 濃いめのピンク（既定）
     *   '#E91E63' … やや明るいピンク
     *   '#EC7CA8' … やさしいピンク
     */
    HEADING_COLOR: '#D81B60',
    HEADING_BOLD: true,
    /** 2つ目以降の区切り（【質問】など）の手前に区切り線を入れるか */
    SECTION_DIVIDER: true,

    /**
     * お名前も見出しにして、概要パネルに並べるか。
     * true にすると見た目はそのまま（14pt・太字・黄色背景）で、
     * 概要パネルに全員のお名前が目次として出ます。
     */
    NAME_AS_HEADING: false,
    NAME_HEADING_LEVEL: 'HEADING2',
    /** お名前の文字色 */
    NAME_COLOR: '#000000',
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
