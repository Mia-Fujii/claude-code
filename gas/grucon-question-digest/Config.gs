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
    /**
     * 作成したドキュメントを「リンクを知っている全員が閲覧可」にするか。
     * false にすると、保存先フォルダの共有設定をそのまま引き継ぎます。
     */
    SHARE_ANYONE_WITH_LINK: true,
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
