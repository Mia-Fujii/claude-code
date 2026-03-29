// ============================================================
// 設定（スクリプトプロパティに保存してください）
// ============================================================
// CHATWORK_API_TOKEN  : ChatWork APIトークン
// CHATWORK_ROOM_ID    : 通知先ChatWorkルームID
// SLACK_BOT_TOKEN     : Slack Bot Token (xoxb-...)
// SLACK_CHANNEL_ID    : 通知先SlackチャンネルID
// GEMINI_API_KEY      : Google AI Studio APIキー（無料）
//
// スクリプトプロパティの設定:
// GASエディタ → プロジェクトの設定 → スクリプトプロパティ
// Gemini APIキー取得: https://aistudio.google.com/app/apikey
// ============================================================

const PROPS = PropertiesService.getScriptProperties();

// 通知する時間帯（8:00〜18:10）
const START_HOUR = 8;
const START_MINUTE = 0;
const END_HOUR = 18;
const END_MINUTE = 10;

// Gmailの検索クエリ（既存と同じキーワード）
const GMAIL_QUERY = 'is:unread subject:(請求書 OR 契約書 OR 顧問料)';

// Geminiモデル（無料枠: 15 req/min, 1500 req/day）
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

// ============================================================
// メイン関数（タイマートリガーで実行）
// ============================================================

function gmailNotify() {
  // 時間チェック
  if (!isWithinBusinessHours()) {
    const now = new Date();
    console.log(`時間外のため停止します（現在 ${now.getHours()}:${now.getMinutes()}）`);
    return;
  }

  const threads = GmailApp.search(GMAIL_QUERY);
  if (threads.length === 0) return;

  threads.forEach(thread => {
    const msg = thread.getMessages().pop();

    const emailData = {
      id: msg.getId(),
      threadId: thread.getId(),
      subject: msg.getSubject(),
      from: msg.getFrom(),
      date: Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      body: msg.getPlainBody().slice(0, 2000),
      permalink: thread.getPermalink(),
    };

    // ChatWorkに通知（既存の動作）
    sendChatworkNotification(emailData, msg);

    // Slackに通知（AIボタン付き）
    sendSlackNotification(emailData);

    // 既読にして重複処理を防ぐ
    thread.markRead();
  });
}

// ============================================================
// 時間チェック
// ============================================================

function isWithinBusinessHours() {
  const now = new Date();
  const current = now.getHours() * 100 + now.getMinutes();
  const start = START_HOUR * 100 + START_MINUTE;
  const end = END_HOUR * 100 + END_MINUTE;
  return current >= start && current <= end;
}

// ============================================================
// ChatWork通知（既存の動作をそのまま維持）
// ============================================================

function sendChatworkNotification(emailData, msg) {
  const token = PROPS.getProperty('CHATWORK_API_TOKEN');
  const roomId = PROPS.getProperty('CHATWORK_ROOM_ID');
  if (!token || !roomId) {
    console.log('ChatWork設定未完了のためスキップ');
    return;
  }

  const headers = { 'X-ChatWorkToken': token };

  function fetchChatwork(endpoint, options) {
    try {
      const params = { headers: headers, muteHttpExceptions: true, ...options };
      const response = UrlFetchApp.fetch('https://api.chatwork.com/v2' + endpoint, params);
      if (response.getResponseCode() >= 300) return null;
      return JSON.parse(response.getContentText());
    } catch (e) { return null; }
  }

  const me = fetchChatwork('/me');
  if (!me) return;
  const myId = me.account_id;

  const cwMessage =
    `[To:${myId}]\n` +
    `[info][title]📩 メール通知: ${emailData.subject}[/title]` +
    `【送信元】: ${emailData.from}\n` +
    `【本　文】: \n${emailData.body.slice(0, 300)}...\n\n` +
    `🔗 Gmailで開く: ${emailData.permalink}[/info]`;

  const sentResponse = fetchChatwork('/rooms/' + roomId + '/messages', {
    method: 'post',
    payload: { body: cwMessage },
  });

  if (sentResponse && sentResponse.message_id) {
    fetchChatwork('/rooms/' + roomId + '/messages/unread', {
      method: 'put',
      payload: { message_id: sentResponse.message_id },
    });
  }
}

