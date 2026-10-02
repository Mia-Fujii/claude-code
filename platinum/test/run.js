// Code.gs のうち Google のサービスを使わない部分を Node で確認するテスト
// 実行: TZ=Asia/Tokyo node platinum/test/run.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const pad = (n, w = 2) => String(n).padStart(w, '0');
const Utilities = {
  sleep() {},
  formatDate(d, tz, f) {
    const map = {
      yyyy: d.getFullYear(), yy: pad(d.getFullYear() % 100), MM: pad(d.getMonth() + 1), M: d.getMonth() + 1,
      dd: pad(d.getDate()), d: d.getDate(), HH: pad(d.getHours()), H: d.getHours(), mm: pad(d.getMinutes()),
      ss: pad(d.getSeconds()), u: d.getDay() === 0 ? 7 : d.getDay(),
    };
    return f.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|ss|u/g, (t) => String(map[t]));
  },
};
const ctx = { Utilities, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8') + '\n;this.IN = IN; this.MAIL_TEMPLATES = MAIL_TEMPLATES;', ctx);
const g = ctx;
const D = (y, m, d) => new Date(y, m - 1, d);
const fmt = (d) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
const S = { 'PayPalリンクの先頭': 'https://paypal.me/crozentokyo/', 'プログラム名_新規': 'プラチナプログラム', 'プログラム名_更新': 'プラチナ継続プログラム', '振込口座': '楽天銀行' };

function row(o) {
  const r = new Array(g.IN.MEMO_DATE).fill('');
  for (const k of Object.keys(o)) r[g.IN[k] - 1] = o[k];
  return r;
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

test('金額の読み取り', () => {
  assert.strictEqual(g.parseAmount_('40万'), 400000);
  assert.strictEqual(g.parseAmount_('1,400,000円'), 1400000);
  assert.strictEqual(g.parseAmount_('５５２，０００円'), 552000);
  assert.strictEqual(g.parseAmount_(46000), 46000);
  assert.strictEqual(g.parseAmount_(''), null);
});

test('支払方法の表記ゆれ', () => {
  assert.strictEqual(g.normMethod_('銀フリ'), '銀行振込');
  assert.strictEqual(g.normMethod_('paypal'), 'PayPal');
  assert.strictEqual(g.normMethod_('Square'), 'スクエア');
  assert.strictEqual(g.normEmail_('mailto:Foo@Example.com '), 'foo@example.com');
});

test('併用の内訳（桁区切りのカンマで区切らない）', () => {
  const p = g.parseMix_('銀行振込 40万, PayPal 350,000円、PayPal35万');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(p)), [
    { method: '銀行振込', amount: 400000 }, { method: 'PayPal', amount: 350000 }, { method: 'PayPal', amount: 350000 }]);
});

test('分割金額：割り切れる／端数は1回目／頭金指定', () => {
  assert.deepStrictEqual({ ...g.computeAmounts_(552000, 12, null, null) }, { first: 46000, rest: 46000 });
  assert.deepStrictEqual({ ...g.computeAmounts_(1000000, 3, null, null) }, { first: 333334, rest: 333333 });
  assert.deepStrictEqual({ ...g.computeAmounts_(1100000, 3, 300000, null) }, { first: 300000, rest: 400000 });
  assert.throws(() => g.computeAmounts_(100, 2, 30, 30), /金額が合いません/);
});

test('期日：月末寄せ・2分割は半年後', () => {
  assert.strictEqual(fmt(g.addMonths_(D(2026, 1, 31), 1)), '2026/2/28');
  const s = g.buildSchedule_(D(2026, 6, 23), 2, 6, 710000, 710000);
  assert.deepStrictEqual(Array.from(s, (p) => fmt(p.date)), ['2026/6/23', '2026/12/23']);
});

