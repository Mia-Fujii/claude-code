/**
 * プラチナプログラム 契約管理
 *
 * 「契約入力」シートに1行入力して「処理する」にチェックを入れると（確認画面のあと）:
 *   1. クライアント様のメンバーリスト「最新版メンバーリスト」を更新（更新の方は一番下へ移動し、過去の期間をI列以降に残す）
 *   2. 同じスプレッドシートの「分割支払い」に1行追加
 *   3. 税理士さん共有用シート「プラチナ」に1行追加
 *   4. このスプレッドシートの「支払予定」に支払い1回＝1行で追加
 *   5. 初めての金額の組み合わせなら「料金マスタ」に登録
 *   6. 分割の方は覚書（Googleドキュメント＋PDF）を作成
 *   7. Gmail に案内メールの下書きを作成
 *
 * 毎朝の自動チェック（dailyCheck）で、期日が近い未入金の支払いを
 * チャットワークに通知し、支払い案内メールの下書きを作成します。
 */

const TZ = 'Asia/Tokyo';

const SHEET = {
  INPUT: '契約入力',
  SCHEDULE: '支払予定',
  PRICE: '料金マスタ',
  SETTINGS: '設定',
};

// 「契約入力」シートの列（並びを変える時はここだけ直す）
const IN_COLS = [
  ['CHECK', '処理する'],
  ['STATUS', '状態'],
  ['ID', '契約ID'],
  ['KUBUN', '新規/更新'],
  ['KOBETSU', '個別コンサル'],
  ['NAME', '氏名'],
  ['EMAIL', 'メールアドレス'],
  ['CONTRACT', '契約日\n更新は空欄で前回満了の翌日'],
  ['DUE1', '手続き期限\n（1回目の期日）\n更新は空欄で契約日の前日'],
  ['COUNT', '支払回数\n（一括＝1）'],
  ['INTERVAL', '支払間隔（月）\n空欄なら自動'],
  ['METHOD', '支払方法'],
  ['MIX', '併用の内訳\n例）銀行振込 40万, PayPal 35万, PayPal 35万'],
  ['TOTAL', '総額'],
  ['FIRST', '1回目の金額'],
  ['REST', '2回目以降の\n1回の金額\n（分割はここだけでOK）'],
  ['LINK', '決済リンク\n（PayPalは空欄で自動）'],
  ['KOBETSU_START', '個別コンサル\nスタート月'],
  ['ONETIME', '今回だけの金額\n（料金マスタに登録しない）'],
  ['NOTE', '備考'],
  ['MEMO_DOC', '覚書ドキュメント'],
  ['MEMO_PDF', '覚書PDF'],
  ['DRAFT', 'メール下書き'],
  ['DONE', '完了した手順'],
  ['PROCESSED_AT', '処理日時'],
  // ↓ 後から追加した列（既存のシートの並びを崩さないよう末尾に足す）
  ['MEMO_DATE', '覚書の日付\n（空欄＝手続き期限の5日前）'],
];
const IN = {};
IN_COLS.forEach(function (c, i) { IN[c[0]] = i + 1; });

const SCH_HEADERS = ['契約ID', '氏名', 'メールアドレス', '支払回数', '回', '期日', '金額', '支払方法', '決済リンク', '入金済', '入金日', '通知日', 'メモ'];
const SCH = {};
SCH_HEADERS.forEach(function (h, i) { SCH[h] = i; });

const PRICE_HEADERS = ['新規/更新', '個別コンサル', '支払回数', '支払方法', '総額', '1回目の金額', '2回目以降の1回の金額', '決済リンク', '登録日', 'メモ'];

const METHODS = ['銀行振込', 'PayPal', 'スクエア', 'mosh', '併用'];

const BANK_TEXT = [
  '楽天銀行',
  '第４営業支店',
  '支店番号：２５４',
  '口座番号：７１２１８９１',
  '口座名義：株式会社CROZEN (クロゼン）',
].join('\n');

// [キー, 初期値, 説明]
const DEFAULT_SETTINGS = [
  ['モード', '本番', '「テスト」の間は、下のメンバーリスト・税理士シートがテスト用コピーになっています'],
  ['メンバーリストURL', 'https://docs.google.com/spreadsheets/d/12GxZrvF6BKO9eoIZqfmufoh8cpUuVABfjSttFLkoC3I/edit', 'クライアント様のメンバーリスト（最新版メンバーリスト・分割支払いのあるファイル）'],
  ['メンバーリスト_タブ名', '最新版メンバーリスト', ''],
  ['分割支払い_タブ名', '分割支払い', ''],
  ['税理士シートURL', 'https://docs.google.com/spreadsheets/d/1cQVzvO8XJ-LfX2JKlB5AndAo69wIDZvukHvriY_B098/edit', '税理士共有用スプレッドシート'],
  ['税理士シート_タブ名', 'プラチナ', ''],
  ['メールリスト名_個別あり', 'プラチナメンバー', 'メンバーリストB列に入る文字'],
  ['メールリスト名_個別なし', 'プラチナ（個別なし）', 'メンバーリストB列に入る文字'],
  ['プログラム名_新規', 'プラチナプログラム', '覚書に入る名前'],
  ['プログラム名_更新', 'プラチナ継続プログラム', '覚書に入る名前'],
  ['フォーム_個別あり_一括', 'https://forms.gle/SSQUA3MSgXMFHnFFA', '受講規約フォーム'],
  ['フォーム_個別あり_分割', 'https://forms.gle/fU6aewayYBDXmPoB7', '受講規約フォーム'],
  ['フォーム_個別なし_一括', 'https://forms.gle/jxtennY44K7XkxC79', '受講規約フォーム'],
  ['フォーム_個別なし_分割', 'https://forms.gle/NS2oxyeK9smeRmr77', '受講規約フォーム'],
  ['PayPalリンクの先頭', 'https://paypal.me/crozentokyo/', 'この後ろに「金額jpy」を付けてリンクを作ります'],
  ['振込口座', BANK_TEXT, 'メールの振込口座欄に入ります（セル内改行OK）'],
  ['覚書の日付_期限の何日前', 5, '「覚書の日付」が空欄の時、手続き期限の何日前の日付にするか（過ぎていたら処理した日）'],
  ['通知_何日前', 14, '期日の何日前に通知するか'],
  ['通知_対象', '2分割のみ', '2分割のみ / 銀行振込すべて / すべて（いずれも2回目以降の支払いが対象）'],
  ['通知_時刻', 9, '毎朝何時ごろにチェックするか（0〜23）。変えたら「初期設定」を押し直す'],
  ['チャットワーク_ルームID', '', '通知を送るルームのID（ルームURLの #!rid の後ろの数字）'],
  ['チャットワーク_宛先アカウントID', '', '[To:] を付けたい場合の相手のアカウントID（空欄可）'],
  ['フォルダID', '', '初期設定で自動入力'],
  ['覚書保存フォルダID', '', '初期設定で自動入力'],
  ['覚書雛形ID', '', '初期設定で自動入力'],
  ['メール_新規_一括', '', '初期設定で自動入力（メールテンプレのドキュメント）'],
  ['メール_新規_分割', '', '初期設定で自動入力'],
  ['メール_更新_一括', '', '初期設定で自動入力'],
  ['メール_更新_分割', '', '初期設定で自動入力'],
  ['メール_支払案内', '', '初期設定で自動入力（2回目以降のお支払い案内）'],
  ['本番_メンバーリストURL', '', 'テストモード中に本番のURLを覚えておく欄'],
  ['本番_税理士シートURL', '', 'テストモード中に本番のURLを覚えておく欄'],
];

/* ============================================================
 * メニュー
 * ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('プラチナ管理')
    .addItem('✅ チェックした契約を処理する', 'processChecked')
    .addSeparator()
    .addItem('🔁 選択した行の覚書を作り直す', 'redoMemo')
    .addSeparator()
    .addItem('🔔 支払い期日チェックを今すぐ実行', 'dailyCheck')
    .addSeparator()
    .addItem('🧪 テスト用コピーに切り替える', 'switchToTest')
    .addItem('🏁 本番シートに戻す', 'switchToProduction')
    .addSeparator()
    .addItem('💬 チャットワークのトークンを登録', 'setChatworkToken')
    .addItem('⚙️ 初期設定（最初に1回）', 'setup')
    .addToUi();
}

/** 新規/更新・個別・回数・支払方法を入れたら、料金マスタから金額とリンクを自動で埋める */
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== SHEET.INPUT || e.range.getRow() < 2) return;
    const watch = [IN.KUBUN, IN.KOBETSU, IN.COUNT, IN.METHOD];
    if (watch.indexOf(e.range.getColumn()) < 0) return;
    const r = e.range.getRow();
    const row = sh.getRange(r, 1, 1, IN_COLS.length).getValues()[0];
    const kubun = row[IN.KUBUN - 1];
    const kobetsu = row[IN.KOBETSU - 1];
    const n = Number(row[IN.COUNT - 1]);
    const method = normMethod_(row[IN.METHOD - 1]);
    if (!kubun || !kobetsu || !n) return;
    const p = findPrice_(readPrice_(e.source), kubun, kobetsu, n, method);
    if (!p) return;
    const fill = function (col, v) {
      if (v === '' || v == null) return;
      if (row[col - 1] === '' || row[col - 1] == null) sh.getRange(r, col).setValue(v);
    };
    fill(IN.TOTAL, p.total);
    fill(IN.FIRST, p.first);
    fill(IN.REST, p.rest);
    if (p.methodMatch) fill(IN.LINK, p.link);
  } catch (err) {
    // 入力補助なので失敗しても何もしない
  }
}

/* ============================================================
 * 契約の処理
 * ============================================================ */

/** メニューから：チェックが付いた未処理の行をまとめて処理する */
function processChecked() {
  ensureEditTrigger_();
  runProcessing_(null);
}

