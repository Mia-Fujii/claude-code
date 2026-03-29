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

// Geminiモデル
const GEMINI_MODEL = 'gemini-2.5-flash';

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
                date: emailData.date,
                body: emailData.body.slice(0, 1000),
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
// Slackインタラクション受信（GAS Webアプリ doPost）
// ============================================================

function doPost(e) {
  try {
    const rawPayload = e.parameter.payload;
    if (!rawPayload) return ContentService.createTextOutput('OK');

    const payload = JSON.parse(rawPayload);

    if (payload.type === 'block_actions') {
      handleBlockAction(payload);
      return ContentService.createTextOutput('OK');
    }

    if (payload.type === 'view_submission') {
      return handleViewSubmission(payload);
    }

    return ContentService.createTextOutput('OK');
  } catch (error) {
    console.log(`doPostエラー: ${error.toString()}`);
    return ContentService.createTextOutput('Error');
  }
}

// ============================================================
// ボタン押下：AI生成 → 編集モーダルを開く
// ============================================================

function handleBlockAction(payload) {
  const action = payload.actions[0];
  const responseUrl = payload.response_url;
  const triggerId = payload.trigger_id;

  if (action.action_id !== 'create_draft') return;

  const actionData = JSON.parse(action.value);

  // ① まず「生成中」モーダルをすぐ開く（trigger_idは3秒以内に使う必要があるため）
  const loadingViewId = openLoadingModal(triggerId, actionData.subject);
  if (!loadingViewId) {
    postToResponseUrl(responseUrl, {
      replace_original: false,
      text: '❌ モーダルを開けませんでした',
    });
    return;
  }

  // ② メール本文を再取得（フル版）
  let emailSubject = actionData.subject;
  let emailFrom = actionData.from;
  let emailDate = actionData.date;
  let emailBody = actionData.body;
  try {
    const message = GmailApp.getMessageById(actionData.messageId);
    emailBody = message.getPlainBody();
    emailSubject = message.getSubject();
    emailFrom = message.getFrom();
    emailDate = formatJapaneseDate(message.getDate());
  } catch (err) {
    updateModalWithError(loadingViewId, 'メールの取得に失敗しました');
    return;
  }

  // ③ Gemini APIで返信文生成
  const generatedReply = generateReplyWithGemini(emailSubject, emailFrom, emailBody);
  if (!generatedReply) {
    updateModalWithError(loadingViewId, 'AI返信の生成に失敗しました');
    return;
  }

  // ④ モーダルを編集可能な状態に更新
  const metadata = JSON.stringify({
    messageId: actionData.messageId,
    subject: emailSubject,
    from: emailFrom,
    date: emailDate,
    body: emailBody.slice(0, 800),
    responseUrl: responseUrl,
  });

  updateModalWithReply(loadingViewId, generatedReply, emailSubject, metadata);
}

// ============================================================
// モーダル操作
// ============================================================

// 「生成中」モーダルを即座に開いてview_idを返す
function openLoadingModal(triggerId, subject) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');

  const modal = {
    type: 'modal',
    callback_id: 'draft_edit_modal',
    title: { type: 'plain_text', text: 'AI返信下書きの編集' },
    close: { type: 'plain_text', text: 'キャンセル' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏳ *${subject}*\n\nAIが返信文を生成中です...しばらくお待ちください。`,
        },
      },
    ],
  };

  const response = UrlFetchApp.fetch('https://slack.com/api/views.open', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ trigger_id: triggerId, view: modal }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (!result.ok) {
    console.log(`モーダルオープンエラー: ${result.error}`);
    return null;
  }
  return result.view.id;
}

// 生成完了後、モーダルを編集可能な状態に更新
function updateModalWithReply(viewId, generatedReply, subject, metadata) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');

  const modal = {
    type: 'modal',
    callback_id: 'draft_edit_modal',
    private_metadata: metadata,
    title: { type: 'plain_text', text: 'AI返信下書きの編集' },
    submit: { type: 'plain_text', text: 'Gmailに下書き保存' },
    close: { type: 'plain_text', text: 'キャンセル' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*件名:* Re: ${subject}\n\nAIが生成した返信文を編集できます。`,
        },
      },
      {
        type: 'input',
        block_id: 'reply_block',
        label: { type: 'plain_text', text: '返信文' },
        element: {
          type: 'plain_text_input',
          action_id: 'reply_text',
          multiline: true,
          initial_value: generatedReply,
        },
      },
    ],
  };

  const response = UrlFetchApp.fetch('https://slack.com/api/views.update', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ view_id: viewId, view: modal }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (!result.ok) {
    console.log(`モーダル更新エラー: ${result.error}`);
  }
}

// エラー時にモーダルを更新
function updateModalWithError(viewId, message) {
  const token = PROPS.getProperty('SLACK_BOT_TOKEN');

  const modal = {
    type: 'modal',
    callback_id: 'draft_edit_modal',
    title: { type: 'plain_text', text: 'エラー' },
    close: { type: 'plain_text', text: '閉じる' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `❌ ${message}` },
      },
    ],
  };

  UrlFetchApp.fetch('https://slack.com/api/views.update', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ view_id: viewId, view: modal }),
    muteHttpExceptions: true,
  });
}

// ============================================================
// モーダル送信：Gmail下書きを作成
// ============================================================

function handleViewSubmission(payload) {
  const metadata = JSON.parse(payload.view.private_metadata);
  const editedReply = payload.view.state.values.reply_block.reply_text.value;

  const replyTo = metadata.from.match(/<(.+)>/)?.[1] || metadata.from;
  const draftSubject = metadata.subject.startsWith('Re:')
    ? metadata.subject
    : `Re: ${metadata.subject}`;

  const quotedBody = buildQuotedReply(editedReply, metadata.from, metadata.date, metadata.subject, metadata.body);

  try {
    GmailApp.createDraft(replyTo, draftSubject, quotedBody);
  } catch (err) {
    console.log(`下書き作成エラー: ${err.toString()}`);
    postToResponseUrl(metadata.responseUrl, {
      replace_original: false,
      text: '❌ Gmail下書きの作成に失敗しました',
    });
    return ContentService.createTextOutput(JSON.stringify({ response_action: 'clear' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  postToResponseUrl(metadata.responseUrl, {
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
          text: '📝 <https://mail.google.com/mail/u/0/#drafts|Gmailの下書きを開く> で確認・送信してください',
        },
      },
    ],
  });

  return ContentService.createTextOutput(JSON.stringify({ response_action: 'clear' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 引用返信フォーマット生成
// ============================================================

function buildQuotedReply(replyText, fromAddress, date, subject, originalBody) {
  const emailMatch = fromAddress.match(/<(.+)>/);
  const emailOnly = emailMatch ? `<${emailMatch[1]}>` : `<${fromAddress}>`;

  const signature = `――――――――――\n株式会社Dears事務局`;

  return `${replyText}

${signature}

${date} ${emailOnly}
${originalBody}`;
}

// 日付を「2026年3月16日(月) 23:15」形式にフォーマット
function formatJapaneseDate(date) {
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = DOW[date.getDay()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日(${dow}) ${hh}:${mm}`;
}

// ============================================================
// Slackのresponse_urlへの送信
// ============================================================

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
// Gemini API
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
- 冒頭は「Dears事務局です。」から始める（名前は名乗らない）
- 受領確認を含める
- 必要に応じて確認事項や次のステップを記載
- 署名は不要（別途自動追加されます）
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
// 処理済みメールID管理
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