test('覚書サンプルと同じ：個別なし12分割（5/17〜翌4/17・46,000円）', () => {
  const c = g.buildContract_(row({ KUBUN: '更新', KOBETSU: 'なし', NAME: '神保麻紀', EMAIL: 'a@b.jp', CONTRACT: D(2026, 5, 11), DUE1: D(2026, 5, 17), COUNT: 12, METHOD: 'スクエア', TOTAL: 552000, LINK: 'https://square.link/u/VG9KPeoe' }), S, []);
  assert.strictEqual(fmt(c.endDate), '2027/5/10');
  assert.strictEqual(fmt(c.schedule[11].date), '2027/4/17');
  assert.ok(c.schedule.every((p) => p.amount === 46000));
  assert.strictEqual(g.describePayment_(c), '1回46,000円の12分割');
  assert.strictEqual(c.programName, 'プラチナ継続プログラム');
  assert.strictEqual(c.cardParts[0].link, 'https://square.link/u/VG9KPeoe');
});

test('契約満了＝1年後の前日', () => {
  const c = g.buildContract_(row({ KUBUN: '新規', KOBETSU: 'あり', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2025, 11, 1), DUE1: D(2025, 11, 7), COUNT: 1, METHOD: '銀行振込', TOTAL: 1400000 }), S, []);
  assert.strictEqual(fmt(c.endDate), '2026/10/31');
  assert.strictEqual(c.bankAmount, 1400000);
  assert.strictEqual(g.describePayment_(c), '銀行振込の一括払い');
});

test('併用：銀行振込40万＋カード35万×2枚', () => {
  const c = g.buildContract_(row({ KUBUN: '更新', KOBETSU: 'あり', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2026, 3, 20), DUE1: D(2026, 3, 24), COUNT: 1, METHOD: '併用', MIX: '銀行振込 40万, PayPal 35万, PayPal 35万' }), S, []);
  assert.strictEqual(c.total, 1100000);
  assert.strictEqual(c.bankAmount, 400000);
  assert.strictEqual(g.describePayment_(c), '銀行振込40万円＋クレジットカード35万円×2枚の一括払い');
  assert.strictEqual(c.methodLabel, '銀行振込40万＋PayPal35万＋PayPal35万');
  assert.strictEqual(g.linkBlock_(c.cardParts), '1枚目クレジットカード（35万円）\nhttps://paypal.me/crozentokyo/350000jpy\n\n2枚目クレジットカード（35万円）\nhttps://paypal.me/crozentokyo/350000jpy');
});

test('PayPal 2分割：リンク自動・分割補足', () => {
  const c = g.buildContract_(row({ KUBUN: '更新', KOBETSU: 'あり', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2026, 10, 10), DUE1: D(2026, 10, 17), COUNT: 2, METHOD: 'PayPal', TOTAL: 1120000 }), S, []);
  assert.strictEqual(c.cardParts[0].link, 'https://paypal.me/crozentokyo/560000jpy');
  assert.strictEqual(c.interval, 6);
  assert.strictEqual(fmt(c.schedule[1].date), '2027/4/17');
  const v = g.contractMailVars_(c, { ...S, 'フォーム_個別あり_分割': 'F' });
  assert.strictEqual(v['分割補足'], '※2回目のお支払いは半年後となります');
  assert.strictEqual(v['期限'], '10月17日（土）');
});

test('料金マスタから総額を補う', () => {
  const price = [{ kubun: '更新', kobetsu: 'なし', n: 12, method: 'スクエア', total: 552000, first: 46000, rest: 46000, link: 'L' }];
  const c = g.buildContract_(row({ KUBUN: '更新', KOBETSU: 'なし', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2026, 5, 11), DUE1: D(2026, 5, 17), COUNT: 12, METHOD: 'スクエア' }), S, price);
  assert.strictEqual(c.total, 552000);
  assert.strictEqual(c.cardParts[0].link, 'L');
});

test('入力不足はまとめてエラー', () => {
  assert.throws(() => g.buildContract_(row({ KUBUN: '新規' }), S, []), /個別コンサル、氏名、メールアドレス、契約日、手続き期限、支払回数、支払方法/);
});

