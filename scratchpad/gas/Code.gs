/**
 * Shine A Light 20期 事務局オートメーション (v4)
 *
 * ・イベント日の5日前に「3日前・前日・当日・アーカイブ」4本を一気に下書き
 * ・メールセット(質問募集)はその予定日に単独で下書き
 * ・Chatworkに未読①付きで報告、TODO付き
 * ・動画配信メールに次回動画配信日/次回キャッチアップWed情報を自動挿入
 */

// ============= 定数 =============
const CONFIG_SHEET   = '基本設定';
const SCHEDULE_SHEET = 'スケジュール';
const TEMPLATE_SHEET = 'メールテンプレート';
const TZ = 'Asia/Tokyo';
const YOBI = ['日', '月', '火', '水', '木', '金', '土'];

const OFFICE_EMAIL = 'shinealightonlineschool@gmail.com';

const BATCH_TIMINGS = ['3日前', '前日', '当日', 'アーカイブ'];
const BATCH_DAYS_BEFORE = 5;

const COL = {
  content: 0, date: 1, dateShort: 2, startTime: 3, endTime: 4, manager: 5,
  dMailSet: 6, d3Days: 7, dDayBefore: 8, dQuestion: 9, dDayOf: 10, dArchive: 11,
  zoomSource: 12, zoomUrl: 13, meetingId: 14, status: 15,
};


// ============= メインエントリ =============

function runDaily() {
  const r = processToday(false);
  Logger.log('runDaily 完了: %s件の下書き作成', r.created.length);
}

function dryRunToday() {
  const r = processToday(true);
  Logger.log('DryRun 結果: %s件', r.planned.length);
  r.planned.forEach(p => Logger.log('  [%s] %s / %s → %s', p.today, p.event, p.timing, p.subject));
}

function testForDate(yyyymmdd) {
  const r = processTargetDate(yyyymmdd, true);
  Logger.log('%s のシミュレーション: %s件', yyyymmdd, r.planned.length);
  r.planned.forEach(p => Logger.log('  %s / %s → %s', p.event, p.timing, p.subject));
}


// ============= テスト用ショートカット =============

function test_todayDryRun()          { dryRunToday(); }
function test_0620_grulconBatch()    { testForDate('2026-06-20'); }
function test_0610_1stLecture()      { testForDate('2026-06-10'); }  // 第1回動画配信 6/15 5日前
function test_0612_catchWedBatch()   { testForDate('2026-06-12'); }
function test_0614_beginnerBatch()   { testForDate('2026-06-14'); }

// 本番実行用ショートカット
function run_0620_grulconBatch()     { processTargetDate('2026-06-20', false); }
function run_0610_1stLecture()       { processTargetDate('2026-06-10', false); }  // 第1回動画配信 6/15
function run_0624_2ndLecture()       { processTargetDate('2026-06-24', false); }  // 第2回動画配信 6/29
function run_0708_3rdLecture()       { processTargetDate('2026-07-08', false); }  // 第3回動画配信 7/13
function run_0722_4thLecture()       { processTargetDate('2026-07-22', false); }  // 第4回動画配信 7/27
function run_0805_5thLecture()       { processTargetDate('2026-08-05', false); }  // 第5回動画配信 8/10
function run_0819_6thLecture()       { processTargetDate('2026-08-19', false); }  // 第6回動画配信 8/24


// ============= 処理本体 =============

function processToday(dryRun) {
  return processTargetDate(todayStr(), dryRun);
}

function processTargetDate(dateStr, dryRun) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = loadConfig(ss);
  const templates = loadTemplates(ss);
  const events = loadSchedule(ss);
  const today = parseDate(dateStr);
  const planned = [];
  const created = [];

  for (const event of events) {
    if (!(event.date instanceof Date)) continue;

    const daysUntil = daysDiff(today, event.date);
    if (daysUntil === BATCH_DAYS_BEFORE) {
      const drafts = buildBatchDrafts(event, templates, config, events);
      if (drafts.length > 0) {
        drafts.forEach(d => planned.push({
          today: dateStr, event: event.content, timing: d.timing, subject: d.populated.subject,
        }));
        if (!dryRun) {
          drafts.forEach(d => created.push(createGmailDraft(d.populated, config)));
          notifyChatworkBatch(event, drafts, config);
        }
      }
    }

    if (event.dMailSet instanceof Date && sameDay(event.dMailSet, today)) {
      const tpl = findTemplate(templates, event.content, 'メールセット');
      if (tpl) {
        const populated = populateTemplate(tpl, event, config, events);
        const flags = detectFlags(tpl, event);
        planned.push({
          today: dateStr, event: event.content, timing: 'メールセット', subject: populated.subject,
        });
        if (!dryRun) {
          created.push(createGmailDraft(populated, config));
          notifyChatworkSingle(event, 'メールセット', populated.subject, flags, config);
        }
      }
    }
  }
  return { planned, created };
}

