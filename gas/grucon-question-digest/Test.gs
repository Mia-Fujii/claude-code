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