test('テンプレ：件名の取り出し・空の目印行は消す・知らない目印は残す', () => {
  const t = g.parseTemplateText_('件名：【重要】{{氏名}}様\n\n{{氏名}}様\n\n{{振込口座}}\n{{決済リンク}}\n{{謎}}\n');
  assert.strictEqual(t.subject, '【重要】{{氏名}}様');
  const out = g.renderTemplate_(t.body, { '氏名': '山田', '振込口座': '', '決済リンク': 'L' });
  assert.strictEqual(out, '山田様\n\nL\n{{謎}}\n');
});

test('全メールテンプレに未知の目印がない', () => {
  const S2 = { ...S, 'フォーム_個別あり_一括': 'F', 'フォーム_個別あり_分割': 'F', 'フォーム_個別なし_一括': 'F', 'フォーム_個別なし_分割': 'F' };
  const c = g.buildContract_(row({ KUBUN: '新規', KOBETSU: 'あり', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2026, 6, 1), DUE1: D(2026, 6, 26), COUNT: 36, METHOD: 'mosh', TOTAL: 1548000, LINK: 'https://mosh.jp/x' }), S2, []);
  const v = g.contractMailVars_(c, S2);
  for (const k of ['新規_一括', '新規_分割', '更新_一括', '更新_分割']) {
    const t = g.parseTemplateText_(g.MAIL_TEMPLATES[k]);
    const body = g.renderTemplate_(t.body, v);
    assert.ok(!/\{\{/.test(body), k + ' に未置換の目印: ' + body.match(/\{\{[^}]+\}\}/));
    assert.ok(t.subject.startsWith('【重要】'));
  }
  const nb = g.renderTemplate_(g.parseTemplateText_(g.MAIL_TEMPLATES['新規_分割']).body, v);
  assert.ok(nb.includes('クレジットカード36分割（43,000円 × 36回）'));
  assert.ok(nb.includes('【6月26日（金）】までに'));
  const r = g.parseTemplateText_(g.MAIL_TEMPLATES['支払案内']);
  const rb = g.renderTemplate_(r.body, { '氏名': 'x', '回': '2', '支払期日': '9月2日（水）', '支払金額': '710,000円', '振込口座': g.bankBlock_(S, 710000), '決済リンク': '' });
  assert.ok(!/\{\{/.test(rb) && rb.includes('ご入金額：710,000円（税込）'));
});

test('更新で契約日が空欄：メンバーリストの契約満了日の翌日', () => {
  const data = [
    ['', 'メールリスト', '氏名', 'メールアドレス', '備考', '個別', '契約日', '契約満了'],
    [1, 'プラチナメンバー', '中村沙樹', 'musicspice7777@gmail.com', '', '', D(2026, 9, 1), D(2027, 8, 31)],
    [2, 'プラチナメンバー', 'x', 'mailto:Foo@Example.com', '', '', D(2025, 11, 1), '2026/10/31'],
  ];
  const orig = g.openTab_;
  g.openTab_ = () => ({ getDataRange: () => ({ getValues: () => data }) });
  try {
    assert.strictEqual(fmt(g.nextDayAfterPreviousEnd_('musicspice7777@gmail.com', {})), '2027/9/1');
    assert.strictEqual(fmt(g.nextDayAfterPreviousEnd_('foo@example.com', {})), '2026/11/1');
    assert.throws(() => g.nextDayAfterPreviousEnd_('none@example.com', {}), /メンバーリストにこのメールアドレスの方がいません/);
  } finally { g.openTab_ = orig; }
});

test('覚書の日付：入力優先／空欄は期限の5日前／過ぎていれば今日', () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const far = new Date(today.getFullYear() + 1, 9, 31);
  const base = { KUBUN: '更新', KOBETSU: 'なし', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: new Date(far.getFullYear(), 10, 1), DUE1: far, COUNT: 12, METHOD: 'スクエア', TOTAL: 552000 };
  assert.strictEqual(fmt(g.buildContract_(row(base), S, []).memoDate), `${far.getFullYear()}/10/26`);
  assert.strictEqual(fmt(g.buildContract_(row(base), { ...S, '覚書の日付_期限の何日前': 7 }, []).memoDate), `${far.getFullYear()}/10/24`);
  assert.strictEqual(fmt(g.buildContract_(row({ ...base, MEMO_DATE: D(2026, 10, 20) }), S, []).memoDate), '2026/10/20');
  const soon = g.addDays_(today, 2);
  assert.strictEqual(fmt(g.buildContract_(row({ ...base, DUE1: soon }), S, []).memoDate), fmt(today));
});

test('更新の手続き期限：契約日の前日／過ぎていればエラー', () => {
  const y = new Date().getFullYear() + 1;
  assert.strictEqual(fmt(g.defaultRenewalDue_(D(y, 11, 1))), `${y}/10/31`);
  assert.throws(() => g.defaultRenewalDue_(D(2020, 11, 1)), /2020\/10\/31）はもう過ぎています/);
});

test('総額が空欄：1回の金額×回数で計算', () => {
  const base = { KUBUN: '更新', KOBETSU: 'なし', NAME: 'x', EMAIL: 'a@b.jp', CONTRACT: D(2026, 11, 1), DUE1: D(2026, 10, 31), COUNT: 12, METHOD: 'スクエア' };
  const c = g.buildContract_(row({ ...base, REST: 46000 }), S, []);
  assert.strictEqual(c.total, 552000);
  assert.ok(c.schedule.every((p) => p.amount === 46000));
  const h = g.buildContract_(row({ ...base, COUNT: 3, FIRST: 300000, REST: 400000 }), S, []);
  assert.strictEqual(h.total, 1100000);
  assert.strictEqual(g.buildContract_(row({ ...base, COUNT: 1, FIRST: 1100000 }), S, []).total, 1100000);
  assert.strictEqual(g.buildContract_(row({ ...base, FIRST: 46000 }), S, []).total, 552000);
  assert.strictEqual(g.buildContract_(row({ ...base, FIRST: '46,000円' }), S, []).rest, 46000);
  assert.throws(() => g.buildContract_(row(base), S, []), /金額が入っていません/);
});

test('覚書の雛形：全行が書き込まれ、閉じた後に触らない', () => {
  const paras = [];
  let closed = false;
  let font = null;
  const mkPara = (text) => {
    const p = { text, list: false, setText(x) { if (closed) throw new Error('closed'); this.text = x; }, // 本物と同じく何も返さない
      setHeading() { return this; }, setAlignment(a) { this.align = a; return this; },
      setGlyphType() { return this; }, setListId() { return this; }, setSpacingBefore() { return this; }, setSpacingAfter() { return this; },
      editAsText() { const e = { setBold: () => e, setFontSize: () => e }; return e; } };
    paras.push(p); return p;
  };
  mkPara('');
  const doc = {
    getId() { if (closed) throw new Error('Document is closed'); return 'DOC1'; },
    getBody: () => ({ editAsText: () => ({ setFontFamily: (f) => { font = f; } }), getParagraphs: () => paras, appendParagraph: (x) => { if (closed) throw new Error('closed'); return mkPara(x); },
      appendListItem: (x) => { if (closed) throw new Error('closed'); const p = mkPara(x); p.list = true; return p; } }),
    saveAndClose() { closed = true; },
  };
  let moved = null;
  g.DocumentApp = { create: () => doc, ParagraphHeading: { NORMAL: 'N' }, GlyphType: { NUMBER: 'NUM' }, HorizontalAlignment: { CENTER: 'C', RIGHT: 'R', LEFT: 'L', JUSTIFY: 'J' } };
  g.DriveApp = { getFileById: (id) => ({ moveTo: (f) => { moved = [id, f]; } }) };
  const id = g.createMemoTemplate_('雛形', 'FOLDER');
  assert.strictEqual(id, 'DOC1');
  assert.deepStrictEqual(moved, ['DOC1', 'FOLDER']);
  const text = paras.map((p) => p.text).join('\n');
  assert.ok(text.startsWith('費用に関する覚書\n'));
  for (const k of ['{{氏名}}', '{{支払明細}}', '{{作成日}}', '甲が乙に対して', 'ヴォンドラ高橋若菜']) assert.ok(text.includes(k), k);
  assert.ok(!text.includes('乙が甲に対して') && !text.includes('髙橋'));
  const align = (s) => paras.find((p) => p.text === s).align;
  assert.strictEqual(font, 'Noto Serif JP');
  assert.strictEqual(align('費用に関する覚書'), 'C');
  assert.strictEqual(align('記'), 'C');
  assert.strictEqual(align('{{支払明細}}'), 'C');
  assert.strictEqual(align('以上'), 'R');
  assert.strictEqual(align('{{作成日}}'), 'R');
  assert.strictEqual(align('甲　住所'), 'L');
  assert.deepStrictEqual(paras.filter((p) => p.list).map((p) => p.text.slice(0, 5)), ['甲が乙に対', '分割払いの']);
});

test('メールのHTML：URLはリンク、改行は<br>、記号はエスケープ', () => {
  const h = g.textToHtml_('決済リンクはこちら＞＞\nhttps://paypal.me/crozentokyo/350000jpy\n\nフォーム（https://forms.gle/abc）です。<注意> & 1,000円\nhttps://mosh.jp/services/f78?openExternalBrowser=1.');
  assert.ok(h.includes('<a href="https://paypal.me/crozentokyo/350000jpy">https://paypal.me/crozentokyo/350000jpy</a>'));
  assert.ok(h.includes('（<a href="https://forms.gle/abc">https://forms.gle/abc</a>）です。'));
  assert.ok(h.includes('<a href="https://mosh.jp/services/f78?openExternalBrowser=1">https://mosh.jp/services/f78?openExternalBrowser=1</a>.'));
  assert.ok(h.includes('&lt;注意&gt; &amp; 1,000円'));
  assert.ok(h.includes('＞＞<br>\n<a') && h.includes('jpy</a><br>\n<br>\n'));
});

test('ドキュメントを開く：失敗しても開き直す／駄目ならどれか分かるエラー', () => {
  let n = 0;
  g.DocumentApp = { openById: () => { if (++n < 3) throw new Error('missing'); return 'DOC'; } };
  assert.strictEqual(g.openDoc_('X', '覚書の雛形'), 'DOC');
  assert.strictEqual(n, 3);
  g.DocumentApp = { openById: () => { throw new Error('missing'); } };
  g.DriveApp = { getFileById: () => ({ isTrashed: () => true }) };
  assert.throws(() => g.openDoc_('X', 'メールテンプレート「メール_更新_分割」'), /メールテンプレート「メール_更新_分割」を開けませんでした（ゴミ箱に入っています）/);
});

test('税理士シートの決済日：メールと契約日が一致する行に入れる', () => {
  const inputRow = row({ ID: 'P1', CONTRACT: D(2026, 10, 17) });
  g.SpreadsheetApp = { getActive: () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: () => ({ getValues: () => [inputRow] }) }) }) };
  const data = [
    ['', '氏名', 'メール', '契約日'],
    ['', '衣笠あけみ', 'melodyranran810@gmail.com', D(2025, 10, 17)],
    ['', '衣笠あけみ', 'melodyranran810@gmail.com', D(2026, 10, 17)],
    ['', '別の人', 'x@y.jp', D(2026, 10, 17)],
  ];
  const writes = [];
  const orig = g.openTab_;
  g.openTab_ = () => ({ getDataRange: () => ({ getValues: () => data }),
    getRange: (r, c) => ({ setValue: (v) => { writes.push([r, c, fmt(v)]); return { setNumberFormat: () => {} }; } }) });
  try {
    assert.strictEqual(g.updateTaxPaymentDate_('P1', 'melodyranran810@gmail.com', D(2026, 10, 15), {}), true);
    assert.deepStrictEqual(writes, [[3, 8, '2026/10/15']]);
    assert.strictEqual(g.updateTaxPaymentDate_('P1', 'none@x.jp', D(2026, 10, 15), {}), false);
  } finally { g.openTab_ = orig; }
});