function buildBatchDrafts(event, templates, config, allEvents) {
  const drafts = [];
  for (const timing of BATCH_TIMINGS) {
    const tpl = findTemplate(templates, event.content, timing);
    if (!tpl) continue;
    const populated = populateTemplate(tpl, event, config, allEvents);
    const flags = detectFlags(tpl, event);
    const scheduledDate = getScheduledDate(event, timing);
    drafts.push({ timing, populated, flags, scheduledDate });
  }
  return drafts;
}

function getScheduledDate(event, timing) {
  return ({
    '3日前': event.d3Days,
    '前日': event.dDayBefore,
    '当日': event.dDayOf,
    'アーカイブ': event.dArchive,
    'メールセット': event.dMailSet,
  })[timing];
}


// ============= 読み込み =============

function loadConfig(ss) {
  const sheet = ss.getSheetByName(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();
  const config = {};
  for (const row of values) {
    const key = row[0];
    if (typeof key === 'string' && key.trim() && !key.startsWith('──')) {
      config[key.trim()] = row[1];
    }
  }
  return config;
}

function loadTemplates(ss) {
  const sheet = ss.getSheetByName(TEMPLATE_SHEET);
  const values = sheet.getDataRange().getValues();
  const templates = [];
  for (let i = 1; i < values.length; i++) {
    const [content, timing, subject, body] = values[i];
    if (!content || !timing) continue;
    templates.push({
      content: String(content).trim(),
      timing: String(timing).trim(),
      subject: subject || '',
      body: body || '',
    });
  }
  return templates;
}

function loadSchedule(ss) {
  const sheet = ss.getSheetByName(SCHEDULE_SHEET);
  const values = sheet.getDataRange().getValues();
  const events = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[COL.content]) continue;
    events.push({
      rowIndex:   i + 1,
      content:    String(row[COL.content]).trim(),
      date:       row[COL.date],
      dateShort:  row[COL.dateShort] || '',
      startTime:  row[COL.startTime],
      endTime:    row[COL.endTime],
      manager:    row[COL.manager] || '',
      dMailSet:   row[COL.dMailSet],
      d3Days:     row[COL.d3Days],
      dDayBefore: row[COL.dDayBefore],
      dQuestion:  row[COL.dQuestion],
      dDayOf:     row[COL.dDayOf],
      dArchive:   row[COL.dArchive],
      zoomSource: row[COL.zoomSource],
      zoomUrl:    row[COL.zoomUrl],
      meetingId:  row[COL.meetingId],
      status:     row[COL.status],
    });
  }
  return events;
}


// ============= テンプレート適用 =============

function findTemplate(templates, content, timing) {
  const target = normalize(content);
  return templates.find(t => normalize(t.content) === target && t.timing === timing);
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, '').trim();
}

function findNextEventByPattern(events, afterDate, pattern) {
  return events
    .filter(e => e.date instanceof Date && e.date > afterDate && pattern.test(e.content))
    .sort((a, b) => a.date - b.date)[0];
}

function populateTemplate(tpl, event, config, allEvents) {
  const startHour = parseHour(event.startTime);
  const endHour   = parseHour(event.endTime);

  // 次回イベント検索(動画配信メールで使用)
  const nextLecture = allEvents ? findNextEventByPattern(allEvents, event.date, /動画配信/) : null;
  const nextCatchupWed = allEvents ? findNextEventByPattern(allEvents, event.date, /キャッチアップウェンズデー/) : null;

  const vars = {
    '期':                 config['期'] ? String(config['期']).replace(/期$/, '') : '',
    '日程':               formatJPDate(event.date),
    '日程月日':           formatMonthDay(event.date),
    '日程短':             event.dateShort || formatShortDate(event.date),
    '開始時':             startHour != null ? `${startHour}時` : '',
    '開始時H':            startHour != null ? String(startHour) : '',
    '時間帯':             formatTimeRange(startHour, endHour),
    '担当者':             event.manager,
    'zoomリンク':         resolveZoomUrl(event, config),
    '事前フォームURL':    resolveFormUrlByEvent(event, config),
    '会員サイト':         config['会員サイト'] || '',
    '課題提出先リンクまとめ': config['課題提出先リンクまとめURL'] || '',
    'フォーム締切表記':   formatFormDeadline(event.date),
    'イベント名':         event.content,
    '次回動画配信日':     nextLecture ? formatJPDate(nextLecture.date) : '',
    '次回キャッチアップウェンズデー詳細': formatCatchupWedDetail(nextCatchupWed),
    '第1回目動画配信日':  config['第1回目動画配信日'] || '',
    '第1回動画配信3日後': config['第1回動画配信3日後'] || '',
  };
  return { subject: substitute(tpl.subject, vars), body: substitute(tpl.body, vars) };
}

