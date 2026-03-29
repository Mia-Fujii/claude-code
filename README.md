# Gmail → Slack → AI返信下書き 自動化

重要メール（請求書・契約書など）をSlackに通知し、ボタン一つでAI返信下書きをGmailに作成するGASスクリプトです。

## フロー

```
Gmail（重要メール受信）
    ↓ GAS定期実行（5分ごと）
Slack通知（件名・送信者・本文抜粋 + ボタン）
    ↓ 「AI返信下書き作成」ボタンを押す
GAS Webアプリ（doPost受信）
    ↓ Claude APIで返信文生成
Gmail下書き保存 → Slackに完了通知
```

## セットアップ手順

### 1. Slack Appの作成

1. [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. **OAuth & Permissions** → Bot Token Scopes に以下を追加:
   - `chat:write`
   - `chat:write.public`
3. **Install to Workspace** → Bot User OAuth Token (`xoxb-...`) をコピー
4. **Interactivity & Shortcuts** は後でGASのWebアプリURLを設定（手順4参照）

### 2. GASプロジェクトの作成

1. [https://script.google.com](https://script.google.com) → **新しいプロジェクト**
2. `gas/Code.gs` の内容をエディタに貼り付け
3. `appsscript.json`（プロジェクトの設定 → マニフェストファイルを表示）を `gas/appsscript.json` の内容で置き換え

### 3. スクリプトプロパティの設定

GASエディタ → **プロジェクトの設定** → **スクリプトプロパティ** に以下を追加:

| プロパティ名 | 値 |
|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-...`（Slack Bot Token） |
| `SLACK_CHANNEL_ID` | 通知先チャンネルのID（例: `C0XXXXXXXX`） |
| `GEMINI_API_KEY` | Google AI Studio APIキー（無料取得: https://aistudio.google.com/app/apikey） |

### 4. GASをWebアプリとしてデプロイ

1. GASエディタ → **デプロイ** → **新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 次のユーザーとして実行: **自分**
4. アクセスできるユーザー: **全員**
5. デプロイ → **ウェブアプリのURL** をコピー

### 5. SlackにWebアプリURLを設定

1. Slack App設定 → **Interactivity & Shortcuts**
2. **Interactivity** をオン
3. **Request URL** に手順4でコピーしたGAS WebアプリURLを貼り付け
4. **Save Changes**

### 6. タイマートリガーの設定

GASエディタで `setupTrigger` 関数を手動実行（一度だけ）

### 7. 動作確認

`checkConfiguration` 関数を実行して設定を確認してください。

## 検出キーワード

`Code.gs` の `KEYWORDS` 配列を編集することで、検出するキーワードをカスタマイズできます。

```javascript
const KEYWORDS = [
  '請求書', '請求', 'invoice',
  '契約書', '契約', 'contract',
  // 追加したいキーワードをここに
];
```

## 注意事項

- GAS WebアプリはHTTPS必須のため、そのままSlackに設定可能です
- Slackのインタラクションは3秒以内にレスポンスが必要です（GASは即時200 OKを返し、処理は続行します）
- Gemini APIは無料枠あり（Gemini 2.0 Flash: 15リクエスト/分、1500リクエスト/日）
- APIキーは https://aistudio.google.com/app/apikey で無料取得できます
- Gmail下書きはGmailの「下書き」フォルダに保存されます
