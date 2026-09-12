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