function formatCatchupWedDetail(ev) {
  if (!ev) return '';
  const dateStr = formatJPDate(ev.date);
  const timeStr = formatTimeRangeWithMinutes(ev.startTime, ev.endTime);
  return `${dateStr}${timeStr}`;
}

function substitute(s, vars) {
  return String(s || '').replace(/\{\{([^}]+)\}\}/g, (m, key) => {
    const k = key.trim();
    return vars[k] !== undefined ? String(vars[k]) : m;
  });
}

function detectFlags(tpl, event) {
  const body = String(tpl.body || '');
  return {
    hasForm: /\{\{事前フォームURL\}\}/.test(body),
    isLecture: /動画配信/.test(event.content),
  };
}

function resolveZoomUrl(event, config) {
  const src = String(event.zoomSource || '').trim();
  const combine = (url, id) => id ? `${url}\n\nミーティングID: ${id}` : url;
  switch (src) {
    case '若菜グルコン共通':
      return combine(config['グルコン共通ZoomURL'] || '', config['グルコン共通ミーティングID'] || '');
    case '若菜マンデー共通':
      return combine(config['キャッチアップマンデー共通ZoomURL'] || '', config['キャッチアップマンデー共通ミーティングID'] || '');
    case '個別':
      return combine(event.zoomUrl || '', event.meetingId || '');
    case '未定(サポート講師待ち)':
      return event.zoomUrl
        ? combine(event.zoomUrl, event.meetingId)
        : '⚠️ Zoomリンク未入力(サポート講師から取得してください)';
    case 'Zoomなし':
      return '';
    default:
      return combine(event.zoomUrl || '', event.meetingId || '');
  }
}

function resolveFormUrlByEvent(event, config) {
  const c = String(event.content || '');
  if (c.includes('ビギナー')) return config['ビギナーグルコン事前フォームURL'] || '';
  if (c.includes('作業会'))   return config['課題作業会事前フォームURL'] || '';
  if (c === 'グルコン')       return config['グルコン事前フォームURL'] || '';
  return '';
}


// ============= 日付/時刻ユーティリティ =============

function parseHour(t) {
  if (t instanceof Date) return t.getHours();
  const s = String(t || '');
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseTimeParts(t) {
  if (t instanceof Date) return { hour: t.getHours(), minute: t.getMinutes() };
  const s = String(t || '');
  const m = s.match(/(\d+)[:：](\d+)/);
  if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
  const m2 = s.match(/(\d+)/);
  return m2 ? { hour: parseInt(m2[1], 10), minute: 0 } : null;
}

function formatHourMin(hour, minute) {
  if (hour == null) return '';
  return minute > 0 ? `${hour}時${minute}分` : `${hour}時`;
}

function formatTimeRangeWithMinutes(startTime, endTime) {
  const s = parseTimeParts(startTime);
  if (!s) return '';
  const e = parseTimeParts(endTime);
  const startPart = formatHourMin(s.hour, s.minute);
  if (!e) return `${startPart}〜`;
  const endPart = formatHourMin(e.hour, e.minute);
  return `${startPart}〜${endPart}`;
}

function formatJPDate(d) {
  if (!(d instanceof Date)) return String(d || '');
  return `${d.getMonth() + 1}月${d.getDate()}日（${YOBI[d.getDay()]}）`;
}

function formatShortDate(d) {
  if (!(d instanceof Date)) return String(d || '');
  return `${d.getMonth() + 1}/${d.getDate()}（${YOBI[d.getDay()]}）`;
}

function formatMonthDay(d) {
  if (!(d instanceof Date)) return String(d || '');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTimeRange(startHour, endHour) {
  if (startHour == null) return '';
  return endHour != null ? `${startHour}時〜${endHour}時` : `${startHour}時〜`;
}

function formatFormDeadline(eventDate) {
  if (!(eventDate instanceof Date)) return '';
  const d = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() - 1);
  return `${d.getMonth() + 1}月${d.getDate()}日（${YOBI[d.getDay()]}）お昼12時`;
}

function fmtDate(d) {
  if (d instanceof Date) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return String(d || '').trim();
}

function todayStr() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('parseDate: 日付文字列が必要。実行ドロップダウンからは test_ 系のショートカット関数を選んでください。');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysDiff(from, to) {
  const MS = 86400000;
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(),   to.getMonth(),   to.getDate());
  return Math.round((t - f) / MS);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}


