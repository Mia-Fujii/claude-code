// ============================================================
// 設定（スクリプトプロパティに保存してください）
// ============================================================
// SLACK_BOT_TOKEN       : Slack Bot Token (xoxb-...)
// SLACK_CHANNEL_ID      : 通知先チャンネルID
// CLAUDE_API_KEY        : Anthropic API Key
// PROCESSED_IDS_KEY     : 処理済みメールID保存用（変更不要）
//
// スクリプトプロパティの設定方法:
// GASエディタ → プロジェクトの設定 → スクリプトプロパティ
// ============================================================

const PROPS = PropertiesService.getScriptProperties();

// 重要メールの検出キーワード（件名に含まれる場合に通知）
const KEYWORDS = [
  '請求書', '請求', 'invoice', 'Invoice',
  '契約書', '契約', 'contract', 'Contract',
  '見積書', '見積', 'quotation', 'Quotation',
  '発注書', '発注', 'order', 'Order',
  '領収書', '領収', 'receipt', 'Receipt',
];

// ============================================================
// 1. Gmail監視（タイマートリガーで定期実行）
// ============================================================

/**
 * メインの監視関数
 * GASのタイマートリガーで5〜10分ごとに実行してください
 */
function checkImportantEmails() {
  const query = buildGmailQuery();
  const threads = GmailApp.search(query, 0, 20);

  const processedIds = getProcessedIds();
  const newProcessedIds = [...processedIds];

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      const messageId = message.getId();
      if (processedIds.includes(messageId)) continue;

      const subject = message.getSubject();
      if (!isImportantEmail(subject)) continue;

      const emailData = extractEmailData(message);
      sendSlackNotification(emailData);

      newProcessedIds.push(messageId);
    }
  }

  // 処理済みIDを保存（最新500件まで保持）
  saveProcessedIds(newProcessedIds.slice(-500));
}

/**
 * Gmail検索クエリ生成（未読 + キーワード）
 */
function buildGmailQuery() {
  const keywordQuery = KEYWORDS.map(k => `subject:"${k}"`).join(' OR ');
  return `is:unread (${keywordQuery})`;
}

/**
 * 件名に重要キーワードが含まれるか判定
 */
