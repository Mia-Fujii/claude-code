/**
 * Googleドキュメントにマニュアルを作成する
 * GASエディタで一度だけ手動実行してください
 * 実行後、Googleドライブのマイドライブに「Gmail_Slack_AI返信_セットアップマニュアル」が作成されます
 */
function createManualDoc() {
  const doc = DocumentApp.create('Gmail_Slack_AI返信_セットアップマニュアル');
  const body = doc.getBody();

  body.clear();

  // タイトル
  const title = body.appendParagraph('Gmail → Slack AI返信下書き セットアップマニュアル');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);

  // 概要
  body.appendParagraph('概要').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(
    'クライアントの重要メール（請求書・契約書など）をSlackに通知し、ボタン一つでAIが返信文を生成→編集→Gmailに下書き保存できるシステムです。'
  );
  body.appendParagraph('【フロー】').setBold(true);
  body.appendParagraph(
    'Gmail（未読メール）→ GAS（5分ごと自動チェック）→ Slack通知（件名・本文・ボタン）\n→「AI返信下書き作成」ボタンを押す → Slackモーダルで返信文を編集\n→「Gmailに下書き保存」→ Gmail下書きに保存（引用返信＋署名付き）'
  );

  // 必要なもの
  body.appendParagraph('必要なもの').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  ['クライアントのGoogleアカウント（GAS作成・Gmail操作に使用）',
   'Slackワークスペースの管理者権限',
   'Google AI Studio APIキー（Gemini）'
  ].forEach(item => body.appendListItem(item));

  addSeparator(body);

  // STEP 1
  body.appendParagraph('STEP 1：Gemini APIキーを取得する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('※ 1クライアント目で取得済みの場合は同じキーを使い回してOK');
  ['https://aistudio.google.com/app/apikey を開く',
   '初回は利用規約に同意（上のチェックボックスのみ必須）',
   '「新しいAPIキーを作成」→「新しいプロジェクトでAPIキーを作成」を選択',
   '生成されたキーをコピーして保存'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // STEP 2
  body.appendParagraph('STEP 2：Slack Appを作成する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('※ クライアントごとに別のSlack Appが必要（Interactivity URLが1つしか設定できないため）');

  ['https://api.slack.com/apps を開く',
   '「Create New App」→「From scratch」',
   'App Name: 「Gmail通知Bot_クライアント名」など',
   'ワークスペースを選択 → 「Create App」'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  body.appendParagraph('Bot Token Scopesを設定').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('左メニュー「OAuth & Permissions」→「Bot Token Scopes」に以下を追加：');
  ['chat:write（メッセージ送信）', 'chat:write.public（パブリックチャンネルへの送信）', 'im:write（モーダル表示）']
    .forEach(item => body.appendListItem(item));

  body.appendParagraph('ワークスペースにインストール').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('「Install to Workspace」→「許可する」\n→ Bot User OAuth Token（xoxb-...）をコピーして保存');

  body.appendParagraph('通知先チャンネルのIDを確認').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Slackで通知先チャンネルを右クリック →「チャンネル詳細を表示」\n→ 一番下に表示される C0XXXXXXXXX 形式のIDをコピーして保存');

  body.appendParagraph('BotをチャンネルにInvite').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('通知先チャンネルで以下を入力して送信：\n/invite @App名');

  addSeparator(body);

  // STEP 3
  body.appendParagraph('STEP 3：GASプロジェクトを作成する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('⚠ クライアントのGoogleアカウントでログインして作業すること').setBold(true);
  ['https://script.google.com を開く',
   '「新しいプロジェクト」をクリック',
   'プロジェクト名を入力（例：Gmail_Slack通知_クライアント名）',
   'エディタの「コード.gs」を全選択して削除',
   '下記URLのコードを「Raw」ボタンで開いてコピー → 貼り付け\nhttps://github.com/Mia-Fujii/claude-code/blob/claude/discord-slack-gmail-integration-PPVT9/gas/Code.gs'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // STEP 4
  body.appendParagraph('STEP 4：スクリプトプロパティを設定する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('GASエディタ → 左側の歯車アイコン（プロジェクトの設定）→ 下にスクロール →「スクリプトプロパティを追加」');
  body.appendParagraph('以下を1行ずつ追加して最後に「スクリプトプロパティを保存」：');

  const table = body.appendTable([
    ['プロパティ名', '値', '例'],
    ['SLACK_BOT_TOKEN', 'STEP2で取得したBot Token', 'xoxb-...'],
    ['SLACK_CHANNEL_ID', '通知先チャンネルID', 'C0XXXXXXXXX'],
    ['GEMINI_API_KEY', 'STEP1で取得したAPIキー', 'AIza...'],
    ['KEYWORDS', '検索キーワード（カンマ区切り）', '請求書,契約書,顧問料'],
    ['SIGNATURE', 'メール署名', '株式会社〇〇事務局'],
    ['SENDER_NAME', '返信冒頭の名乗り', '〇〇事務局'],
  ]);
  // ヘッダー行を太字に
  const headerRow = table.getRow(0);
  for (let i = 0; i < headerRow.getNumCells(); i++) {
    headerRow.getCell(i).getChild(0).asParagraph().editAsText().setBold(true);
  }

  addSeparator(body);

  // STEP 5
  body.appendParagraph('STEP 5：ウェブアプリとしてデプロイする').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  ['GASエディタ右上「デプロイ」→「新しいデプロイ」',
   '左上の歯車アイコン →「ウェブアプリ」を選択',
   '次のユーザーとして実行：「自分（〇〇@gmail.com）」',
   'アクセスできるユーザー：「全員」',
   '「デプロイ」をクリック',
   'Googleアカウントの権限許可画面が出たら「アクセスを許可」',
   '表示されたウェブアプリのURLをコピーして保存'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // STEP 6
  body.appendParagraph('STEP 6：SlackにInteractivity URLを設定する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  ['https://api.slack.com/apps でSTEP2で作ったAppを開く',
   '左メニュー「Interactivity & Shortcuts」',
   'Interactivity をオンにする',
   'Request URL にSTEP5でコピーしたURLを貼り付け',
   '「Save Changes」をクリック'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // STEP 7
  body.appendParagraph('STEP 7：タイマートリガーを設定する').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  ['GASエディタ上部の関数選択ドロップダウンを「setupTrigger」に変更',
   '▶ 実行 をクリック',
   '権限許可が出たら「アクセスを許可」',
   '実行ログに「✅ タイマートリガーを設定しました（5分ごと）」が出ればOK'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // STEP 8
  body.appendParagraph('STEP 8：動作確認').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  ['件名にキーワード（例：請求書）を含むメールをクライアントのGmail宛に送信',
   '5分以内にSlackの指定チャンネルに通知が届く',
   '「AI返信下書き作成」ボタンを押す',
   'しばらくするとモーダルが開いて返信文が表示される',
   '編集して「Gmailに下書き保存」を押す',
   'Gmailの下書きフォルダに保存されていることを確認'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  body.appendParagraph('通知が来ない場合').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('GASエディタで checkAndNotify を手動実行 → ログを確認\n既に処理済みの場合はスクリプトプロパティの PROCESSED_IDS を [] に書き換えて再実行');

  addSeparator(body);

  // コード変更時
  body.appendParagraph('コードを変更したときのデプロイ更新方法').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('⚠ コードを変更した場合、必ず新しいデプロイが必要です（「デプロイを管理」ではなく「新しいデプロイ」）').setBold(true);
  ['「デプロイ」→「新しいデプロイ」',
   '新しいURLをコピー',
   'SlackのInteractivity URLを新しいURLに更新'
  ].forEach((item, i) => body.appendListItem(`${i + 1}. ${item}`).setGlyphType(DocumentApp.GlyphType.NUMBER));

  addSeparator(body);

  // トラブルシューティング
  body.appendParagraph('トラブルシューティング').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const troubleTable = body.appendTable([
    ['症状', '原因', '対処'],
    ['Slackに通知が来ない', 'メールが既読 / PROCESSED_IDSに登録済み', 'PROCESSED_IDSを[]にリセットして手動実行'],
    ['channel_not_found', 'BotがチャンネルにInviteされていない', '/invite @Bot名 をチャンネルで実行'],
    ['ボタンを押しても何も起きない', 'デプロイが古い / Interactivity URLが古い', '新しいデプロイ → URLを更新'],
    ['⏳生成中...のまま止まる', 'デプロイが古い', '新しいデプロイ → URLを更新'],
    ['AI生成が失敗する', 'GEMINI_API_KEYが間違い / 課金未設定', 'キーを確認 / Google Cloudで課金を有効化'],
    ['Bot Tokenエラー', '再インストール後にTokenが変わった', 'SLACK_BOT_TOKENを新しいTokenに更新'],
  ]);
  const troubleHeader = troubleTable.getRow(0);
  for (let i = 0; i < troubleHeader.getNumCells(); i++) {
    troubleHeader.getCell(i).getChild(0).asParagraph().editAsText().setBold(true);
  }

  addSeparator(body);

  // クライアント設定一覧
  body.appendParagraph('クライアントごとの設定一覧').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const clientTable = body.appendTable([
    ['プロパティ', 'Dears', 'Lsurii'],
    ['KEYWORDS', '請求書,契約書,顧問料', '契約書,請求書,顧問料,広告費'],
    ['SIGNATURE', '株式会社Dears事務局', '株式会社Lsurii事務局'],
    ['SENDER_NAME', 'Dears事務局', 'Lsurii事務局'],
  ]);
  const clientHeader = clientTable.getRow(0);
  for (let i = 0; i < clientHeader.getNumCells(); i++) {
    clientHeader.getCell(i).getChild(0).asParagraph().editAsText().setBold(true);
  }

  doc.saveAndClose();
  console.log(`✅ ドキュメントを作成しました: ${doc.getUrl()}`);
}

function addSeparator(body) {
  body.appendParagraph('');
}
