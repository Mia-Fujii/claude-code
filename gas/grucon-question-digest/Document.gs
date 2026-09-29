/**
 * Googleドキュメントの生成
 *   保存先: Shine A Light講座 / {期} / グルコン / 8/20グルコン
 */

/** 親フォルダの下から名前でフォルダを探す。無ければ作る。 */
function getOrCreateFolder_(parent, name, createdLog) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  const created = parent.createFolder(name);
  if (createdLog) createdLog.push(name);
  logInfo_('フォルダを新規作成しました: ' + name);
  return created;
}

/**
 * 保存先フォルダを用意する。
 *   mode 'term' … ルート / {期} / {name}        例: Shine A Light講座 / 21期 / グルコン
 *   mode 'year' … ルート / {開催年}年度 / {name} 例: 親フォルダ / 2026年度
 * name が空なら、その1階層は掘りません。
 */
function resolveTargetFolder_(createdLog, eventDate) {
  const profile = getProfile_();
  const spec = profile.folder;
  if (!spec || !spec.rootFolderId) {
    throw new Error('保存先フォルダ（folder.rootFolderId）が設定されていません。');
  }
  const root = DriveApp.getFolderById(spec.rootFolderId);

  var middle;
  if (spec.mode === 'year') {
    if (!eventDate) throw new Error('年フォルダを決めるための開催日がありません。');
    // 1月1日〜12月31日で切り替わります
    middle = formatDate_(eventDate, 'yyyy') + (spec.yearSuffix || '年度');
  } else {
    middle = getTermName_();          // 例: 21期
  }

  var folder = getOrCreateFolder_(root, middle, createdLog);
  var path = root.getName() + ' / ' + middle;

  if (spec.name) {
    folder = getOrCreateFolder_(folder, spec.name, createdLog);
    path += ' / ' + spec.name;
  }

  return { folder: folder, path: path, term: middle };
}

/** ドキュメントのファイル名（例: "9/15グルコン" / "2026/10/6活動報告＆質問"） */
function buildDocTitle_(eventDate) {
  const profile = getProfile_();
  return formatDate_(eventDate, profile.titleFormat) + profile.titleSuffix;
}

/** 同名のドキュメントがあればそれを使い、無ければ作る */
function getOrCreateDoc_(folder, title) {
  const it = folder.getFilesByName(title);
  while (it.hasNext()) {
    const file = it.next();
    if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
      return { doc: DocumentApp.openById(file.getId()), created: false };
    }
  }
  const doc = DocumentApp.create(title);
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  return { doc: doc, created: true };
}

/**
 * まとめドキュメントを作成（既存があれば中身を作り直す）
 *
 * @param {Object} event  対象イベント
 * @param {Object} built  buildSections_() の結果
 * @param {string=} titleOverride ファイル名を指定したいとき（テスト用）
 * @return {{url, title, path, term, createdFolders, isNew, sharing}}
 */
function buildDigestDocument_(event, built, titleOverride) {
  const createdFolders = [];
  const target = resolveTargetFolder_(createdFolders, event.date);
  const title = titleOverride || buildDocTitle_(event.date);

  const res = getOrCreateDoc_(target.folder, title);
  const doc = res.doc;
  const body = doc.getBody();

  // 何度実行しても増殖しないよう、いったん中身を空にする
  body.clear();

  const D = CONFIG.DOC;
  const sections = built.sections;
  const anyContent = sections.some(function (sec) { return sec.result.groups.length > 0; });

  if (!anyContent) {
    appendLine_(body, 'この期間に回答はありませんでした。');
  }

  var wroteSomething = false;
  sections.forEach(function (sec) {
    // 区切りが複数あるとき、中身が無い区切りは見出しごと省く
    if (sections.length > 1 && sec.result.groups.length === 0) return;

    if (wroteSomething) {
      appendBlanks_(body, D.BLANK_LINES_BETWEEN_SECTIONS);
      if (D.SECTION_DIVIDER) {
        body.appendHorizontalRule();
        appendBlank_(body);
      }
    }

    if (sec.heading) {
      appendHeading_(body, sec.heading);
      appendBlank_(body);
    }

    sec.result.groups.forEach(function (g, gi) {
      if (gi > 0) appendBlanks_(body, D.BLANK_LINES_BETWEEN_PEOPLE);

      // ── お名前（少し大きく・太字・黄色背景） ──
      const namePara = body.appendParagraph(g.displayName);
      applyHeadingLevel_(namePara, D.NAME_AS_HEADING ? D.NAME_HEADING_LEVEL : 'NORMAL');
      namePara.editAsText()
              .setFontFamily(D.FONT_FAMILY)
              .setFontSize(D.NAME_FONT_SIZE)
              .setBold(D.NAME_BOLD)
              .setForegroundColor(D.NAME_COLOR)
              .setBackgroundColor(D.NAME_HIGHLIGHT);

      // ── 本文 ──
      g.entries.forEach(function (entry, ei) {
        if (ei > 0) {
          appendBlanks_(body, D.BLANK_LINES_BEFORE_ADDENDUM);
          appendLine_(body, D.ADDENDUM_LABEL);
        }
        appendBodyText_(body, entry.question);
      });
    });

    wroteSomething = true;
  });

  if (D.INCLUDE_NOTES && built.notes.length > 0) {
    appendBlanks_(body, D.BLANK_LINES_BETWEEN_SECTIONS);
    appendLine_(body, '──────────');
    appendLine_(body, '■ 自動処理メモ');
    built.notes.forEach(function (n) { appendLine_(body, '・' + n); });
  }

  // 先頭に残る空段落を掃除する
  cleanupLeadingEmpty_(body);

  doc.saveAndClose();

  const sharing = applySharing_(doc.getId());

  return {
    url: doc.getUrl(),
    title: title,
    path: target.path,
    term: target.term,
    createdFolders: createdFolders,
    isNew: res.created,
    sharing: sharing,
  };
}

