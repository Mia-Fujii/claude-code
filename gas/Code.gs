// ============================================================
// 設定（スクリプトプロパティに保存してください）
// ============================================================
// SLACK_BOT_TOKEN  : Slack Bot Token (xoxb-...)
// SLACK_CHANNEL_ID : 通知先SlackチャンネルID
// GEMINI_API_KEY   : Google AI Studio APIキー（無料）
//                    取得: https://aistudio.google.com/app/apikey
// ============================================================

const PROPS = PropertiesService.getScriptProperties();

// Gmailの検索キーワード（チャットワーク側と合わせる）
const GMAIL_QUERY = 'is:unread subject:(請求書 OR 契約書 OR 顧問料)';

// Geminiモデル（無料枠: 15 req/min, 1500 req/day）
const GEMINI_MODEL = 'gemini-1.5-flash';

// ============================================================
// メイン関数（タイマートリガーで5分ごとに実行）
// 時間制限なし：届いたら即通知
// ============================================================

function checkAndNotify() {
  const threads = GmailApp.search(GMAIL_QUERY);
  if (threads.length === 0) return;

  const processedIds = getProcessedIds();
  const newIds = [...processedIds];

  threads.forEach(thread => {
    const msg = thread.getMessages().pop();
    const messageId = msg.getId();

    // 通知済みはスキップ
    if (processedIds.includes(messageId)) return;

    const emailData = {
      id: messageId,
      subject: msg.getSubject(),
      from: msg.getFrom(),
      date: Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      body: msg.getPlainBody().slice(0, 2000),
      permalink: thread.getPermalink(),
    };

    sendSlackNotification(emailData);
    newIds.push(messageId);
  });

  // 処理済みIDを保存（最新500件まで）
  saveProcessedIds(newIds.slice(-500));
}

// ============================================================
// Slack通知（AIボタン付き）
// ============================================================

function sendSlackNotification(emailData) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');
  const channel = PROPS.getProperty('SLACK_CHANNEL_ID');
  if (!token || !channel) {
    console.log('ERROR: SLACK_BOT_TOKEN または SLACK_CHANNEL_ID が未設定です');
    return;
  }

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({
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
    }),
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

  // メール本文を再取得
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

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
        muteHttpExceptions: true,
      }
    );

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
// 処理済みメールID管理（既読にしないので重複防止に使用）
// ============================================================

function getProcessedIds() {
  try {
    return JSON.parse(PROPS.getProperty('PROCESSED_IDS') || '[]');
  } catch {
    return [];
  }
}

function saveProcessedIds(ids) {
  PROPS.setProperty('PROCESSED_IDS', JSON.stringify(ids));
}

// ============================================================
// 初期セットアップ（一度だけ手動実行）
// ============================================================

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkAndNotify') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('checkAndNotify')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('✅ タイマートリガーを設定しました（5分ごと・時間制限なし）');
}