test('グレー判定：手塗りのグレーだけ', () => {
  for (const c of ['#cccccc', '#D9D9D9', '#b7b7b7', '#999999', '#efefef']) assert.ok(g.isGrey_(c), c);
  for (const c of ['#ffffff', '#000000', '#ffff00', '#00ff00', '', null]) assert.ok(!g.isGrey_(c), String(c));
});

// 簡易スプレッドシート（values と背景色だけ持つ）
function fakeSheet(values) {
  const W = 26;
  const grid = values.map((r) => { const a = r.slice(); while (a.length < W) a.push(''); return a; });
  const bg = grid.map(() => new Array(W).fill(null));
  let maxRows = Math.max(grid.length, 60);
  const ensure = (r) => { while (grid.length < r) { grid.push(new Array(W).fill('')); bg.push(new Array(W).fill(null)); } };
  const sh = {
    grid, bg,
    getDataRange: () => ({ getValues: () => grid.map((r) => r.slice()) }),
    getLastRow: () => { for (let i = grid.length - 1; i >= 0; i--) if (grid[i].some((v) => v !== '')) return i + 1; return 0; },
    getMaxRows: () => maxRows, getMaxColumns: () => W,
    insertRowsAfter: (a, n) => { maxRows += n; }, insertColumnsAfter: () => {},
    deleteRow: (r) => { grid.splice(r - 1, 1); bg.splice(r - 1, 1); },
    getRange: (r, c, nr = 1, nc = 1) => {
      ensure(r + nr - 1);
      return {
        getValues: () => grid.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
        setValues: (v) => { v.forEach((row, i) => row.forEach((x, j) => { grid[r - 1 + i][c - 1 + j] = x; })); },
        setNumberFormat: () => {},
        setBackground: (col) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) bg[r - 1 + i][c - 1 + j] = col; },
        copyTo: (dest, opt) => { /* formatOnly: 背景をコピー */ },
        getFormula: () => '',
      };
    },
  };
  return sh;
}

