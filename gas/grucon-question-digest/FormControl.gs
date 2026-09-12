/**
 * Googleフォームの自動開閉
 */

function openForm_() { return setFormAccepting_(true); }
function closeForm_() { return setFormAccepting_(false); }

function setFormAccepting_(accepting) {
  const id = cfg_('FORM_ID');
  if (!id) throw new Error('FORM_ID が未設定です。setupCreateForm() を実行するか、手動で設定してください。');
  const form = FormApp.openById(id);
  if (form.isAcceptingResponses() === accepting) {
    logInfo_('フォームはすでに' + (accepting ? '受付中' : '締切済み') + 'です。');
    return false;
  }
  form.setAcceptingResponses(accepting);
  logInfo_('フォームを' + (accepting ? 'オープン' : 'クローズ') + 'しました。');
  return true;
}

function isFormAccepting_() {
  const id = cfg_('FORM_ID');
  if (!id) return null;
  return FormApp.openById(id).isAcceptingResponses();
}

/**
 * 締切後の表示メッセージを、次回グルコンの日付に合わせて更新する
 */
function updateClosedMessage_(nextEvent) {
  const id = cfg_('FORM_ID');
  if (!id) return;
  const form = FormApp.openById(id);
  var msg = '事前質問の受付は終了しました。ご質問ありがとうございました。';
  if (nextEvent) {
    msg += '\n次回グルコン（' + formatDateJa_(nextEvent.date) + '）の受付は '
        + formatDateJa_(addDays_(nextEvent.date, -CONFIG.OPEN_DAYS_BEFORE)) + ' に開始します。';
  }
  form.setCustomClosedFormMessage(msg);
}