/**
 * チェックを入れたらすぐ処理する（インストール型の編集トリガーから呼ばれる）。
 * 確認画面で「いいえ」を押したら、チェックを外して何もしない。
 */
function onCheckEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET.INPUT) return;
  const c1 = e.range.getColumn();
  const c2 = c1 + e.range.getNumColumns() - 1;
  if (IN.CHECK < c1 || IN.CHECK > c2) return;
  const r1 = Math.max(2, e.range.getRow());
  const r2 = e.range.getRow() + e.range.getNumRows() - 1;
  if (r2 < r1) return;
  const checks = sh.getRange(r1, IN.CHECK, r2 - r1 + 1, 1).getValues();
  const rows = [];
  checks.forEach(function (v, i) { if (v[0] === true) rows.push(r1 + i); });
  if (rows.length) runProcessing_(rows);
}

/** onlyRows が null なら全行、配列ならその行番号だけを対象にする */
function runProcessing_(onlyRows) {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    ui.alert('他の処理が実行中です。少し待ってから、メニューの「チェックした契約を処理する」を押してください。');
    return;
  }
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET.INPUT);
    ensureInputHeaders_(sh);
    setupSettingsSheet_(ss); // 後から増えた設定項目を足す
    ensureFoldersAndTemplates_();
    const s = getSettings_();
    const last = sh.getLastRow();
    if (last < 2) { ui.alert('「契約入力」にデータがありません。'); return; }
    const values = sh.getRange(2, 1, last - 1, IN_COLS.length).getValues();
    const targets = [];
    const alreadyDone = [];
    values.forEach(function (row, i) {
      const rowNum = i + 2;
      if (onlyRows && onlyRows.indexOf(rowNum) < 0) return;
      if (row[IN.CHECK - 1] !== true) return;
      if (String(row[IN.STATUS - 1]).indexOf('完了') === 0) { alreadyDone.push(rowNum); return; }
      targets.push({ rowNum: rowNum, row: row });
    });
    alreadyDone.forEach(function (r) { if (onlyRows) sh.getRange(r, IN.CHECK).setValue(false); });
    if (!targets.length) {
      ui.alert(alreadyDone.length ? 'この行はすでに処理が完了しています。' : '「処理する」にチェックが付いた未処理の行がありません。');
      return;
    }

    const names = targets.map(function (t) { return '・' + t.row[IN.NAME - 1]; }).join('\n');
    const ok = ui.alert(
      '【' + s['モード'] + 'モード】' + targets.length + '件を処理します',
      names + '\n\nよろしいですか？',
      ui.ButtonSet.YES_NO
    );
    if (ok !== ui.Button.YES) {
      targets.forEach(function (t) { sh.getRange(t.rowNum, IN.CHECK).setValue(false); });
      return;
    }

    const results = [];
    targets.forEach(function (t) {
      try {
        processRow_(ss, sh, t.rowNum, t.row, s);
        results.push('✅ ' + t.row[IN.NAME - 1]);
      } catch (err) {
        sh.getRange(t.rowNum, IN.STATUS).setValue('エラー：' + err.message);
        sh.getRange(t.rowNum, IN.CHECK).setValue(false);
        results.push('❌ ' + t.row[IN.NAME - 1] + '：' + err.message);
      }
    });
    ui.alert('処理結果', results.join('\n') + (results.some(function (r) { return r.indexOf('❌') === 0; })
      ? '\n\n❌ の行は「状態」の列を見て直してから、もう一度チェックを入れてください。' : ''), ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

/** チェックを入れたら動く編集トリガーを、まだ無ければ作る */
function ensureEditTrigger_() {
  const ss = SpreadsheetApp.getActive();
  const exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'onCheckEdit';
  });
  if (!exists) ScriptApp.newTrigger('onCheckEdit').forSpreadsheet(ss).onEdit().create();
}

function processRow_(ss, sh, rowNum, row, s) {
  // 更新で契約日が空欄なら、メンバーリストの前回の契約満了日の翌日にする
  // （書き戻しておくので、やり直した時も同じ日付が使われる）
  if (String(row[IN.KUBUN - 1]).trim() === '更新' && !toDate_(row[IN.CONTRACT - 1])) {
    const d = nextDayAfterPreviousEnd_(normEmail_(row[IN.EMAIL - 1]), s);
    row[IN.CONTRACT - 1] = d;
    sh.getRange(rowNum, IN.CONTRACT).setValue(d);
  }
  // 更新で手続き期限が空欄なら、契約日の前日にする
  if (String(row[IN.KUBUN - 1]).trim() === '更新' && !toDate_(row[IN.DUE1 - 1]) && toDate_(row[IN.CONTRACT - 1])) {
    const due = defaultRenewalDue_(toDate_(row[IN.CONTRACT - 1]));
    row[IN.DUE1 - 1] = due;
    sh.getRange(rowNum, IN.DUE1).setValue(due);
  }
  const c = buildContract_(row, s, readPrice_(ss));
  if (!c.id) c.id = 'P' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + rowNum;

  // 計算した値を入力シートに書き戻す（何が使われたか見えるように）
  const put = function (col, v) { sh.getRange(rowNum, col).setValue(v); };
  put(IN.ID, c.id);
  put(IN.TOTAL, c.total);
  put(IN.FIRST, c.first);
  if (c.n > 1) put(IN.REST, c.rest);
  if (c.n > 1) put(IN.INTERVAL, c.interval);
  if (c.method !== '併用' && c.cardParts.length && !row[IN.LINK - 1]) put(IN.LINK, c.cardParts[0].link);
  if (c.n > 1) put(IN.MEMO_DATE, c.memoDate);
  put(IN.STATUS, '処理中…');

  const done = {};
  String(row[IN.DONE - 1] || '').split(',').filter(String).forEach(function (k) { done[k] = true; });
  const step = function (name, fn) {
    if (done[name]) return;
    try {
      fn();
    } catch (err) {
      throw new Error('［' + name + '］' + err.message);
    }
    done[name] = true;
    put(IN.DONE, Object.keys(done).join(','));
    SpreadsheetApp.flush();
  };

  step('メンバーリスト', function () {
    const start = updateMemberList_(c, s);
    if (!row[IN.KOBETSU_START - 1] && start) put(IN.KOBETSU_START, start);
  });
  step('分割支払い', function () { appendSplitSheet_(c, s); });
  step('税理士', function () { appendTaxSheet_(c, s); });
  step('支払予定', function () { appendSchedule_(ss, c, s); });
  step('料金マスタ', function () { if (!c.oneTime) addPriceIfNew_(ss, c); });
  if (c.n > 1) {
    step('覚書', function () {
      const memo = createMemo_(c, s);
      put(IN.MEMO_DOC, memo.docUrl);
      put(IN.MEMO_PDF, memo.pdfUrl);
    });
  }
  step('下書き', function () {
    createContractDraft_(c, s);
    put(IN.DRAFT, '作成済（' + Utilities.formatDate(new Date(), TZ, 'M/d H:mm') + '）');
  });

  put(IN.STATUS, '完了');
  put(IN.CHECK, false);
  put(IN.PROCESSED_AT, new Date());
}

/**
 * 入力行から契約内容を組み立てる（スプレッドシートには触らない）
 */
function buildContract_(row, s, priceRows) {
  const get = function (k) { return row[IN[k] - 1]; };
  const errors = [];

  const kubun = String(get('KUBUN') || '').trim();
  const kobetsu = String(get('KOBETSU') || '').trim();
  const name = String(get('NAME') || '').trim();
  const email = normEmail_(get('EMAIL'));
  const contractDate = toDate_(get('CONTRACT'));
  const due1 = toDate_(get('DUE1'));
  const n = Number(get('COUNT'));
  const method = normMethod_(get('METHOD'));

  if (['新規', '更新'].indexOf(kubun) < 0) errors.push('新規/更新');
  if (['あり', 'なし'].indexOf(kobetsu) < 0) errors.push('個別コンサル');
  if (!name) errors.push('氏名');
  if (!email || email.indexOf('@') < 0) errors.push('メールアドレス');
  if (!contractDate) errors.push('契約日');
  if (!due1) errors.push('手続き期限');
  if (!(n >= 1 && Math.floor(n) === n)) errors.push('支払回数');
  if (METHODS.indexOf(method) < 0) errors.push('支払方法');
  if (errors.length) throw new Error('入力が足りないか形式が違います：' + errors.join('、'));

  const price = findPrice_(priceRows, kubun, kobetsu, n, method);

  let parts = null;
  if (method === '併用') {
    if (n !== 1) throw new Error('併用払いは一括（支払回数1）のみ対応しています');
    parts = parseMix_(get('MIX'));
  }

  let total = parseAmount_(get('TOTAL'));
  if (parts) {
    const sum = parts.reduce(function (a, p) { return a + p.amount; }, 0);
    if (total == null) total = sum;
    else if (total !== sum) throw new Error('総額 ' + yen_(total) + '円 と併用の内訳の合計 ' + yen_(sum) + '円 が合いません');
  }
  // 総額が空欄で1回の金額が入っていれば、そこから計算する（例：46,000円×12回＝552,000円）
  if (total == null) {
    const f = parseAmount_(get('FIRST'));
    const r = parseAmount_(get('REST'));
    if (r != null) total = (f != null ? f : r) + r * (n - 1);
    else if (f != null) total = f * n; // 1回の金額だけ入っていれば、毎回同じ金額とみなす
  }
  if (total == null && price) total = price.total;
  if (!total) throw new Error('金額が入っていません。「総額」か「2回目以降の1回の金額」に金額を入れてください（料金マスタにも該当がありません）');

  const amounts = computeAmounts_(total, n, parseAmount_(get('FIRST')), parseAmount_(get('REST')));
  const interval = Number(get('INTERVAL')) || (n === 2 ? 6 : 1);
  const schedule = buildSchedule_(due1, n, interval, amounts.first, amounts.rest);

  // 決済リンクと振込額
  const userLinks = String(get('LINK') || '').split(/[\s,、]+/).filter(String);
  const masterLink = price && price.methodMatch ? price.link : '';
  let cardParts = [];
  let bankAmount = 0;
  if (parts) {
    parts.forEach(function (p) {
      if (p.method === '銀行振込') { bankAmount += p.amount; return; }
      const link = userLinks.length ? userLinks.shift() : (p.method === 'PayPal' ? paypalUrl_(s, p.amount) : '');
      cardParts.push({ method: p.method, amount: p.amount, link: link });
    });
  } else if (method === '銀行振込') {
    bankAmount = amounts.first;
  } else {
    const link = userLinks[0] || masterLink || (method === 'PayPal' ? paypalUrl_(s, amounts.first) : '');
    cardParts = [{ method: method, amount: amounts.first, link: link }];
  }

  return {
    id: String(get('ID') || '').trim(),
    kubun: kubun,
    kobetsu: kobetsu,
    name: name,
    email: email,
    contractDate: contractDate,
    endDate: addDays_(addMonths_(contractDate, 12), -1),
    due1: due1,
    n: n,
    interval: interval,
    method: method,
    parts: parts,
    total: total,
    first: amounts.first,
    rest: amounts.rest,
    schedule: schedule,
    cardParts: cardParts,
    bankAmount: bankAmount,
    link: method !== '併用' && method !== '銀行振込' ? (userLinks[0] || masterLink) : '',
    kobetsuStart: String(get('KOBETSU_START') || '').trim(),
    memoDate: toDate_(get('MEMO_DATE')) || defaultMemoDate_(due1, s),
    oneTime: get('ONETIME') === true,
    countLabel: n === 1 ? '一括' : n + '分割',
    methodLabel: parts ? parts.map(function (p) { return p.method + man_(p.amount, ''); }).join('＋') : method,
    programName: kubun === '新規' ? s['プログラム名_新規'] : s['プログラム名_更新'],
  };
}