test('メンバーリスト：更新は元の行を消して一番下へ、過去期間をI列へ、個別なしはオレンジ', () => {
  const sh = fakeSheet([
    ['', 'メールリスト', '氏名', 'メールアドレス', '備考', '個別', '契約日', '契約満了', '終了分'],
    [1, 'プラチナメンバー', 'A', 'a@x.jp', '', '', D(2025, 11, 1), D(2026, 10, 31)],
    [45, 'プラチナメンバー', '衣笠あけみ', 'melodyranran810@gmail.com', 'メモ', '2025年11月〜', D(2025, 10, 17), D(2026, 10, 16)],
    [3, 'プラチナメンバー', 'B', 'b@x.jp', '', '', D(2026, 2, 1), D(2027, 1, 31), D(2025, 2, 1), D(2026, 1, 31)],
  ]);
  const orig = g.openTab_;
  g.openTab_ = () => sh;
  try {
    const c = g.buildContract_(row({ KUBUN: '更新', KOBETSU: 'なし', NAME: '衣笠あけみ', EMAIL: 'Melodyranran810@gmail.com ', CONTRACT: D(2026, 10, 17), DUE1: D(2026, 10, 16), COUNT: 12, METHOD: 'スクエア', REST: 46000 }), S, []);
    const m = g.updateMemberList_(c, { 'メールリスト名_個別あり': 'プラチナメンバー', 'メールリスト名_個別なし': 'プラチナ（個別なし）' });
    const rows = sh.grid.filter((r) => r[2] !== '');
    assert.deepStrictEqual(rows.map((r) => r[2]), ['氏名', 'A', 'B', '衣笠あけみ']);
    const k = rows[3];
    assert.deepStrictEqual([k[0], k[1], k[4], k[5]], [3, 'プラチナ（個別なし）', 'メモ', 'ー']);
    assert.deepStrictEqual(k.slice(6, 10).map(fmt), ['2026/10/17', '2027/10/16', '2025/10/17', '2026/10/16']);
    assert.deepStrictEqual(rows.slice(1).map((r) => r[0]), [1, 2, 3]);
    assert.strictEqual(sh.bg[3][1], '#fce5cd');
    assert.strictEqual(sh.bg[3][2], null);
    assert.ok(m.note.includes('元の3行目を削除') && m.note.includes('4行目'), m.note);
  } finally { g.openTab_ = orig; }
});

console.log(`\n${passed} tests passed`);
