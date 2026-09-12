/**
 * エントリポイントとトリガー管理
 *
 * ── 動作の流れ ────────────────────────────────────────────
 *   毎日 6:00  dailyPlanner()
 *       ・今日がグルコンの5日前 → フォームをオープン
 *       ・今日がグルコンの前日   → 13:00 と 13:30 の単発トリガーを仕込む
 *   前日 13:00  closeFormNow()        フォームをクローズ
 *   前日 13:30  buildAndNotifyNow()   ドキュメント作成 → Chatwork送信
 *   毎日 15:00  dailySafetyNet()      上が落ちていたらここで実行し直す
 *
 *   ※ GASの定期トリガーは指定時刻から±15分ほどずれます。
 *      13:00 / 13:30 だけは単発トリガー（at）を使い、ずれを最小にしています。
 */

// ─────────────────────────────────────────────────────────
//  セットアップ
// ─────────────────────────────────────────────────────────

/** ★最初に1回だけ実行する：トリガーを設置します */
function setupInstallTriggers() {
  removeAllTriggers();

  ScriptApp.newTrigger('dailyPlanner')
    .timeBased().atHour(CONFIG.PLANNER_HOUR).nearMinute(0).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();

  ScriptApp.newTrigger('dailySafetyNet')
    .timeBased().atHour(CONFIG.SAFETY_NET_HOUR).nearMinute(0).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();

  logInfo_('トリガーを設置しました：dailyPlanner（'
    + CONFIG.PLANNER_HOUR + '時）／ dailySafetyNet（' + CONFIG.SAFETY_NET_HOUR + '時）');
  showStatus();
}

/** すべてのトリガーを削除する */
function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  logInfo_('既存のトリガーをすべて削除しました。');
}

/** 現在の設定状況をログに出す（設定確認用） */
function showStatus() {
  const lines = [];
  lines.push('── 設定状況 ──────────────────────────');
  try {
    lines.push('期（基本設定B2）      : ' + getTermName_());
  } catch (e) {
    lines.push('期（基本設定B2）      : ⚠ ' + e.message);
  }
  lines.push('マスタSS ID           : ' + (cfg_('MASTER_SPREADSHEET_ID') || '⚠ 未設定'));
  lines.push('講座ルートフォルダID  : ' + (cfg_('COURSE_ROOT_FOLDER_ID') || '⚠ 未設定'));
  try {
    const form = getFormOrNull_();
    if (form) {
      lines.push('フォーム              : ' + form.getTitle());
      lines.push('　回答用URL          : ' + form.getPublishedUrl());
    } else {
      lines.push('フォーム              : ⚠ 見つかりません（この回答シートに紐づいていません）');
    }
  } catch (e) {
    lines.push('フォーム              : ⚠ ' + e.message);
  }
  lines.push('回答スプレッドシートID: ' + (cfg_('RESPONSE_SPREADSHEET_ID') || '⚠ 未設定'));

  const props = PropertiesService.getScriptProperties();
  lines.push('CHATWORK_TOKEN        : ' + (props.getProperty('CHATWORK_TOKEN') ? '設定済み' : '⚠ 未設定'));
  lines.push('CHATWORK_ROOM_ID      : ' + (props.getProperty('CHATWORK_ROOM_ID') || '⚠ 未設定'));
  lines.push('DRY_RUN               : ' + CONFIG.DRY_RUN);

  try {
    const accepting = isFormAccepting_();
    lines.push('フォームの状態        : ' + (accepting === null ? '―' : (accepting ? '受付中' : '締切中')));
  } catch (e) {
    lines.push('フォームの状態        : ⚠ ' + e.message);
  }

  try {
    const rootId = cfg_('COURSE_ROOT_FOLDER_ID');
    if (rootId) {
      const names = [];
      const it = DriveApp.getFolderById(rootId).getFolders();
      while (it.hasNext() && names.length < 30) names.push(it.next().getName());
      lines.push('講座ルート直下フォルダ: ' + (names.length ? names.join(' / ') : '(なし)'));
    }
  } catch (e) {
    lines.push('講座ルート直下フォルダ: ⚠ ' + e.message);
  }

  try {
    const events = listTargetEvents_();
    lines.push('グルコン件数          : ' + events.length + '件');
    const next = findNextEvent_();
    lines.push('次回グルコン          : ' + (next
      ? formatDateJa_(next.date) + ' ' + next.startTime + '〜' + next.endTime
      : '（今日以降の予定なし）'));
    if (next) {
      const w = getCollectionWindow_(next.date);
      lines.push('　受付期間            : ' + formatDate_(w.start, 'M/d HH:mm')
        + ' 〜 ' + formatDate_(w.end, 'M/d HH:mm'));
      lines.push('　ドキュメント名      : ' + buildDocTitle_(next.date));
    }
  } catch (e) {
    lines.push('グルコン一覧          : ⚠ ' + e.message);
  }

  const triggers = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });
  lines.push('設置済みトリガー      : ' + (triggers.length ? triggers.join(' / ') : '(なし)'));
  lines.push('────────────────────────────────────');

  const out = lines.join('\n');
  console.log(out);
  return out;
}