/* ---------- クライアント様のシートへの書き込み ---------- */

/** 最新版メンバーリスト：既存の方は行を削除して一番下へ。過去の契約期間はI列以降（新しい順）に残す */
function updateMemberList_(c, s) {
  const sh = openTab_(s['メンバーリストURL'], s['メンバーリスト_タブ名']);
  const data = sh.getDataRange().getValues();
  let oldIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (normEmail_(data[i][3]) === c.email) { oldIdx = i; break; }
  }
  const old = oldIdx >= 0 ? data[oldIdx] : null;

  let start = c.kobetsuStart;
  if (!start) {
    if (c.kobetsu === 'なし') start = 'ー';
    else if (c.kubun === '新規') start = Utilities.formatDate(addMonths_(firstOfMonth_(c.contractDate), 1), TZ, 'yyyy年M月') + '〜';
    else start = '';
  }

  const history = [];
  if (old) {
    const prev = old.slice(6);
    for (let j = 0; j + 1 < prev.length; j += 2) {
      if (prev[j] !== '' || prev[j + 1] !== '') history.push(prev[j], prev[j + 1]);
    }
  }
  const listName = c.kobetsu === 'あり' ? s['メールリスト名_個別あり'] : s['メールリスト名_個別なし'];
  const newRow = [0, listName, c.name, c.email, old ? old[4] : '', start, c.contractDate, c.endDate].concat(history);

  if (old) sh.deleteRow(oldIdx + 1);

  const lastRow = lastDataRow_(sh, 3);
  const target = lastRow + 1;
  ensureSize_(sh, target, newRow.length);
  if (lastRow >= 2) {
    sh.getRange(lastRow, 1, 1, sh.getMaxColumns()).copyTo(sh.getRange(target, 1, 1, sh.getMaxColumns()), { formatOnly: true });
  }
  sh.getRange(target, 1, 1, newRow.length).setValues([newRow]);
  sh.getRange(target, 7, 1, newRow.length - 6).setNumberFormat('yyyy/m/d');

  // A列の番号を振り直す
  const names = sh.getRange(2, 3, target - 1, 1).getValues();
  let no = 0;
  const nums = names.map(function (r) { return [r[0] !== '' ? ++no : '']; });
  sh.getRange(2, 1, nums.length, 1).setValues(nums);
  return start;
}

/**
 * 「契約入力」で選んでいる行の覚書を作り直す（雛形を直した時など）。
 * 古い覚書ドキュメントとPDFはゴミ箱に入れる。メンバーリストなど他のシートには触らない。
 */
function redoMemo() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  if (sh.getName() !== SHEET.INPUT) { ui.alert('「契約入力」シートで、作り直したい方の行を選んでから押してください。'); return; }
  ensureFoldersAndTemplates_();
  const s = getSettings_();
  const sel = sh.getActiveRange();
  const r1 = Math.max(2, sel.getRow());
  const r2 = sel.getRow() + sel.getNumRows() - 1;
  if (r2 < r1) { ui.alert('作り直したい方の行を選んでください。'); return; }
  const rows = sh.getRange(r1, 1, r2 - r1 + 1, IN_COLS.length).getValues();
  const targets = rows.map(function (row, i) { return { rowNum: r1 + i, row: row }; })
    .filter(function (x) { return x.row[IN.NAME - 1] !== '' && Number(x.row[IN.COUNT - 1]) > 1 && String(x.row[IN.STATUS - 1]).indexOf('完了') === 0; });
  if (!targets.length) { ui.alert('選んだ行に、処理が完了した分割の方がいません。'); return; }
  const ok = ui.alert('覚書を作り直します',
    targets.map(function (x) { return '・' + x.row[IN.NAME - 1]; }).join('\n') + '\n\n古い覚書とPDFはゴミ箱に入ります。よろしいですか？',
    ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const results = [];
  targets.forEach(function (x) {
    try {
      [x.row[IN.MEMO_DOC - 1], x.row[IN.MEMO_PDF - 1]].forEach(function (u) {
        const m = String(u || '').match(/\/d\/([-\w]{20,})/);
        if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) { /* もう無い */ } }
      });
      const c = buildContract_(x.row, s, readPrice_(ss));
      const memo = createMemo_(c, s);
      sh.getRange(x.rowNum, IN.MEMO_DOC).setValue(memo.docUrl);
      sh.getRange(x.rowNum, IN.MEMO_PDF).setValue(memo.pdfUrl);
      results.push('✅ ' + c.name);
    } catch (err) {
      results.push('❌ ' + x.row[IN.NAME - 1] + '：' + err.message);
    }
  });
  ui.alert('結果', results.join('\n'), ui.ButtonSet.OK);
}

/** 最新版メンバーリストから、そのメールアドレスの方の契約満了日の翌日を返す */
function nextDayAfterPreviousEnd_(email, s) {
  if (!email) throw new Error('更新で契約日を空欄にする時は、メールアドレスを入れてください');
  const data = openTab_(s['メンバーリストURL'], s['メンバーリスト_タブ名']).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normEmail_(data[i][3]) !== email) continue;
    const end = toDate_(data[i][7]);
    if (!end) throw new Error('メンバーリストに契約満了日が入っていません。契約日を入力してください');
    return addDays_(end, 1);
  }
  throw new Error('メンバーリストにこのメールアドレスの方がいません。契約日を入力してください');
}

/** 分割支払い：1行追加（一括も1回目期日だけ入れて追加） */
function appendSplitSheet_(c, s) {
  const sh = openTab_(s['メンバーリストURL'], s['分割支払い_タブ名']);
  const lastRow = lastDataRow_(sh, 2);
  let no = 0;
  if (lastRow >= 2) {
    sh.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
      const v = Number(r[0]);
      if (v > no) no = v;
    });
  }
  const row = [no + 1, c.name, c.email, c.contractDate, c.endDate, c.countLabel, c.methodLabel, '']
    .concat(c.schedule.map(function (p) { return p.date; }));
  const target = lastRow + 1;
  ensureSize_(sh, target, row.length);
  if (lastRow >= 2) {
    sh.getRange(lastRow, 1, 1, row.length).copyTo(sh.getRange(target, 1, 1, row.length), { formatOnly: true });
  }
  sh.getRange(target, 1, 1, row.length).setValues([row]);
  sh.getRange(target, 4, 1, 2).setNumberFormat('yyyy/m/d');
  sh.getRange(target, 9, 1, c.schedule.length).setNumberFormat('yyyy/m/d');
}

/** 税理士シート「プラチナ」：1契約＝1行。決済金額は一括・併用は総額、分割は1回あたり */
function appendTaxSheet_(c, s) {
  const sh = openTab_(s['税理士シートURL'], s['税理士シート_タブ名']);
  const lastRow = lastDataRow_(sh, 2);
  const amount = c.n === 1 ? c.total : c.rest;
  const row = ['', c.name, c.email, c.contractDate, c.endDate, c.countLabel, c.methodLabel, c.due1, amount, c.n + '回'];
  const target = lastRow + 1;
  ensureSize_(sh, target, row.length);
  if (lastRow >= 2) {
    sh.getRange(lastRow, 1, 1, row.length).copyTo(sh.getRange(target, 1, 1, row.length), { formatOnly: true });
  }
  sh.getRange(target, 1, 1, row.length).setValues([row]);
  sh.getRange(target, 4, 1, 2).setNumberFormat('yyyy/m/d');
  sh.getRange(target, 8).setNumberFormat('yyyy/mm/dd');
  sh.getRange(target, 9).setNumberFormat('"¥"#,##0');
}

/* ---------- このスプレッドシート内 ---------- */

