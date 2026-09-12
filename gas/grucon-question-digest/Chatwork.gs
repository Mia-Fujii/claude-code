/**
 * Chatwork通知
 *
 * トークンとルームIDは「プロジェクトの設定 > スクリプト プロパティ」に
 * CHATWORK_TOKEN / CHATWORK_ROOM_ID として保存してください。
 */

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

function getChatworkCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('CHATWORK_TOKEN') || '').trim();
  const roomId = (props.getProperty('CHATWORK_ROOM_ID') || '').trim();
  if (!token) throw new Error('スクリプトプロパティ CHATWORK_TOKEN が未設定です。');
  if (!roomId) throw new Error('スクリプトプロパティ CHATWORK_ROOM_ID が未設定です。');
  return { token: token, roomId: roomId };
}

/** Chatworkにメッセージを送信する */
function sendChatwork_(message) {
  if (CONFIG.DRY_RUN) {
    logInfo_('[DRY_RUN] Chatworkには送信していません。本文:\n' + message);
    return { dryRun: true };
  }
  const cred = getChatworkCredentials_();
  const res = UrlFetchApp.fetch(
    CHATWORK_API_BASE + '/rooms/' + encodeURIComponent(cred.roomId) + '/messages',
    {
      method: 'post',
      headers: { 'X-ChatWorkToken': cred.token },
      payload: { body: message },
      muteHttpExceptions: true,
    }
  );
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Chatwork送信に失敗しました (HTTP ' + code + '): ' + res.getContentText());
  }
  logInfo_('Chatworkに送信しました。');
  return JSON.parse(res.getContentText());
}

/**
 * 質問まとめの通知メッセージを組み立てる
 */
function buildNotificationMessage_(event, result, docInfo) {
  const settings = readSettings_();
  const mention = String(settings['Chatwork メンション先'] || '').trim();

  const lines = [];
  lines.push('[info][title]' + docInfo.title + '　事前質問まとめ[/title]');
  if (mention) lines.push(mention);
  lines.push('');

  const when = formatDateJa_(event.date)
    + (event.startTime ? ' ' + event.startTime : '')
    + (event.endTime ? '〜' + event.endTime : '');
  lines.push(when + ' 開催グルコンの事前質問をまとめました。');
  lines.push('');
  lines.push('▼ドキュメント');
  lines.push(docInfo.url);
  lines.push('');
  lines.push('保存先：' + docInfo.path);
  lines.push('');

  const s = result.stats;
  lines.push('回答 ' + s.responseCount + '件 ／ 質問者 ' + s.personCount
    + '名 ／ 掲載 ' + s.questionCount + '件'
    + (s.duplicateCount > 0 ? '（重複 ' + s.duplicateCount + '件を除外）' : ''));

  if (result.notes.length > 0) {
    lines.push('');
    lines.push('■ 自動処理の補足');
    result.notes.forEach(function (n) { lines.push('・' + n); });
  }

  if (docInfo.createdFolders.length > 0) {
    lines.push('');
    lines.push('※ フォルダを新規作成しました：' + docInfo.createdFolders.join(' / '));
    lines.push('　 期の設定が正しいかご確認ください（「基本設定」B2 ＝ ' + docInfo.term + '）');
  }

  lines.push('[/info]');
  return lines.join('\n');
}

/** エラーをChatworkに知らせる */
function notifyError_(context, err) {
  try {
    const message = '[info][title]⚠ グルコン質問まとめ処理でエラー[/title]'
      + '\n処理：' + context
      + '\n内容：' + (err && err.message ? err.message : String(err))
      + '\n\n手動で manualBuildAndNotify() を実行してください。[/info]';
    sendChatwork_(message);
  } catch (e) {
    console.error('エラー通知自体に失敗しました: ' + e);
  }
}