// ─────────────────────────────────────────────────────────
//  定期処理
// ─────────────────────────────────────────────────────────

/** 毎日 6:00 に実行される司令塔 */
function dailyPlanner() {
  try {
    // ① フォームのオープン（5日前）
    const openTarget = findEventByDaysAhead_(CONFIG.OPEN_DAYS_BEFORE);
    if (openTarget) {
      if (setFormAcceptingIfAvailable_(true)) {
        logInfo_('【オープン】' + formatDateJa_(openTarget.date) + ' のグルコンに向けてフォームを開きました。');
      }
    }

    // ② 受付期間中なのに閉じていたら開け直す（取りこぼし防止）
    ensureFormStateForToday_();

    // ③ 今日が前日なら、13:00 と 13:30 の単発トリガーを仕込む
    const closeTarget = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (closeTarget) {
      scheduleExactJobsForToday_();
      clearDoneFlag_(closeTarget.date);
    }
  } catch (err) {
    console.error(err);
    notifyError_('dailyPlanner', err);
  }
}

/** 今日の 13:00 / 13:30 に単発トリガーを仕込む */
function scheduleExactJobsForToday_() {
  removeOneShotTriggers_();

  const now = new Date();
  const closeAt = new Date(now.getTime());
  closeAt.setHours(CONFIG.CLOSE_HOUR, CONFIG.CLOSE_MINUTE, 0, 0);
  const notifyAt = new Date(now.getTime());
  notifyAt.setHours(CONFIG.NOTIFY_HOUR, CONFIG.NOTIFY_MINUTE, 0, 0);

  if (closeAt > now) {
    ScriptApp.newTrigger('closeFormNow').timeBased().at(closeAt).create();
    logInfo_('単発トリガーを設置：closeFormNow @ ' + formatDate_(closeAt, 'M/d HH:mm'));
  }
  if (notifyAt > now) {
    ScriptApp.newTrigger('buildAndNotifyNow').timeBased().at(notifyAt).create();
    logInfo_('単発トリガーを設置：buildAndNotifyNow @ ' + formatDate_(notifyAt, 'M/d HH:mm'));
  }
}

function removeOneShotTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'closeFormNow' || fn === 'buildAndNotifyNow') ScriptApp.deleteTrigger(t);
  });
}

/** 13:00 ちょうどに走る：フォームを閉じる */
function closeFormNow() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) {
      logInfo_('今日は前日ではないため、締切処理をスキップしました。');
      return;
    }
    setFormAcceptingIfAvailable_(false);
    updateClosedMessage_(findEventAfter_(event.date));
  } catch (err) {
    console.error(err);
    notifyError_('closeFormNow（フォーム締切）', err);
  }
}

/** 13:30 ちょうどに走る：ドキュメント作成 → Chatwork送信 */
function buildAndNotifyNow() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) {
      logInfo_('今日は前日ではないため、質問まとめをスキップしました。');
      return;
    }
    runDigest_(event, true);
    setDoneFlag_(event.date);
  } catch (err) {
    console.error(err);
    notifyError_('buildAndNotifyNow（質問まとめ作成・送信）', err);
  }
}