function appendSchedule_(ss, c, s) {
  const sh = ss.getSheetByName(SHEET.SCHEDULE);
  const rows = c.schedule.map(function (p) {
    let link = '';
    if (c.method === 'PayPal') link = paypalUrl_(s, p.amount);
    else if (c.method !== '銀行振込' && c.method !== '併用') link = c.link;
    return [c.id, c.name, c.email, c.n, p.no, p.date, p.amount, c.methodLabel, link, false, '', '', ''];
  });
  const start = sh.getLastRow() + 1;
  sh.getRange(start, 1, rows.length, SCH_HEADERS.length).setValues(rows);
  sh.getRange(start, SCH['期日'] + 1, rows.length, 1).setNumberFormat('yyyy/m/d');
  sh.getRange(start, SCH['金額'] + 1, rows.length, 1).setNumberFormat('#,##0');
  sh.getRange(start, SCH['入金済'] + 1, rows.length, 1).insertCheckboxes();
}

function readPrice_(ss) {
  const sh = ss.getSheetByName(SHEET.PRICE);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, PRICE_HEADERS.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      return {
        kubun: String(r[0]).trim(), kobetsu: String(r[1]).trim(), n: Number(r[2]),
        method: normMethod_(r[3]), total: parseAmount_(r[4]), first: parseAmount_(r[5]),
        rest: parseAmount_(r[6]), link: String(r[7] || '').trim(),
      };
    });
}

/** 新規/更新・個別・回数が同じ行を探す。支払方法まで一致する行があればそちらを優先（リンクはその時だけ使う） */
function findPrice_(rows, kubun, kobetsu, n, method) {
  let any = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kubun !== kubun || r.kobetsu !== kobetsu || r.n !== n) continue;
    if (r.method === method) return Object.assign({ methodMatch: true }, r);
    if (!any) any = Object.assign({ methodMatch: false }, r);
  }
  return any;
}

function addPriceIfNew_(ss, c) {
  const exact = findPrice_(readPrice_(ss), c.kubun, c.kobetsu, c.n, c.method);
  if (exact && exact.methodMatch) return;
  const link = (c.method === 'PayPal' || c.method === '併用') ? '' : c.link;
  ss.getSheetByName(SHEET.PRICE).appendRow([
    c.kubun, c.kobetsu, c.n, c.method, c.total, c.first, c.n > 1 ? c.rest : '', link,
    new Date(), c.name + '様の契約から自動登録',
  ]);
}

/* ---------- 覚書 ---------- */

function createMemo_(c, s) {
  const tplId = s['覚書雛形ID'];
  if (!tplId) throw new Error('覚書雛形IDが設定にありません（初期設定を実行してください）');
  const folder = DriveApp.getFolderById(s['覚書保存フォルダID']);
  const title = c.name + '様' + c.programName + 'に関する覚書';
  const copy = DriveApp.getFileById(idFromUrl_(tplId)).makeCopy(title, folder);
  const doc = openDoc_(copy.getId(), '作成した覚書');
  const body = doc.getBody();

  const vars = {
    '氏名': c.name,
    'プログラム名': c.programName,
    '合計金額': yen_(c.total) + '円',
    '分割回数': String(c.n),
    '作成日': Utilities.formatDate(c.memoDate, TZ, 'yyyy年M月d日'),
  };
  Object.keys(vars).forEach(function (k) {
    body.replaceText('\\{\\{' + k + '\\}\\}', vars[k]);
  });

  const lines = c.schedule.map(function (p) {
    return Utilities.formatDate(p.date, TZ, 'yyyy年M月d日') + 'までに、' + yen_(p.amount) + '円';
  });
  const found = body.findText('\\{\\{支払明細\\}\\}');
  if (found) {
    const par = found.getElement().getParent();
    if (par.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const idx = body.getChildIndex(par);
      lines.forEach(function (line, i) {
        const p = par.copy();
        p.setText(line);
        body.insertParagraph(idx + 1 + i, p);
      });
      par.removeFromParent();
    } else {
      body.replaceText('\\{\\{支払明細\\}\\}', lines.join('\n'));
    }
  }
  doc.saveAndClose();

  const pdf = folder.createFile(copy.getAs(MimeType.PDF)).setName(title + '.pdf');
  return { docUrl: copy.getUrl(), pdfUrl: pdf.getUrl() };
}

/* ---------- メール ---------- */

function createContractDraft_(c, s) {
  const key = 'メール_' + c.kubun + '_' + (c.n === 1 ? '一括' : '分割');
  const tpl = loadTemplate_(s[key], key);
  const vars = contractMailVars_(c, s);
  createDraft_(c.email, renderTemplate_(tpl.subject, vars), renderTemplate_(tpl.body, vars));
}

function contractMailVars_(c, s) {
  const form = s['フォーム_個別' + c.kobetsu + '_' + (c.n === 1 ? '一括' : '分割')];
  return {
    '氏名': c.name,
    '期限': mdw_(c.due1),
    '合計金額': yen_(c.total) + '円',
    '支払内容': describePayment_(c),
    '支払方法名': c.method === '銀行振込' ? '銀行振込' : 'クレジットカード',
    '分割回数': String(c.n),
    '1回金額': yen_(c.n === 1 ? c.total : c.rest) + '円',
    '1回目金額': yen_(c.first) + '円',
    '振込口座': c.bankAmount ? bankBlock_(s, c.bankAmount) : '',
    '決済リンク': linkBlock_(c.cardParts),
    '分割補足': c.n === 2 && c.interval === 6 ? '※2回目のお支払いは半年後となります' : '',
    'フォームURL': form || '',
    'プログラム名': c.programName,
  };
}

/** 「銀行振込の一括払い」「1回46,000円の12分割」「銀行振込40万円＋クレジットカード35万円×2枚の一括払い」など */
function describePayment_(c) {
  if (c.parts) {
    const out = [];
    let bank = 0;
    const cards = [];
    c.parts.forEach(function (p) {
      if (p.method === '銀行振込') bank += p.amount;
      else cards.push(p.amount);
    });
    if (bank) out.push('銀行振込' + man_(bank, '円'));
    const groups = [];
    cards.forEach(function (a) {
      const g = groups.filter(function (x) { return x.amount === a; })[0];
      if (g) g.count++; else groups.push({ amount: a, count: 1 });
    });
    groups.forEach(function (g) {
      out.push('クレジットカード' + man_(g.amount, '円') + (g.count > 1 ? '×' + g.count + '枚' : ''));
    });
    return out.join('＋') + 'の一括払い';
  }
  const name = c.method === '銀行振込' ? '銀行振込' : 'クレジットカード';
  if (c.n === 1) return name + 'の一括払い';
  if (c.first === c.rest) return '1回' + yen_(c.rest) + '円の' + c.n + '分割';
  return '初回' + yen_(c.first) + '円＋' + yen_(c.rest) + '円×' + (c.n - 1) + '回の' + c.n + '分割';
}

function bankBlock_(s, amount) {
  return [
    'お振込口座',
    '',
    String(s['振込口座'] || BANK_TEXT),
    '',
    'ご入金額：' + yen_(amount) + '円（税込）',
    '',
    '※お振込手数料はお客様負担にてお願いいたします',
  ].join('\n');
}

function linkBlock_(cardParts) {
  if (!cardParts || !cardParts.length) return '';
  const url = function (p) { return p.link || '【決済リンクを入れてください】'; };
  if (cardParts.length === 1) return '決済リンクはこちら＞＞\n' + url(cardParts[0]);
  return cardParts.map(function (p, i) {
    return (i + 1) + '枚目クレジットカード（' + man_(p.amount, '円') + '）\n' + url(p);
  }).join('\n\n');
}

/** 下書きを作る。HTMLメールにして、URLはクリックできるリンクにする（テキスト版も一緒に入れる） */
function createDraft_(to, subject, body) {
  GmailApp.createDraft(to, subject, body, { htmlBody: textToHtml_(body) });
}

/** 改行はそのまま、URLは <a> リンクにしたHTMLを作る */
function textToHtml_(text) {
  const esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  // URLの終わり：空白・全角文字・括弧・「」など。末尾の句読点は含めない
  const urlRe = /https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'*+,;=%]+/g;
  const html = String(text).split('\n').map(function (line) {
    let out = '';
    let last = 0;
    line.replace(urlRe, function (m, offset) {
      let url = m;
      const trail = url.match(/[.,;:!?)\]]+$/);
      if (trail) url = url.slice(0, -trail[0].length);
      out += esc(line.slice(last, offset)) + '<a href="' + esc(url) + '">' + esc(url) + '</a>';
      last = offset + url.length;
      return m;
    });
    return out + esc(line.slice(last));
  }).join('<br>\n');
  return '<div>' + html + '</div>';
}

/** テンプレのドキュメントを読む。1行目の「件名：」を件名として取り出す */
function loadTemplate_(docId, label) {
  if (!docId) throw new Error('「' + label + '」のテンプレートが設定にありません（初期設定を実行してください）');
  return parseTemplateText_(openDoc_(idFromUrl_(docId), 'メールテンプレート「' + label + '」').getBody().getText());
}

function parseTemplateText_(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  let subject = '';
  const m = (lines[i] || '').match(/^\s*件名\s*[：:]\s*(.*)$/);
  if (m) { subject = m[1].trim(); i++; }
  while (i < lines.length && lines[i].trim() === '') i++;
  return { subject: subject, body: lines.slice(i).join('\n').replace(/\s+$/, '') + '\n' };
}

/**
 * {{目印}} を置き換える。目印だけの行で中身が空なら、その行ごと消す。
 * 知らない目印はそのまま残す（気づけるように）。
 */