/**
 * ドキュメントを「リンクを知っている全員が閲覧可」にする。
 * 会社アカウントのポリシーで外部共有が禁止されている場合は失敗するため、
 * 失敗しても処理は止めず、結果を返して通知に載せます。
 */
function applySharing_(fileId) {
  if (!CONFIG.DOC.SHARE_ANYONE_WITH_LINK) {
    return { changed: false, ok: true, label: 'フォルダの共有設定を引き継ぎ' };
  }
  try {
    DriveApp.getFileById(fileId)
      .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    logInfo_('共有設定：リンクを知っている全員が閲覧可');
    return { changed: true, ok: true, label: 'リンクを知っている全員が閲覧可' };
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.warn('共有設定の変更に失敗しました: ' + msg);
    return { changed: true, ok: false, label: '⚠ 共有設定の変更に失敗（' + msg + '）' };
  }
}

/**
 * 区切りの見出しを追加する。
 * Googleドキュメントの見出しスタイルにすることで、概要パネルに目次として出ます。
 * 見出しスタイルは既定の書式を持つため、そのあとで書式を上書きしています。
 */
function appendHeading_(body, text) {
  const D = CONFIG.DOC;
  const p = body.appendParagraph(text);
  applyHeadingLevel_(p, D.HEADING_LEVEL);
  p.editAsText()
   .setFontFamily(D.FONT_FAMILY)
   .setFontSize(D.HEADING_FONT_SIZE)
   .setBold(D.HEADING_BOLD)
   .setForegroundColor(D.HEADING_COLOR)
   .setBackgroundColor(null);
  return p;
}

/** 段落に見出しレベルを設定する（'NORMAL' や未知の値なら本文扱い） */
function applyHeadingLevel_(paragraph, level) {
  const headings = DocumentApp.ParagraphHeading;
  const target = (level && headings[level]) ? headings[level] : headings.NORMAL;
  paragraph.setHeading(target);
  return paragraph;
}

/** 空行を指定した数だけ追加 */
function appendBlanks_(body, count) {
  const n = (typeof count === 'number' && count >= 0) ? count : 1;
  for (var i = 0; i < n; i++) appendBlank_(body);
}

/** 空行を1つ追加 */
function appendBlank_(body) {
  const p = body.appendParagraph('');
  applyHeadingLevel_(p, 'NORMAL');
  p.editAsText().setFontFamily(CONFIG.DOC.FONT_FAMILY).setFontSize(CONFIG.DOC.BODY_FONT_SIZE);
  return p;
}

/** 1行を本文書式で追加 */
function appendLine_(body, line) {
  const p = body.appendParagraph(line);
  applyHeadingLevel_(p, 'NORMAL');
  const t = p.editAsText();
  t.setFontFamily(CONFIG.DOC.FONT_FAMILY)
   .setFontSize(CONFIG.DOC.BODY_FONT_SIZE)
   .setBold(false)
   .setBackgroundColor(null);
  return p;
}

/**
 * 複数行の本文を、改行を保ったまま追加する。
 * 本文中のURLは自動でリンクにします。
 */
function appendBodyText_(body, text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  lines.forEach(function (line) {
    const p = appendLine_(body, line);
    if (!line) return;
    const t = p.editAsText();
    findUrls_(line).forEach(function (u) {
      t.setLinkUrl(u.start, u.end, u.url);
    });
  });
}

/** body.clear() 直後に残る空段落を取り除く */
function cleanupLeadingEmpty_(body) {
  while (body.getNumChildren() > 1) {
    const first = body.getChild(0);
    if (first.getType() === DocumentApp.ElementType.PARAGRAPH &&
        first.asParagraph().getText() === '') {
      body.removeChild(first);
    } else {
      break;
    }
  }
}
