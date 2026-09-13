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