function renderTemplate_(text, vars) {
  const out = [];
  String(text).split('\n').forEach(function (line) {
    const only = line.trim().match(/^\{\{([^}]+)\}\}$/);
    if (only && Object.prototype.hasOwnProperty.call(vars, only[1]) && (vars[only[1]] === '' || vars[only[1]] == null)) return;
    out.push(line.replace(/\{\{([^}]+)\}\}/g, function (all, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : all;
    }));
  });
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

/* ============================================================
 * 毎朝の支払い期日チェック
 * ============================================================ */

function dailyCheck() {
  const ss = SpreadsheetApp.getActive();
  ensureFoldersAndTemplates_();
  const s = getSettings_();
  const sh = ss.getSheetByName(SHEET.SCHEDULE);
  const last = sh.getLastRow();
  const notices = [];
  const errors = [];
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, SCH_HEADERS.length).getValues();
    const today = startOfDay_(new Date());
    const days = Number(s['通知_何日前']) || 14;
    const mode = String(s['通知_対象'] || '2分割のみ');

    data.forEach(function (r, i) {
      const due = toDate_(r[SCH['期日']]);
      if (!due || Number(r[SCH['回']]) < 2 || r[SCH['入金済']] === true || r[SCH['通知日']] !== '') return;
      if (mode === '2分割のみ' && Number(r[SCH['支払回数']]) !== 2) return;
      if (mode === '銀行振込すべて' && r[SCH['支払方法']] !== '銀行振込') return;
      const left = Math.round((startOfDay_(due) - today) / 86400000);
      if (left > days) return;

      const rowNum = i + 2;
      try {
        createReminderDraft_(r, s);
        sh.getRange(rowNum, SCH['通知日'] + 1).setValue(today).setNumberFormat('yyyy/m/d');
        sh.getRange(rowNum, SCH['メモ'] + 1).setValue('下書き作成済');
        notices.push('・' + r[SCH['氏名']] + '様　' + r[SCH['回']] + '回目　期日 ' + Utilities.formatDate(due, TZ, 'yyyy/M/d') +
          (left < 0 ? '（' + (-left) + '日過ぎています）' : '（あと' + left + '日）') +
          '　' + yen_(r[SCH['金額']]) + '円・' + r[SCH['支払方法']]);
      } catch (err) {
        errors.push('・' + r[SCH['氏名']] + '様：' + err.message);
        sh.getRange(rowNum, SCH['メモ'] + 1).setValue('エラー：' + err.message);
      }
    });
  }

  let chatResult = '';
  if (notices.length || errors.length) {
    let msg = '[info][title]プラチナ お支払い期日のお知らせ[/title]';
    if (notices.length) msg += notices.join('\n') + '\n\nGmailに支払い案内の下書きを作成しました。確認して送信してください。';
    if (errors.length) msg += (notices.length ? '\n\n' : '') + '下書きを作れなかった方：\n' + errors.join('\n');
    msg += '[/info]';
    try {
      chatResult = postChatwork_(s, msg) ? 'チャットワークに通知しました。' : 'チャットワークが未設定のため通知していません。';
    } catch (err) {
      chatResult = 'チャットワークへの通知に失敗しました：' + err.message;
    }
  }

  // メニューから実行した時だけ結果を表示（トリガー実行では表示できないので無視）
  try {
    SpreadsheetApp.getUi().alert(
      notices.length || errors.length
        ? '対象 ' + notices.length + '件' + (errors.length ? '（エラー ' + errors.length + '件）' : '') + '\n' + chatResult
        : '通知が必要な支払いはありませんでした。'
    );
  } catch (err) { /* トリガー実行時 */ }
}

function createReminderDraft_(r, s) {
  const tpl = loadTemplate_(s['メール_支払案内'], 'メール_支払案内');
  const method = r[SCH['支払方法']];
  const amount = parseAmount_(r[SCH['金額']]);
  let link = String(r[SCH['決済リンク']] || '');
  if (!link && method === 'PayPal') link = paypalUrl_(s, amount);
  const vars = {
    '氏名': r[SCH['氏名']],
    '回': String(r[SCH['回']]),
    '支払期日': mdw_(toDate_(r[SCH['期日']])),
    '支払金額': yen_(amount) + '円',
    '振込口座': method === '銀行振込' ? bankBlock_(s, amount) : '',
    '決済リンク': method === '銀行振込' ? '' : linkBlock_([{ amount: amount, link: link }]),
  };
  createDraft_(normEmail_(r[SCH['メールアドレス']]), renderTemplate_(tpl.subject, vars), renderTemplate_(tpl.body, vars));
}

function postChatwork_(s, text) {
  const token = PropertiesService.getScriptProperties().getProperty('CHATWORK_TOKEN');
  const room = String(s['チャットワーク_ルームID'] || '').trim();
  if (!token || !room) return false;
  const to = String(s['チャットワーク_宛先アカウントID'] || '').trim();
  const res = UrlFetchApp.fetch('https://api.chatwork.com/v2/rooms/' + encodeURIComponent(room) + '/messages', {
    method: 'post',
    headers: { 'X-ChatWorkToken': token },
    // self_unread=1：自分のトークンで送っても、自分から見て未読（未読①）にする
    payload: { body: (to ? '[To:' + to + ']\n' : '') + text, self_unread: '1' },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ' ' + res.getContentText());
  return true;
}

function setChatworkToken() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('チャットワークのAPIトークン', 'チャットワーク右上のメニュー →「サービス連携」→「APIトークン」で表示されるトークンを貼り付けてください。', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const token = res.getResponseText().trim();
  if (!token) return;
  PropertiesService.getScriptProperties().setProperty('CHATWORK_TOKEN', token);
  const s = getSettings_();
  if (!s['チャットワーク_ルームID']) {
    ui.alert('トークンを保存しました。「設定」シートの「チャットワーク_ルームID」も入れてください。');
    return;
  }
  try {
    postChatwork_(s, 'プラチナ管理：チャットワーク通知のテストです。');
    ui.alert('トークンを保存し、テストメッセージを送りました。チャットワークを確認してください。');
  } catch (err) {
    ui.alert('トークンは保存しましたが、テスト送信に失敗しました：\n' + err.message);
  }
}

/* ============================================================
 * テストモード
 * ============================================================ */

function switchToTest() {
  const ui = SpreadsheetApp.getUi();
  const s = getSettings_();
  if (s['モード'] === 'テスト') { ui.alert('すでにテストモードです。'); return; }
  const ok = ui.alert('テスト用コピーに切り替えます',
    'メンバーリストと税理士シートのコピーを「プラチナ契約対応」フォルダに作り、以後の書き込み先をコピーに切り替えます。\n本物のシートには書き込まれなくなります。\n\n※Gmailの下書きとチャットワーク通知は実際に作成・送信されます（メール自体は送信されません）。',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  const folder = DriveApp.getFolderById(s['フォルダID']);
  const stamp = Utilities.formatDate(new Date(), TZ, 'M/d H:mm');
  const m = DriveApp.getFileById(idFromUrl_(s['メンバーリストURL'])).makeCopy('【テスト ' + stamp + '】メンバーリスト', folder);
  const t = DriveApp.getFileById(idFromUrl_(s['税理士シートURL'])).makeCopy('【テスト ' + stamp + '】税理士共有用', folder);
  setSetting_('本番_メンバーリストURL', s['メンバーリストURL']);
  setSetting_('本番_税理士シートURL', s['税理士シートURL']);
  setSetting_('メンバーリストURL', m.getUrl());
  setSetting_('税理士シートURL', t.getUrl());
  setSetting_('モード', 'テスト');
  ui.alert('テストモードにしました。\n\nメンバーリスト（テスト）：\n' + m.getUrl() + '\n\n税理士シート（テスト）：\n' + t.getUrl());
}

function switchToProduction() {
  const ui = SpreadsheetApp.getUi();
  const s = getSettings_();
  if (s['モード'] !== 'テスト') { ui.alert('すでに本番モードです。'); return; }
  const ok = ui.alert('本番シートに戻します',
    '以後の書き込み先を本物のメンバーリスト・税理士シートに戻します。\n\n「契約入力」「支払予定」にテストで入れた行が残っている場合は、先に削除してください（毎朝の通知の対象になります）。',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  setSetting_('メンバーリストURL', s['本番_メンバーリストURL']);
  setSetting_('税理士シートURL', s['本番_税理士シートURL']);
  setSetting_('本番_メンバーリストURL', '');
  setSetting_('本番_税理士シートURL', '');
  setSetting_('モード', '本番');
  ui.alert('本番モードに戻しました。');
}

/* ============================================================
 * 初期設定
 * ============================================================ */

function setup() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const notes = [];

  if (Session.getScriptTimeZone() !== TZ) {
    notes.push('⚠️ スクリプトのタイムゾーンが ' + Session.getScriptTimeZone() + ' です。Apps Script の「プロジェクトの設定」でタイムゾーンを「(GMT+09:00) 日本標準時 - 東京」にしてください。');
  }

  setupSettingsSheet_(ss);
  setupInputSheet_(ss);
  setupScheduleSheet_(ss);
  setupPriceSheet_(ss);
  const blank = ss.getSheetByName('シート1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  const folder = ensureFoldersAndTemplates_();

  // 毎朝のチェック
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t);
  });
  const hour = Math.min(23, Math.max(0, Number(getSettings_()['通知_時刻']) || 9));
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(hour).inTimezone(TZ).create();
  ensureEditTrigger_();

  ss.setActiveSheet(ss.getSheetByName(SHEET.INPUT));
  notes.push('✅ シート・テンプレート・毎朝' + hour + '時ごろのチェック・「処理する」にチェックを入れたら動く仕組みを設定しました。');
  notes.push('📁 フォルダ：' + folder.getUrl());
  notes.push('次は「チャットワークのトークンを登録」と、「設定」シートのチャットワーク_ルームIDの入力をお願いします。');
  ui.alert('初期設定', notes.join('\n\n'), ui.ButtonSet.OK);
}