// ============================================================
// Slack通知（AIボタン付き）
// ============================================================

function sendSlackNotification(emailData) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');
  const channel = PROPS.getProperty('SLACK_CHANNEL_ID');
  if (!token || !channel) {
    console.log('Slack設定未完了のためスキップ');
    return;
  }

  const payload = {
    channel: channel,
    text: `📧 重要メール: ${emailData.subject}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📧 重要メール通知', emoji: true },
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
    console.log(`Slack送信エラー: ${result.error}`);
  }
}

// ============================================================
// Slackボタン受信（GAS Webアプリ doPost）
// ============================================================

function doPost(e) {
  try {
    const rawPayload = e.parameter.payload;
    if (!rawPayload) return ContentService.createTextOutput('OK');

    const payload = JSON.parse(rawPayload);

    if (payload.type === 'block_actions') {
      handleBlockAction(payload);
    }

    return ContentService.createTextOutput('OK');
  } catch (error) {
    console.log(`doPostエラー: ${error.toString()}`);
    return ContentService.createTextOutput('Error');
  }
}

function handleBlockAction(payload) {
  const action = payload.actions[0];
  const responseUrl = payload.response_url;

  if (action.action_id !== 'create_draft') return;

  const actionData = JSON.parse(action.value);

  // 処理中をSlackに通知
  postToResponseUrl(responseUrl, {
    replace_original: false,
    text: `⏳ *${actionData.subject}* の返信下書きを作成中です...`,
  });

  // メール本文を再取得（フル版）
  let emailSubject = actionData.subject;
  let emailFrom = actionData.from;
  let emailBody = '';
  try {
    const message = GmailApp.getMessageById(actionData.messageId);
    emailBody = message.getPlainBody();
    emailSubject = message.getSubject();
    emailFrom = message.getFrom();
  } catch (err) {
    postToResponseUrl(responseUrl, {
      replace_original: false,
      text: '❌ メールの取得に失敗しました',
    });
    return;
  }

  // Gemini APIで返信文生成
  const draftBody = generateReplyWithGemini(emailSubject, emailFrom, emailBody);
  if (!draftBody) {
    postToResponseUrl(responseUrl, {
      replace_original: false,
      text: '❌ AI返信の生成に失敗しました（GEMINI_API_KEYを確認してください）',
    });
    return;
  }

  // Gmail下書き作成
  const replyTo = emailFrom.match(/<(.+)>/)?.[1] || emailFrom;
  const draftSubject = emailSubject.startsWith('Re:') ? emailSubject : `Re: ${emailSubject}`;
  try {
    GmailApp.createDraft(replyTo, draftSubject, draftBody);
  } catch (err) {
    postToResponseUrl(responseUrl, {
      replace_original: false,
      text: '❌ Gmail下書きの作成に失敗しました',
    });
    return;
  }

  // 完了通知
  const preview = draftBody.substring(0, 600);
  postToResponseUrl(responseUrl, {
    replace_original: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Gmail下書きを作成しました*\n*宛先:* ${replyTo}\n*件名:* ${draftSubject}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*下書き内容（抜粋）:*\n\`\`\`${preview}${draftBody.length > 600 ? '\n...' : ''}\`\`\``,
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

function postToResponseUrl(responseUrl, payload) {
  try {
    UrlFetchApp.fetch(responseUrl, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.log(`response_url送信エラー: ${err.toString()}`);
  }
}

// ============================================================
// Gemini API（無料枠: 15 req/min, 1500 req/day）
// ============================================================

function generateReplyWithGemini(subject, from, body) {
  const apiKey = PROPS.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    console.log('ERROR: GEMINI_API_KEY が未設定です');
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
- 返信本文のみを出力（説明文・前置き不要）`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
      muteHttpExceptions: true,
    });

    const result = JSON.parse(response.getContentText());
    if (result.error) {
      console.log(`Gemini APIエラー: ${JSON.stringify(result.error)}`);
      return null;
    }

    return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.log(`Gemini API呼び出しエラー: ${err.toString()}`);
    return null;
  }
}

// ============================================================
// 初期セットアップ（一度だけ手動実行）
// ============================================================

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'gmailNotify') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('gmailNotify')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('✅ タイマートリガーを設定しました（5分ごと）');
}