/** 毎日 15:00：13:00/13:30 の処理が落ちていた場合の救済 */
function dailySafetyNet() {
  try {
    const event = findEventByDaysAhead_(CONFIG.CLOSE_DAYS_BEFORE);
    if (!event) return;

    if (isFormAccepting_() === true) {
      logInfo_('【救済】フォームが開いたままだったため締切処理を実行します。');
      setFormAcceptingIfAvailable_(false);
      updateClosedMessage_(findEventAfter_(event.date));
    }
    if (!isDone_(event.date)) {
      logInfo_('【救済】質問まとめが未送信のため実行します。');
      runDigest_(event, true);
      setDoneFlag_(event.date);
    }
  } catch (err) {
    console.error(err);
    notifyError_('dailySafetyNet', err);
  }
}

/** 受付期間中ならフォームが開いていることを保証する */
function ensureFormStateForToday_() {
  const next = findNextEvent_();
  if (!next) return;
  const w = getCollectionWindow_(next.date);
  const now = new Date();
  if (now >= w.start && now < w.end && isFormAccepting_() === false) {
    setFormAcceptingIfAvailable_(true);
    logInfo_('受付期間中にフォームが閉じていたため開き直しました。');
  }
}

// ─────────────────────────────────────────────────────────
//  本処理
// ─────────────────────────────────────────────────────────

/**
 * 質問まとめの本体
 * @param {Object} event  対象グルコン
 * @param {boolean} notify Chatworkに送信するか
 */
function runDigest_(event, notify) {
  const w = getCollectionWindow_(event.date);
  logInfo_('対象グルコン：' + formatDateJa_(event.date)
    + ' ／ 収録期間：' + formatDate_(w.start, 'M/d HH:mm') + ' 〜 ' + formatDate_(w.end, 'M/d HH:mm'));

  const responses = readResponsesInWindow_(w.start, w.end);
  const result = buildGroups_(responses);
  const docInfo = buildDigestDocument_(event, result);

  logInfo_('ドキュメント：' + docInfo.title + ' → ' + docInfo.url);
  logInfo_('回答 ' + result.stats.responseCount + '件 ／ 質問者 ' + result.stats.personCount
    + '名 ／ 掲載 ' + result.stats.questionCount + '件');
  result.notes.forEach(function (n) { logInfo_('・' + n); });

  if (notify) {
    sendChatwork_(buildNotificationMessage_(event, result, docInfo));
  }
  return { result: result, docInfo: docInfo };
}

/** 指定日より後の最初のグルコンを返す */
function findEventAfter_(date) {
  const base = startOfDay_(date).getTime();
  const events = listTargetEvents_();
  for (var i = 0; i < events.length; i++) {
    if (startOfDay_(events[i].date).getTime() > base) return events[i];
  }
  return null;
}

// ── 二重送信ガード ────────────────────────────────────────

function doneKey_(eventDate) { return 'DIGEST_DONE_' + formatDate_(eventDate, 'yyyyMMdd'); }
function isDone_(eventDate) {
  return PropertiesService.getScriptProperties().getProperty(doneKey_(eventDate)) === '1';
}
function setDoneFlag_(eventDate) {
  PropertiesService.getScriptProperties().setProperty(doneKey_(eventDate), '1');
}
function clearDoneFlag_(eventDate) {
  PropertiesService.getScriptProperties().deleteProperty(doneKey_(eventDate));
}

// ─────────────────────────────────────────────────────────
//  手動実行用（エディタの「実行」から呼べます）
// ─────────────────────────────────────────────────────────

/** 次回グルコンの質問まとめを今すぐ作る（Chatworkには送らない：動作確認用） */
function manualBuildPreview() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のグルコンが日程シートに見つかりません。');
  const out = runDigest_(event, false);
  logInfo_('▼プレビュー用に作成しました（Chatwork未送信）\n' + out.docInfo.url);
  logInfo_('▼送信されるはずのメッセージ:\n' + buildNotificationMessage_(event, out.result, out.docInfo));
  return out.docInfo.url;
}

/** 次回グルコンの質問まとめを作り、Chatworkにも送る */
function manualBuildAndNotify() {
  const event = findNextEvent_();
  if (!event) throw new Error('今日以降のグルコンが日程シートに見つかりません。');
  const out = runDigest_(event, true);
  setDoneFlag_(event.date);
  return out.docInfo.url;
}

/** 手動でフォームを開く */
function manualOpenForm() { openForm_(); showStatus(); }

/** 手動でフォームを閉じる */
function manualCloseForm() { closeForm_(); showStatus(); }