function isImportantEmail(subject) {
  return KEYWORDS.some(keyword =>
    subject.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * メールデータを抽出
 */
function extractEmailData(message) {
  const body = message.getPlainBody();
  return {
    id: message.getId(),
    threadId: message.getThread().getId(),
    subject: message.getSubject(),
    from: message.getFrom(),
    date: Utilities.formatDate(message.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
    body: body.substring(0, 2000), // 最初の2000文字
    permalink: `https://mail.google.com/mail/u/0/#inbox/${message.getThread().getId()}`,
  };
}

// ============================================================
// 2. Slack通知送信（ボタン付き）
// ============================================================

/**
 * Slackにインタラクティブ通知を送信
 */
function sendSlackNotification(emailData) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');
  const channel = PROPS.getProperty('SLACK_CHANNEL_ID');

  if (!token || !channel) {
    Logger.log('ERROR: SLACK_BOT_TOKEN または SLACK_CHANNEL_ID が未設定です');
    return;
  }

  const payload = {
    channel: channel,
    text: `📧 重要メール: ${emailData.subject}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📧 重要メール通知',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*件名:*\n${emailData.subject}` },
          { type: 'mrkdwn', text: `*送信者:*\n${emailData.from}` },
          { type: 'mrkdwn', text: `*日時:*\n${emailData.date}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*本文（抜粋）:*\n\`\`\`${emailData.body.substring(0, 500)}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🤖 AI返信下書き作成', emoji: true },
            style: 'primary',
            action_id: 'create_draft',
            value: JSON.stringify({
              messageId: emailData.id,
              subject: emailData.subject,
              from: emailData.from,
            }),
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '📬 Gmailで開く', emoji: true },
            url: emailData.permalink,
            action_id: 'open_gmail',
          },
        ],
      },
    ],
  };

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (!result.ok) {
    Logger.log(`Slack送信エラー: ${result.error}`);
  }
}

// ============================================================
// 3. Slackインタラクション受信 (doPost)
// ============================================================

/**
 * SlackのインタラクティブペイロードをGAS Webアプリとして受信
 * GASをウェブアプリとしてデプロイし、そのURLをSlackのInteractivity URLに設定
 */
function doPost(e) {
  try {
    // Slackはapplication/x-www-form-urlencodedで送信
    const rawPayload = e.parameter.payload;
    if (!rawPayload) {
      return ContentService.createTextOutput('OK');
    }

    const payload = JSON.parse(rawPayload);

    // 3秒以内にレスポンスを返す（Slackのタイムアウト対策）
    // 実際の処理は非同期で行う
    if (payload.type === 'block_actions') {
      handleBlockAction(payload);
    }

    return ContentService.createTextOutput('OK');
  } catch (error) {
    Logger.log(`doPostエラー: ${error.toString()}`);
    return ContentService.createTextOutput('Error');
  }
}

/**
 * Slackボタンアクション処理
 */
function handleBlockAction(payload) {
  const action = payload.actions[0];
  const responseUrl = payload.response_url;

  if (action.action_id !== 'create_draft') return;

  // Slackに「処理中」を即時返信
  notifySlackProcessing(responseUrl, action.value);

  // メール情報取得
  const actionData = JSON.parse(action.value);
  const messageId = actionData.messageId;

  // Gmailからメール本文を再取得（フル版）
  let emailBody = '';
  let emailSubject = actionData.subject;
  let emailFrom = actionData.from;
  try {
    const message = GmailApp.getMessageById(messageId);
    emailBody = message.getPlainBody();
    emailSubject = message.getSubject();
    emailFrom = message.getFrom();
  } catch (err) {
    Logger.log(`メール取得エラー: ${err.toString()}`);
    notifySlackError(responseUrl, 'メールの取得に失敗しました');
    return;
  }

  // Claude APIで返信文生成
  const draftBody = generateReplyWithClaude(emailSubject, emailFrom, emailBody);
  if (!draftBody) {
    notifySlackError(responseUrl, 'AI返信の生成に失敗しました');
    return;
  }

  // Gmail下書き作成
  const replyTo = emailFrom.match(/<(.+)>/)?.[1] || emailFrom;
  const draftSubject = emailSubject.startsWith('Re:') ? emailSubject : `Re: ${emailSubject}`;

  try {
    GmailApp.createDraft(replyTo, draftSubject, draftBody);
  } catch (err) {
    Logger.log(`下書き作成エラー: ${err.toString()}`);
    notifySlackError(responseUrl, 'Gmail下書きの作成に失敗しました');
    return;
  }

  // Slackに完了通知（下書き内容プレビュー付き）
  notifySlackDraftCreated(responseUrl, draftSubject, draftBody, replyTo);
}

// ============================================================
// 4. Claude API呼び出し
// ============================================================

/**
 * Claude APIを使って返信文を生成
 */
function generateReplyWithClaude(subject, from, body) {
  const apiKey = PROPS.getProperty('CLAUDE_API_KEY');
  if (!apiKey) {
    Logger.log('ERROR: CLAUDE_API_KEY が未設定です');
    return null;
  }

  const prompt = `以下のメールに対する返信下書きを日本語で作成してください。

【件名】${subject}
【送信者】${from}
【本文】
${body}

---

返信の要件:
- 丁寧なビジネスメール形式
- 受領確認を含める
- 必要に応じて確認事項や次のステップを記載
- 署名は「[お名前]」というプレースホルダーにする
- 返信本文のみを出力（説明文不要）`;

  const requestPayload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      payload: JSON.stringify(requestPayload),
      muteHttpExceptions: true,
    });

    const result = JSON.parse(response.getContentText());
    if (result.error) {
      Logger.log(`Claude APIエラー: ${JSON.stringify(result.error)}`);
      return null;
    }

    return result.content[0].text;
  } catch (err) {
    Logger.log(`Claude API呼び出しエラー: ${err.toString()}`);
    return null;
  }
}

// ============================================================
// 5. Slackレスポンス送信ヘルパー
// ============================================================

/**
 * 処理中メッセージをSlackに送信
 */
function notifySlackProcessing(responseUrl, actionValue) {
  const data = JSON.parse(actionValue);
  postToResponseUrl(responseUrl, {
    replace_original: false,
    text: `⏳ *${data.subject}* の返信下書きを作成中です...`,
  });
}

/**
 * 下書き作成完了をSlackに通知
 */
function notifySlackDraftCreated(responseUrl, subject, body, replyTo) {
  const preview = body.substring(0, 600);
  postToResponseUrl(responseUrl, {
    replace_original: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Gmail下書きを作成しました*\n*宛先:* ${replyTo}\n*件名:* ${subject}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*下書き内容（抜粋）:*\n\`\`\`${preview}${body.length > 600 ? '\n...' : ''}\`\`\``,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📝 <https://mail.google.com/mail/u/0/#drafts|Gmailの下書きを開く> で確認・編集して送信してください',
        },
      },
    ],
  });
}

/**
 * エラーをSlackに通知
 */
function notifySlackError(responseUrl, message) {
  postToResponseUrl(responseUrl, {
    replace_original: false,
    text: `❌ エラーが発生しました: ${message}`,
  });
}

/**
 * Slackのresponse_urlにメッセージを送信
 */
function postToResponseUrl(responseUrl, payload) {
  try {
    UrlFetchApp.fetch(responseUrl, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log(`response_url送信エラー: ${err.toString()}`);
  }
}

// ============================================================
// 6. 処理済みメールID管理
// ============================================================

function getProcessedIds() {
  const raw = PROPS.getProperty('PROCESSED_IDS_KEY') || '[]';
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveProcessedIds(ids) {
  PROPS.setProperty('PROCESSED_IDS_KEY', JSON.stringify(ids));
}

// ============================================================
// 7. 初期セットアップ用（手動で一度だけ実行）
// ============================================================

/**
 * タイマートリガーをセットアップ（5分ごとに実行）
 * GASエディタから手動で一度だけ実行してください
 */
function setupTrigger() {
  // 既存のトリガーを削除
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkImportantEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 新しいトリガーを作成（5分ごと）
  ScriptApp.newTrigger('checkImportantEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ タイマートリガーを設定しました（5分ごと）');
}

/**
 * 設定確認用（手動で実行して設定が正しいか確認）
 */
function checkConfiguration() {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID', 'CLAUDE_API_KEY'];
  const missing = required.filter(key => !PROPS.getProperty(key));

  if (missing.length > 0) {
    Logger.log(`❌ 未設定のプロパティ: ${missing.join(', ')}`);
  } else {
    Logger.log('✅ 全ての必要なプロパティが設定されています');
  }
}