/**
 * フォルダと雛形・メールテンプレのドキュメントを用意し、IDを設定シートに入れる。
 * 設定が空・ファイルが消えている時は、テンプレートフォルダ内の同じ名前のドキュメントを使い、
 * それも無ければ作り直す（初期設定が途中で止まった場合もここで直る）。
 */
function ensureFoldersAndTemplates_() {
  const s = getSettings_();
  const folder = ensureFolder_(s['フォルダID'], 'プラチナ契約対応', DriveApp.getRootFolder());
  if (s['フォルダID'] !== folder.getId()) setSetting_('フォルダID', folder.getId());
  const memoFolder = ensureFolder_(s['覚書保存フォルダID'], '覚書', folder);
  if (s['覚書保存フォルダID'] !== memoFolder.getId()) setSetting_('覚書保存フォルダID', memoFolder.getId());
  const tplFolder = ensureSubFolder_(folder, 'テンプレート');

  const docs = [
    ['覚書雛形ID', '【雛形】プラチナプログラム 覚書', null],
    ['メール_新規_一括', '【メール】新規_一括', MAIL_TEMPLATES['新規_一括']],
    ['メール_新規_分割', '【メール】新規_分割', MAIL_TEMPLATES['新規_分割']],
    ['メール_更新_一括', '【メール】更新_一括', MAIL_TEMPLATES['更新_一括']],
    ['メール_更新_分割', '【メール】更新_分割', MAIL_TEMPLATES['更新_分割']],
    ['メール_支払案内', '【メール】2回目以降の支払い案内', MAIL_TEMPLATES['支払案内']],
  ];
  // 以前の不具合でタイトルしか入っていない覚書の雛形ができていたら、ゴミ箱に入れて作り直す
  const usable = function (key, id) {
    if (key !== '覚書雛形ID') return true;
    if (/\{\{支払明細\}\}/.test(openDoc_(id, '覚書の雛形').getBody().getText())) return true;
    DriveApp.getFileById(id).setTrashed(true);
    return false;
  };
  docs.forEach(function (d) {
    if (s[d[0]] && fileExists_(idFromUrl_(s[d[0]])) && usable(d[0], idFromUrl_(s[d[0]]))) return;
    let id = '';
    const it = tplFolder.getFilesByName(d[1]);
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed() && usable(d[0], f.getId())) { id = f.getId(); break; }
    }
    if (!id) {
      // 以前の初期設定で作られたままマイドライブに残っている物があれば、フォルダへ移して使う
      const stray = DriveApp.getRootFolder().getFilesByName(d[1]);
      while (stray.hasNext()) {
        const f = stray.next();
        if (f.isTrashed()) continue;
        if (!id && usable(d[0], f.getId())) { f.moveTo(tplFolder); id = f.getId(); } else if (!f.isTrashed()) { f.setTrashed(true); }
      }
    }
    if (!id) id = d[2] === null ? createMemoTemplate_(d[1], tplFolder) : createTextDoc_(d[1], d[2], tplFolder);
    setSetting_(d[0], id);
  });
  SpreadsheetApp.flush();
  return folder;
}

function setupSettingsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.SETTINGS);
  if (!sh) sh = ss.insertSheet(SHEET.SETTINGS);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 3).setValues([['項目', '値', '説明']]).setFontWeight('bold').setBackground('#eeeeee');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 420);
    sh.setColumnWidth(3, 420);
  }
  const existing = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  DEFAULT_SETTINGS.forEach(function (d) {
    if (existing.indexOf(d[0]) < 0) sh.appendRow(d);
  });
  sh.getRange(2, 2, sh.getLastRow() - 1, 2).setWrap(true).setVerticalAlignment('top');
  const modeRow = findSettingRow_(sh, 'モード');
  if (modeRow) sh.getRange(modeRow, 2).setFontWeight('bold');
  const targetRow = findSettingRow_(sh, '通知_対象');
  if (targetRow) sh.getRange(targetRow, 2).setDataValidation(listRule_(['2分割のみ', '銀行振込すべて', 'すべて']));
}

function setupInputSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.INPUT);
  if (!sh) sh = ss.insertSheet(SHEET.INPUT, 0);
  if (sh.getLastRow() > 0) { ensureInputHeaders_(sh); return; }
  const headers = IN_COLS.map(function (c) { return c[1]; });
  ensureSize_(sh, 500, headers.length);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#fde9d9').setWrap(true).setVerticalAlignment('middle');
  sh.getRange(1, IN.MEMO_DOC, 1, IN.PROCESSED_AT - IN.MEMO_DOC + 1).setBackground('#eeeeee');
  sh.getRange(1, IN.STATUS, 1, 2).setBackground('#eeeeee');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(IN.NAME);
  sh.setRowHeight(1, 60);
  const rows = 499;
  sh.getRange(2, IN.CHECK, rows, 1).insertCheckboxes();
  sh.getRange(2, IN.ONETIME, rows, 1).insertCheckboxes();
  sh.getRange(2, IN.KUBUN, rows, 1).setDataValidation(listRule_(['新規', '更新']));
  sh.getRange(2, IN.KOBETSU, rows, 1).setDataValidation(listRule_(['あり', 'なし']));
  sh.getRange(2, IN.METHOD, rows, 1).setDataValidation(listRule_(METHODS));
  sh.getRange(2, IN.CONTRACT, rows, 2).setNumberFormat('yyyy/m/d');
  sh.getRange(2, IN.TOTAL, rows, 3).setNumberFormat('#,##0');
  sh.getRange(2, IN.PROCESSED_AT, rows, 1).setNumberFormat('yyyy/m/d h:mm');
  sh.getRange(2, IN.MEMO_DATE, rows, 1).setNumberFormat('yyyy/m/d');
  [[IN.CHECK, 60], [IN.STATUS, 140], [IN.ID, 130], [IN.NAME, 120], [IN.EMAIL, 200], [IN.MIX, 260], [IN.LINK, 220], [IN.NOTE, 200], [IN.DONE, 200]]
    .forEach(function (w) { sh.setColumnWidth(w[0], w[1]); });
}

/** 後から追加した列の見出しが無ければ足す（既存シート向け） */
function ensureInputHeaders_(sh) {
  ensureSize_(sh, 2, IN_COLS.length);
  sh.setRowHeight(1, 70);
  const cur = sh.getRange(1, 1, 1, IN_COLS.length).getValues()[0];
  IN_COLS.forEach(function (c, i) {
    // 見出しの説明を後から変えた列は、1行目（項目名）が同じなら新しい見出しに書き換える
    const name = c[1].split('\n')[0];
    if (cur[i] !== '' && !(cur[i] !== c[1] && String(cur[i]).split('\n')[0] === name)) return;
    sh.getRange(1, i + 1).setValue(c[1]).setFontWeight('bold').setBackground('#fde9d9').setWrap(true);
    if (c[0] === 'MEMO_DATE') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy/m/d');
  });
}

function setupScheduleSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.SCHEDULE);
  if (!sh) sh = ss.insertSheet(SHEET.SCHEDULE);
  if (sh.getLastRow() > 0) return;
  sh.getRange(1, 1, 1, SCH_HEADERS.length).setValues([SCH_HEADERS]).setFontWeight('bold').setBackground('#e2efda');
  sh.setFrozenRows(1);
  sh.setColumnWidth(SCH['メールアドレス'] + 1, 200);
  sh.setColumnWidth(SCH['決済リンク'] + 1, 220);
  sh.setColumnWidth(SCH['メモ'] + 1, 200);
}

function setupPriceSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.PRICE);
  if (!sh) sh = ss.insertSheet(SHEET.PRICE);
  if (sh.getLastRow() > 0) return;
  sh.getRange(1, 1, 1, PRICE_HEADERS.length).setValues([PRICE_HEADERS]).setFontWeight('bold').setBackground('#ddebf7');
  sh.setFrozenRows(1);
  sh.getRange(2, 1, 200, 1).setDataValidation(listRule_(['新規', '更新']));
  sh.getRange(2, 2, 200, 1).setDataValidation(listRule_(['あり', 'なし']));
  sh.getRange(2, 4, 200, 1).setDataValidation(listRule_(METHODS));
  sh.getRange(2, 5, 200, 3).setNumberFormat('#,##0');
  sh.getRange(2, 9, 200, 1).setNumberFormat('yyyy/m/d');
  sh.setColumnWidth(8, 260);
  sh.setColumnWidth(10, 220);
}

/**
 * 覚書の雛形ドキュメント（甲が乙に対して支払う形に修正済み）。
 * 書式は元の覚書に合わせる：タイトル中央14pt、本文両端揃え、1.2.は番号付きリスト、
 * 「記」と支払明細は中央、「以上」と日付は右、署名欄は左。
 */
