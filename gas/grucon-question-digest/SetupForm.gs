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
