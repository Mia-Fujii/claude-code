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

/** 保存先フォルダ（Shine A Light講座 / {期} / グルコン）を用意する */
function resolveTargetFolder_(createdLog) {
  const rootId = cfg_('COURSE_ROOT_FOLDER_ID');
  if (!rootId) throw new Error('COURSE_ROOT_FOLDER_ID が設定されていません。');
  const root = DriveApp.getFolderById(rootId);
  const term = getTermName_();                       // 例: "21期"
  const termFolder = getOrCreateFolder_(root, term, createdLog);
  const gruconFolder = getOrCreateFolder_(termFolder, 'グルコン', createdLog);
  return {
    folder: gruconFolder,
    path: root.getName() + ' / ' + term + ' / グルコン',
    term: term,
  };
}

/** ドキュメントのファイル名（例: "8/20グルコン"） */
function buildDocTitle_(eventDate) {
  return formatDate_(eventDate, CONFIG.DOC.TITLE_FORMAT) + CONFIG.DOC.TITLE_SUFFIX;
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
 * 質問まとめドキュメントを作成（既存があれば中身を作り直す）
 * @return {{url: string, title: string, path: string, createdFolders: Array<string>, isNew: boolean}}
 */
function buildDigestDocument_(event, result) {
  const createdFolders = [];
  const target = resolveTargetFolder_(createdFolders);
  const title = buildDocTitle_(event.date);

  const res = getOrCreateDoc_(target.folder, title);
  const doc = res.doc;
  const body = doc.getBody();

  // 何度実行しても増殖しないよう、いったん中身を空にする
  body.clear();

  const D = CONFIG.DOC;

  if (result.groups.length === 0) {
    const p = body.appendParagraph('この期間に事前質問の回答はありませんでした。');
    p.editAsText().setFontFamily(D.FONT_FAMILY).setFontSize(D.BODY_FONT_SIZE);
  }

  result.groups.forEach(function (g, gi) {
    if (gi > 0) appendBlank_(body);

    // ── お名前（少し大きく・太字・黄色背景） ──
    const namePara = body.appendParagraph(g.displayName);
    const nameText = namePara.editAsText();
    nameText.setFontFamily(D.FONT_FAMILY)
            .setFontSize(D.NAME_FONT_SIZE)
            .setBold(D.NAME_BOLD)
            .setBackgroundColor(D.NAME_HIGHLIGHT);

    // ── 質問本文 ──
    g.entries.forEach(function (entry, ei) {
      if (ei > 0) {
        appendBlank_(body);
        appendLine_(body, D.ADDENDUM_LABEL);
      }
      appendBodyText_(body, entry.question);
    });
  });

  if (D.INCLUDE_NOTES && result.notes.length > 0) {
    appendBlank_(body);
    appendLine_(body, '──────────');
    appendLine_(body, '■ 自動処理メモ');
    result.notes.forEach(function (n) { appendLine_(body, '・' + n); });
  }

  // 先頭に残る空段落を掃除する
  cleanupLeadingEmpty_(body);

  doc.saveAndClose();

  return {
    url: doc.getUrl(),
    title: title,
    path: target.path,
    term: target.term,
    createdFolders: createdFolders,
    isNew: res.created,
  };
}

/** 空行を1つ追加 */
function appendBlank_(body) {
  const p = body.appendParagraph('');
  p.editAsText().setFontFamily(CONFIG.DOC.FONT_FAMILY).setFontSize(CONFIG.DOC.BODY_FONT_SIZE);
  return p;
}

/** 1行を本文書式で追加 */
function appendLine_(body, line) {
  const p = body.appendParagraph(line);
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