function createMemoTemplate_(name, folder) {
  const doc = DocumentApp.create(name);
  const id = doc.getId(); // saveAndClose の後は doc に触れないので先に取っておく
  const body = doc.getBody();
  const A = DocumentApp.HorizontalAlignment;
  const lines = [
    ['費用に関する覚書', A.CENTER, { size: 14 }],
    ['', A.JUSTIFY],
    ['{{氏名}}様（以下「甲」という。）及びヴォンドラ高橋若菜（以下「乙」という。）は、甲乙間で結んだ{{プログラム名}}契約において定める費用に関し、次のとおり合意する。', A.JUSTIFY],
    ['甲が乙に対して、{{プログラム名}}契約にて支払うべき費用を、合計{{合計金額}}とし、支払方法は分割払い（{{分割回数}}分割）とする。', A.JUSTIFY, { list: true }],
    ['分割払いの具体的な方法は、下記のとおりとする。', A.JUSTIFY, { list: true }],
    ['記', A.CENTER],
    ['', A.CENTER],
    ['{{支払明細}}', A.CENTER],
    ['', A.CENTER],
    ['以上', A.RIGHT],
    ['{{作成日}}', A.RIGHT],
    ['', A.LEFT],
    ['甲　住所', A.LEFT],
    ['　　氏名', A.LEFT],
    ['', A.LEFT],
    ['乙　住所：東京都港区麻布台3-2-8', A.LEFT],
    ['　　　　　株式会社CROZEN', A.LEFT],
    ['　　　　　代表取締役　ヴォンドラ高橋若菜', A.LEFT],
  ];
  const first = body.getParagraphs()[0];
  let firstItem = null;
  lines.forEach(function (l, i) {
    const o = l[2] || {};
    let p;
    if (o.list) {
      p = body.appendListItem(l[0]);
      p.setGlyphType(DocumentApp.GlyphType.NUMBER);
      if (firstItem) p.setListId(firstItem); else firstItem = p;
      p.setSpacingBefore(12);
      p.setSpacingAfter(12);
    } else if (i === 0) {
      first.setText(l[0]); // Paragraph.setText は何も返さないので first をそのまま使う
      p = first;
    } else {
      p = body.appendParagraph(l[0]);
    }
    if (!o.list) p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    p.setAlignment(l[1]);
    if (l[0]) p.editAsText().setBold(false).setFontSize(o.size || 11);
  });
  // 元の覚書は明朝体（ヒラギノ明朝）。PDFでもWindowsでも明朝で出るよう Google の明朝体にする
  try { body.editAsText().setFontFamily('Noto Serif JP'); } catch (e) { /* フォントが使えなければ標準のまま */ }
  doc.saveAndClose();
  DriveApp.getFileById(id).moveTo(folder);
  return id;
}

function createTextDoc_(name, text, folder) {
  const doc = DocumentApp.create(name);
  const body = doc.getBody();
  const lines = text.split('\n');
  body.getParagraphs()[0].setText(lines[0]);
  lines.slice(1).forEach(function (l) { body.appendParagraph(l); });
  const id = doc.getId(); // saveAndClose の後は doc に触れないので先に取っておく
  doc.saveAndClose();
  DriveApp.getFileById(id).moveTo(folder);
  return id;
}

/* ============================================================
 * メールテンプレートの初期文面（初期設定でドキュメントになります。以後はドキュメントを直接編集）
 * ============================================================ */

const MAIL_TEMPLATES = {
  '新規_一括': [
    '件名：【重要】プラチナプログラムの今後のお手続きのお願い',
    '',
    '{{氏名}}様',
    '',
    'お世話になっております。',
    'プラチナプログラム運営事務局です。',
    '',
    '改めまして、ヴォンドラ高橋若菜の',
    'プラチナプログラムへのご参加ありがとうございます。',
    '',
    'そして、おめでとうございます！',
    '',
    '',
    'プラチナプログラムのご参加にあたり、',
    '２点お手続きしていただきたい',
    '重要なご案内がございます。',
    '',
    '①ご決済の手続き',
    '②受講規約のフォーム入力',
    '',
    'ご確認いただき、期限までに',
    'お手続きお願いいたします。',
    '',
    '',
    '【プラチナプログラム講座費のお支払いについて】',
    '',
    '今回、講座費のお支払いは',
    '{{支払内容}}で承ります。',
    '',
    '合計金額：{{合計金額}}（税込）',
    '',
    'お手続き期限：',
    '{{期限}}までに、お願いいたします。',
    '',
    '{{振込口座}}',
    '',
    '{{決済リンク}}',
    '',
    '',
    '【申し込みアンケート&受講規約について】',
    '',
    '今後の講座運営のために、',
    'ご入力をお願いいたします。',
    '',
    '入力期限：{{期限}}',
    '',
    '',
    'フォームはこちら＞＞',
    '{{フォームURL}}',
    '',
    '',
    'ご案内は以上です。',
    '',
    'よろしくお願いいたします。',
    '',
    '',
    '',
    'プラチナプログラム運営事務局',
  ].join('\n'),

  '新規_分割': [
    '件名：【重要】プラチナプログラムの今後のお手続きのお願い',
    '',
    '{{氏名}}様',
    '',
    'お世話になっております。',
    'プラチナプログラム運営事務局です。',
    '',
    '改めまして、ヴォンドラ高橋若菜の',
    'プラチナプログラムへのご参加ありがとうございます。',
    '',
    'そして、おめでとうございます！',
    '',
    '',
    'プラチナプログラムのご参加にあたり、',
    '３点お手続きしていただきたい',
    '重要なご案内がございます。',
    '',
    '①ご決済の手続き',
    '②受講規約のフォーム入力',
    '③覚書の電子署名について',
    '',
    '',
    '',
    'ご確認いただき、期限までに',
    'お手続きお願いいたします。',
    '',
    '',
    '【プラチナプログラム講座費のお支払いについて】',
    '',
    '今回、講座費のお支払いは',
    '{{支払方法名}}{{分割回数}}分割（{{1回金額}} × {{分割回数}}回）',
    'で承ります。',
    '',
    '合計金額：{{合計金額}}（税込）',
    '',
    '1回目のお支払いの手続きを',
    '【{{期限}}】までに、お願いいたします。',
    '',
    '{{決済リンク}}',
    '',
    '{{振込口座}}',
    '',
    '{{分割補足}}',
    '',
    '【申し込みアンケート&受講規約について】',
    '',
    '今後の講座運営のために、',
    'ご入力をお願いいたします。',
    '',
    '入力期限：{{期限}}',
    '',
    '',
    'フォームはこちら＞＞',
    '{{フォームURL}}',
    '',
    '',
    '',
    '【覚書の電子署名について】',
    '',
    '＜プラチナプログラムの分割払いについての覚書＞',
    '',
    '今回、プラチナプログラムのご参加にあたり、分割払いに関する覚書の電子署名をお願いいたします。',
    '',
    '「電子印鑑GMOサイン 」から件名が「株式会社CROZEN様より・・・」で始まるメールが届いているかご確認ください。',
    '',
    'ご確認いただき、{{期限}}までに、内容に問題がなければご署名のうえ送信くださいませ。',
    '',
    '※すぐにメールが見つからない場合は、迷惑メール、gmailの場合はプロモーションのメールボックスもご確認ください。',
    '',
    '',
    '＝＝＝',
    '電子署名の操作方法',
    '＝＝＝',
    '',
    '操作方法ですが、',
    '覚書の内容をご確認後',
    '赤い丸の中にご自身のお名前を入力いただき',
    '印鑑のような形になるように',
    'ご署名くださいませ。',
    '',
    'また、電子署名の方法など、操作方法も含めて、ご不明な点がある場合は、事務局までお問い合わせください。',
    '',
    '',
    '',
    'よろしくお願いいたします。',
    '',
    '',
    'プラチナプログラム運営事務局',
  ].join('\n'),

  '更新_一括': [
    '件名：【重要】プラチナプログラム更新のお手続きのお願い',
    '',
    '{{氏名}}様',
    '',
    'お世話になっております。',
    'プラチナプログラム運営事務局です。',
    '',
    '改めまして、ヴォンドラ高橋若菜の',
    'プラチナプログラム継続のご参加ありがとうございます。',
    '',
    'プラチナプログラムのご参加にあたり、',
    '2点お手続きしていただきたい重要なご案内がございます。',
    '',
    '①ご決済の手続き',
    '②受講規約のフォーム入力',
    '',
    'お忙しいとは思いますが、ご確認いただき',
    '期限までにお手続きお願いいたします。',
    '',
    '',
    '【プラチナプログラム講座費のお支払いについて】',
    '',
    '今回、講座費のお支払いは',
    '{{支払内容}}で承ります。',
    '',
    '合計金額：{{合計金額}}（税込）',
    '',
    'お手続き期限：',
    '{{期限}}までに、お願いいたします。',
    '',
    '{{振込口座}}',
    '',
    '{{決済リンク}}',
    '',
    '',
    '【申し込みアンケート&受講規約について】',
    '',
    '今後の講座運営のために、',
    'ご入力をお願いいたします。',
    '',
    '入力期限：{{期限}}',
    '',
    '',
    'フォームはこちら＞＞',
    '{{フォームURL}}',
    '',
    '',
    '',
    'ご案内は以上です。',
    '',
    'よろしくお願いいたします。',
    '',
    '',
    '',
    'プラチナプログラム運営事務局',
  ].join('\n'),

  '更新_分割': [
    '件名：【重要】プラチナプログラム更新のお手続きのお願い',
    '',
    '{{氏名}}様',
    '',
    'お世話になっております。',
    'プラチナプログラム運営事務局です。',
    '',
    '改めまして、ヴォンドラ高橋若菜の',
    'プラチナプログラム継続のご参加ありがとうございます。',
    '',
    'プラチナプログラムの',
    'ご参加にあたり、３点お手続きしていただきたい',
    '重要なご案内がございます。',
    '',
    'お忙しいところ恐縮ですが',
    'ご確認いただき、期日までにお手続きお願いいたします。',
    '',
    '',
    '【プラチナプログラム講座費（継続）のお支払いについて】',
    '',
    '今回、講座費のお支払いは{{支払内容}}でお受けしております。',
    '1回目のお支払い期限は、{{期限}}までとさせていただきます。',
    '',
    '期日までにお手続きお願いいたします。',
    '',
    '{{決済リンク}}',
    '',
    '{{振込口座}}',
    '',
    '{{分割補足}}',
    '',
    '',
    '【申し込みアンケート&受講規約について】',
    '',
    '受講規約につきまして以下フォームよりご提出をお願いいたします。',
    '',
    '{{フォームURL}}',
    '',
    '',
    '【分割払いの覚書について】',
    '',
    'プラチナプログラム分割の覚書を',
    '「電子印鑑GMOサイン 」からお送りしております。',
    '',
    '「電子印鑑GMOサイン 」から件名が「株式会社CROZEN様より・・・」で始まるメールが届いているかご確認ください。',
    '',
    '覚書をご確認いただき、{{期限}}までに、内容に問題がなければご署名のうえ送信くださいませ。',
    '',
    '',
    '内容に関してご質問がある場合は、このメールに返信する形でお送りくださいませ。',
    '',
    '※すぐにメールが見つからない場合は、迷惑メール、gmailの場合はプロモーションのメールボックスもご確認ください。',
    '',
    '',
    '＝＝＝',
    '',
    '電子署名の操作方法',
    '',
    '＝＝＝',
    '',
    '操作方法ですが、',
    '覚書内容をご確認後',
    '住所、氏名の部分を入力していただきます。',
    '',
    'その後、赤い丸の中にご自身のお名前を入力いただき',
    '印鑑のような形になるように',
    'ご署名くださいませ。',
    '',
    'また、電子署名の方法など、操作方法も含めて、ご不明な点がある場合は、事務局までお問い合わせください。',
    '',
    '',
    'よろしくお願いいたします。',
    '',
    '',
    'プラチナプログラム運営事務局',
  ].join('\n'),

  '支払案内': [
    '件名：【重要】プラチナプログラム{{回}}回目のお支払いのお願い',
    '',
    '{{氏名}} 様',
    '',
    'お世話になっております。',
    'プラチナプログラム運営事務局です。',
    '',
    'プラチナプログラムのお支払いにつきまして',
    '{{回}}回目のお支払いは、【{{支払期日}}まで】です。',
    '',
    'お手続きのほど、どうぞよろしくお願いいたします。',
    '',
    '',
    '＝＝＝＝＝＝',
    '',
    '{{振込口座}}',
    '{{決済リンク}}',
    '',
    '＝＝＝＝＝＝',
    '',
    '',
    'ご案内は以上です。',
    '',
    'ご不明な点等ある場合は',
    '当メールの返信にてご連絡ください。',
    '',
    'プラチナプログラム事務局',
  ].join('\n'),
};

