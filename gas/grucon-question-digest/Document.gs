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
  const folderName = getProfile_().folderName;
  const termFolder = getOrCreateFolder_(root, term, createdLog);
  const eventFolder = getOrCreateFolder_(termFolder, folderName, createdLog);
  return {
    folder: eventFolder,
    path: root.getName() + ' / ' + term + ' / ' + folderName,
    term: term,
  };
}

/** ドキュメントのファイル名（例: "8/20グルコン" / "8/21ビギナーグルコン"） */
function buildDocTitle_(eventDate) {
  return formatDate_(eventDate, CONFIG.DOC.TITLE_FORMAT) + getProfile_().titleSuffix;
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
 * @param {Object} event  対象グルコン
 * @param {Object} result buildGroups_() の結果
 * @param {string=} titleOverride ファイル名を指定したいとき（テスト用）
 * @return {{url: string, title: string, path: string, createdFolders: Array<string>, isNew: boolean}}
 */
function buildDigestDocument_(event, result, titleOverride) {
  const createdFolders = [];
  const target = resolveTargetFolder_(createdFolders);
  const title = titleOverride || buildDocTitle_(event.date);

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
    if (gi > 0) appendBlanks_(body, D.BLANK_LINES_BETWEEN_PEOPLE);

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
        appendBlanks_(body, D.BLANK_LINES_BEFORE_ADDENDUM);
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

/** 空行を指定した数だけ追加 */
function appendBlanks_(body, count) {
  const n = (typeof count === 'number' && count >= 0) ? count : 1;
  for (var i = 0; i < n; i++) appendBlank_(body);
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