// ============= HTMLify (URLを自動でリンク化) =============

function htmlify(text) {
  const escaped = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const withLinks = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return withLinks.replace(/\n/g, '<br>');
}


// ============= Gmail 下書き =============

function createGmailDraft(populated, config) {
  const senderName = config['事務局差出人名'] || 'Shine A Light 運営事務局';
  const draft = GmailApp.createDraft(
    OFFICE_EMAIL,
    populated.subject,
    populated.body,
    {
      name: senderName,
      htmlBody: htmlify(populated.body),
    }
  );
  Logger.log('下書き作成: %s', populated.subject);
  return draft;
}


// ============= Chatwork 通知 =============

function notifyChatworkBatch(event, drafts, config) {
  const token = PropertiesService.getScriptProperties().getProperty('CHATWORK_TOKEN');
  if (!token) { Logger.log('⚠️ CHATWORK_TOKEN 未設定'); return; }
  const roomId = config['Chatwork ルームID(事務局)'];
  const mention = config['Chatwork メンション先'] || '';
  if (!roomId) { Logger.log('⚠️ Chatwork ルームID 未設定'); return; }

  const anyForm    = drafts.some(d => d.flags.hasForm);
  const anyLecture = drafts.some(d => d.flags.isLecture);
  const todos = [];
  if (anyForm)    todos.push('・フォームを公開してください');
  if (anyLecture) todos.push('・Facebookリンクを挿入してください');
  todos.push('・BCCに受講生を入れて送信予約してください');

  const list = drafts.map((d, i) => {
    const s = d.scheduledDate instanceof Date
      ? ` (送信予定 ${formatJPDate(d.scheduledDate)})` : '';
    return `${i + 1}. ${d.timing}${s} - ${d.populated.subject}`;
  }).join('\n');

  const body =
    `${mention}\n` +
    `[info][title]📧 下書き ${drafts.length}本作成: ${event.content} ${formatJPDate(event.date)}[/title]` +
    `イベント: ${event.content}\n` +
    `開催日: ${formatJPDate(event.date)}\n\n` +
    `作成した下書き:\n${list}\n\n` +
    `▼下書きを確認\n` +
    `https://mail.google.com/mail/u/0/#drafts\n\n` +
    `■ TODO\n${todos.join('\n')}` +
    `[/info]`;

  postChatwork(token, roomId, body);
}

function notifyChatworkSingle(event, timing, subject, flags, config) {
  const token = PropertiesService.getScriptProperties().getProperty('CHATWORK_TOKEN');
  if (!token) return;
  const roomId = config['Chatwork ルームID(事務局)'];
  const mention = config['Chatwork メンション先'] || '';
  if (!roomId) return;

  const todos = [];
  if (flags.hasForm)    todos.push('・フォームを公開してください');
  if (flags.isLecture)  todos.push('・Facebookリンクを挿入してください');
  todos.push('・BCCに受講生を入れて送信予約してください');

  const body =
    `${mention}\n` +
    `[info][title]📧 下書き作成: ${event.content} - ${timing}[/title]` +
    `イベント: ${event.content}\n` +
    `開催日: ${formatJPDate(event.date)}\n` +
    `タイミング: ${timing}\n` +
    `件名: ${subject}\n\n` +
    `▼下書きを確認\n` +
    `https://mail.google.com/mail/u/0/#drafts\n\n` +
    `■ TODO\n${todos.join('\n')}` +
    `[/info]`;

  postChatwork(token, roomId, body);
}

function postChatwork(token, roomId, body) {
  const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'X-ChatWorkToken': token },
    payload: { body: body, self_unread: '1' },
    muteHttpExceptions: true,
  });
  Logger.log('Chatwork送信結果: %s', res.getResponseCode());
}


// ============= トリガー管理 =============

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDaily') {
      ScriptApp.deleteTrigger(t);
      Logger.log('既存トリガー削除');
    }
  });
  ScriptApp.newTrigger('runDaily')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log('✅ 毎朝7時トリガー設定完了');
}

function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) { Logger.log('トリガーはまだ設定されていません'); return; }
  triggers.forEach(t => Logger.log('関数: %s / タイプ: %s', t.getHandlerFunction(), t.getEventType()));
}

function deleteDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDaily') {
      ScriptApp.deleteTrigger(t);
      Logger.log('runDailyトリガー削除完了');
    }
  });
}