/* ============================================================
 * 小さな道具
 * ============================================================ */

/**
 * ドキュメントを開く。作成・コピーした直後は Google 側の準備が間に合わず開けないことがあるので、
 * 少し待って何度か開き直す。それでも駄目ならどのドキュメントか分かるエラーにする。
 */
function openDoc_(id, label) {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      return DocumentApp.openById(id);
    } catch (err) {
      lastErr = err;
      Utilities.sleep(1500 * (i + 1));
    }
  }
  let state = '';
  try {
    const f = DriveApp.getFileById(id);
    state = f.isTrashed() ? '（ゴミ箱に入っています）' : '（' + f.getName() + '）';
  } catch (e) {
    state = '（ドライブに見つかりません）';
  }
  throw new Error(label + 'を開けませんでした' + state + '：' + (lastErr && lastErr.message));
}

function getSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET.SETTINGS);
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0] !== '') map[String(r[0]).trim()] = r[1];
  });
  return map;
}

function setSetting_(key, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET.SETTINGS);
  const row = findSettingRow_(sh, key);
  if (row) sh.getRange(row, 2).setValue(value);
  else sh.appendRow([key, value, '']);
}

function findSettingRow_(sh, key) {
  if (sh.getLastRow() < 2) return 0;
  const keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) if (String(keys[i][0]).trim() === key) return i + 2;
  return 0;
}

function openTab_(url, tab) {
  if (!url) throw new Error('設定シートにURLが入っていません');
  const sh = SpreadsheetApp.openById(idFromUrl_(url)).getSheetByName(tab);
  if (!sh) throw new Error('タブ「' + tab + '」が見つかりません');
  return sh;
}

function lastDataRow_(sh, col) {
  const n = sh.getLastRow();
  if (n < 1) return 0;
  const v = sh.getRange(1, col, n, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') return i + 1;
  return 0;
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function ensureFolder_(id, name, parent) {
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 消えていたら作り直す */ }
  }
  return parent.createFolder(name);
}

function ensureSubFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function fileExists_(id) {
  try { return !DriveApp.getFileById(id).isTrashed(); } catch (e) { return false; }
}

function listRule_(items) {
  return SpreadsheetApp.newDataValidation().requireValueInList(items, true).setAllowInvalid(false).build();
}

function idFromUrl_(s) {
  const m = String(s || '').match(/\/d\/([-\w]{20,})/);
  return m ? m[1] : String(s || '').trim();
}

function normEmail_(s) {
  return String(s || '').replace(/^mailto:/i, '').trim().toLowerCase();
}

function normMethod_(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/併用/.test(t)) return '併用';
  if (/振込|振り込み|銀振|銀フリ|銀行/.test(t)) return '銀行振込';
  if (/paypal|ペイパル/i.test(t)) return 'PayPal';
  if (/square|スクエア/i.test(t)) return 'スクエア';
  if (/mosh|モッシュ/i.test(t)) return 'mosh';
  return t;
}

function toHalfWidth_(s) {
  return String(s).replace(/[０-９．，]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
}

/** 400000 / "400,000" / "40万" / "1,400,000円" → 数値。空なら null */
function parseAmount_(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  const s = toHalfWidth_(v).replace(/[,\s円¥￥]/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)万(\d*)$/);
  const n = m ? Math.round(parseFloat(m[1]) * 10000) + (m[2] ? Number(m[2]) : 0) : Number(s);
  if (isNaN(n)) throw new Error('金額が読み取れません：「' + v + '」');
  return n;
}

/** 「銀行振込 40万, PayPal 35万, PayPal 35万」→ [{method, amount}, ...] */
function parseMix_(text) {
  // 区切りは「,」「、」「＋」「改行」。ただし 350,000 のような桁区切りのカンマでは区切らない
  const items = toHalfWidth_(text || '').split(/[,、\n＋+](?!\d{3})/).map(function (x) { return x.trim(); }).filter(String);
  if (!items.length) throw new Error('支払方法が「併用」の時は「併用の内訳」を入れてください');
  return items.map(function (item) {
    const m = toHalfWidth_(item).match(/^(.*?)[\s:：]*(\d[\d,.]*万?\d*)\s*円?$/);
    if (!m || !m[1].trim()) throw new Error('併用の内訳が読み取れません：「' + item + '」');
    const method = normMethod_(m[1]);
    if (['銀行振込', 'PayPal', 'スクエア', 'mosh'].indexOf(method) < 0) throw new Error('併用の内訳の支払方法が分かりません：「' + item + '」');
    return { method: method, amount: parseAmount_(m[2]) };
  });
}

/** 1回目と2回目以降の金額を決める。割り切れない端数は1回目に足す */
function computeAmounts_(total, n, first, rest) {
  if (n === 1) return { first: total, rest: 0 };
  if (first != null && rest != null) {
    if (first + rest * (n - 1) !== total) {
      throw new Error('金額が合いません：1回目 ' + yen_(first) + '円 ＋ ' + yen_(rest) + '円×' + (n - 1) + '回 ≠ 総額 ' + yen_(total) + '円');
    }
    return { first: first, rest: rest };
  }
  if (rest != null) {
    const f = total - rest * (n - 1);
    if (f <= 0) throw new Error('2回目以降の金額が大きすぎます');
    return { first: f, rest: rest };
  }
  if (first != null) {
    if (first >= total) throw new Error('1回目の金額が総額以上です');
    const r = Math.floor((total - first) / (n - 1));
    return { first: total - r * (n - 1), rest: r };
  }
  const r = Math.floor(total / n);
  return { first: total - r * (n - 1), rest: r };
}

function buildSchedule_(due1, n, interval, first, rest) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ no: i + 1, date: addMonths_(due1, i * interval), amount: i === 0 ? first : rest });
  }
  return out;
}

/** 月を足す。月末を超える日は月末に寄せる（1/31 + 1か月 → 2/28） */
function addMonths_(d, k) {
  const y = d.getFullYear();
  const m = d.getMonth() + k;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}

function addDays_(d, k) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
}

function firstOfMonth_(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : startOfDay_(v);
  const m = toHalfWidth_(v == null ? '' : v).trim().match(/^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})日?/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** 更新の手続き期限の初期値：契約日の前日。もう過ぎていたら手入力してもらう */
function defaultRenewalDue_(contractDate) {
  const due = addDays_(contractDate, -1);
  if (due < startOfDay_(new Date())) {
    throw new Error('契約日の前日（' + Utilities.formatDate(due, TZ, 'yyyy/M/d') + '）はもう過ぎています。手続き期限を入力してください');
  }
  return due;
}

/** 覚書の日付の初期値：手続き期限の N 日前。それが今日より前なら今日 */
function defaultMemoDate_(due1, s) {
  const n = Number(s['覚書の日付_期限の何日前']);
  const d = addDays_(due1, -(isNaN(n) || s['覚書の日付_期限の何日前'] === '' || s['覚書の日付_期限の何日前'] == null ? 5 : n));
  const today = startOfDay_(new Date());
  return d < today ? today : d;
}

/** 6月26日（金） */
function mdw_(d) {
  return Utilities.formatDate(d, TZ, 'M月d日') + '（' + '日月火水木金土'.charAt(Number(Utilities.formatDate(d, TZ, 'u')) % 7) + '）';
}

function yen_(n) {
  return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 400000 → 「40万円」、端数があれば「412,345円」（suffix は「円」を付けるかどうか） */
function man_(n, suffix) {
  if (n % 10000 === 0) return (n / 10000) + '万' + suffix;
  return yen_(n) + (suffix || '円');
}

function paypalUrl_(s, amount) {
  return String(s['PayPalリンクの先頭'] || 'https://paypal.me/crozentokyo/').replace(/\/?$/, '/') + amount + 'jpy';
}
