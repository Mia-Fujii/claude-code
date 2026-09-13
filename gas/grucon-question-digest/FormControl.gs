/**
 * Googleフォームの自動開閉
 *
 * フォームIDは、この回答スプレッドシートに紐づいているフォームから
 * 自動で判別します。手で設定する必要はありません。
 * （うまくいかない場合だけ setFormIds() でIDを登録してください）
 */

/**
 * 対象のフォームを取得する。見つからなければ null を返す。
 */
function getFormOrNull_() {
  // ① スクリプトプロパティ／CONFIG のIDがあればそれを使う
  const id = cfg_('FORM_ID');
  if (id) {
    try {
      return FormApp.openById(id);
    } catch (e) {
      console.warn('FORM_ID でフォームを開けませんでした: ' + e);
    }
  }

  // ② プロファイルに登録されたIDを使う
  try {
    const profileFormId = getProfile_().formId;
    if (profileFormId) {
      return FormApp.openById(profileFormId);
    }
  } catch (e) {
    console.warn('プロファイルのフォームIDで開けませんでした: ' + e);
  }

  // ③ 回答スプレッドシートに紐づいているフォームを自動検出する
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      const responseId = cfg_('RESPONSE_SPREADSHEET_ID');
      if (responseId) ss = SpreadsheetApp.openById(responseId);
    }
    if (ss) {
      const formUrl = ss.getFormUrl();
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        // 次回以降のために覚えておく
        PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());
        logInfo_('回答シートに紐づくフォームを自動検出しました：' + form.getTitle());
        return form;
      }
    }
  } catch (e) {
    console.warn('フォームの自動検出に失敗しました: ' + e);
  }

  return null;
}

/** 対象のフォームを取得する（見つからなければエラー） */
function getForm_() {
  const form = getFormOrNull_();
  if (!form) {
    throw new Error(
      'フォームが見つかりませんでした。\n\n'
      + 'この回答スプレッドシートにGoogleフォームが紐づいていないようです。\n'
      + '・Googleフォームの「回答」タブ →「スプレッドシートにリンク」で\n'
      + '　このシートに紐づけてください。\n'
      + '・または setFormIds() でフォームのIDを登録してください。'
    );
  }
  return form;
}

/** フォームが使える状態かどうか */
function hasForm_() {
  return getFormOrNull_() !== null;
}

function openForm_() { return setFormAccepting_(true); }
function closeForm_() { return setFormAccepting_(false); }

/**
 * フォームの受付状態を変更する
 * @return {'changed'|'unchanged'} 変更したか
 */
function setFormAccepting_(accepting) {
  const form = getForm_();
  if (form.isAcceptingResponses() === accepting) {
    logInfo_('フォームはすでに' + (accepting ? '受付中' : '締切済み') + 'です。');
    return 'unchanged';
  }
  form.setAcceptingResponses(accepting);
  logInfo_('フォームを' + (accepting ? 'オープン' : 'クローズ') + 'しました。');
  return 'changed';
}

/**
 * 自動実行から呼ぶ用。フォーム未設定なら、エラーにせずログだけ残してスキップする。
 * @return {boolean} 実行できたか
 */
function setFormAcceptingIfAvailable_(accepting) {
  if (!hasForm_()) {
    logInfo_('⚠ フォームが未設定のため、'
      + (accepting ? 'オープン' : 'クローズ') + '処理をスキップしました。');
    return false;
  }
  setFormAccepting_(accepting);
  return true;
}

/** フォームの受付状態（未設定なら null） */
function isFormAccepting_() {
  const form = getFormOrNull_();
  return form ? form.isAcceptingResponses() : null;
}

/** フォームの回答用URL（未設定なら空文字） */
function getFormPublishedUrl_() {
  const form = getFormOrNull_();
  return form ? form.getPublishedUrl() : '';
}

/**
 * 締切後の表示メッセージを、次回グルコンの日付に合わせて更新する
 */
function updateClosedMessage_(nextEvent) {
  const form = getFormOrNull_();
  if (!form) return;
  var msg = '事前質問の受付は終了しました。ご質問ありがとうございました。';
  if (nextEvent) {
    msg += '\n次回グルコン（' + formatDateJa_(nextEvent.date) + '）の受付は '
        + formatDateJa_(addDays_(nextEvent.date, -CONFIG.OPEN_DAYS_BEFORE)) + ' に開始します。';
  }
  try {
    form.setCustomClosedFormMessage(msg);
  } catch (e) {
    console.warn('締切メッセージの更新に失敗しました: ' + e);
  }
}
