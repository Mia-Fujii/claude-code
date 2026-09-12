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
