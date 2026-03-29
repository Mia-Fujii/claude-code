#!/usr/bin/env python3
"""
毎朝7時 AIニュース日報 → Discord送信スクリプト
"""

import os
import json
import time
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import anthropic

# ── 設定 ──────────────────────────────────────────
DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1487313629920493588/oO9y9B7NWV0_BfCK2DAz4pmwKbuTQxK6nFQGW_-kq36alizAUzvxZZK8e4xCSNLDozot"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

JST = timezone(timedelta(hours=9))

# AIニュース RSS フィード一覧
RSS_FEEDS = [
    ("TechCrunch AI",      "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI",       "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("VentureBeat AI",     "https://venturebeat.com/category/ai/feed/"),
    ("MIT Tech Review",    "https://www.technologyreview.com/feed/"),
    ("Wired AI",           "https://www.wired.com/feed/tag/ai/latest/rss"),
    ("ArsTechnica AI",     "https://feeds.arstechnica.com/arstechnica/technology-lab"),
    ("AI News",            "https://www.artificialintelligence-news.com/feed/"),
]


def fetch_rss(feed_name: str, url: str, max_items: int = 7) -> list[dict]:
    """RSSフィードから最新記事を取得"""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

        # RSS 2.0 と Atom 両対応
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//atom:entry", ns)

        results = []
        for item in items[:max_items]:
            title = (item.findtext("title") or
                     item.findtext("atom:title", namespaces=ns) or "").strip()
            link  = (item.findtext("link") or
                     item.findtext("atom:link[@rel='alternate']", namespaces=ns) or
                     (item.find("atom:link", ns).get("href") if item.find("atom:link", ns) is not None else ""))
            desc  = (item.findtext("description") or
                     item.findtext("atom:summary", namespaces=ns) or
                     item.findtext("atom:content", namespaces=ns) or "")
            # HTMLタグ除去（簡易）
            import re
            desc = re.sub(r"<[^>]+>", "", desc)[:300]
            if title:
                results.append({"source": feed_name, "title": title, "link": link, "desc": desc})
        return results
    except Exception as e:
        print(f"[WARN] {feed_name}: {e}")
        return []


def collect_news(max_total: int = 40) -> list[dict]:
    """全フィードからニュースを収集"""
    all_articles = []
    for name, url in RSS_FEEDS:
        articles = fetch_rss(name, url)
        all_articles.extend(articles)
        if len(all_articles) >= max_total:
            break
    return all_articles[:max_total]


def summarize_with_claude(articles: list[dict]) -> str:
    """Claude APIで10件厳選・日本語要約"""
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY が設定されていません")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    articles_text = "\n\n".join(
        f"[{i+1}] 出典:{a['source']}\nタイトル:{a['title']}\n概要:{a['desc']}"
        for i, a in enumerate(articles)
    )

    prompt = f"""以下は今日収集したAIニュース記事一覧です（最大40件）。
この中から特に重要・注目度が高い10件を厳選し、日本語で要約してください。

厳選基準:
- 社会的インパクトや技術的革新性が高い
- 著名企業・研究機関による発表
- AIの安全性・倫理・規制に関する重要動向
- 実用化・製品リリースに関するニュース

各記事を以下の形式で出力してください（番号1〜10）:
【記事タイトル（日本語）】
・出典: [メディア名]
・要約: [2〜3文で核心を簡潔に説明]
・注目: [なぜ重要か1文で]

--- 記事一覧 ---
{articles_text}
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def split_into_parts(summaries: str, today_str: str) -> list[str]:
    """10件の要約を3パートに分割"""
    lines = summaries.strip().split("\n")

    # 番号付き記事ブロックに分割
    blocks = []
    current = []
    for line in lines:
        import re
        if re.match(r"^(1[0]|[1-9])[\.\】]", line) and current:
            blocks.append("\n".join(current).strip())
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current).strip())

    # 絵文字番号マップ
    emoji_nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]

    def add_emoji(block: str, idx: int) -> str:
        import re
        return re.sub(r"^[0-9]+[\.\】\s]?", f"{emoji_nums[idx]} ", block, count=1)

    numbered = [add_emoji(b, i) for i, b in enumerate(blocks[:10])]

    header = f"🤖 **AIニュース日報** - {today_str}\n\n📰 **本日のトップ10ニュース**\n"
    footer = "\n---\n*🕖 毎朝7時配信 | 過去24時間のAIニュースより厳選 | Powered by Claude*"

    part1 = header + "\n\n".join(numbered[0:3])
    part2 = "\n\n".join(numbered[3:7])
    part3 = "\n\n".join(numbered[7:10]) + footer

    return [part1, part2, part3]


def send_to_discord(parts: list[str]) -> bool:
    """3パートをDiscordへ送信"""
    success = True
    for i, content in enumerate(parts, 1):
        if len(content) > 2000:
            print(f"[WARN] Part{i} が2000文字超 ({len(content)}文字)、末尾を切り詰めます")
            content = content[:1997] + "..."
        resp = requests.post(
            DISCORD_WEBHOOK,
            headers={"Content-Type": "application/json"},
            data=json.dumps({"content": content}),
            timeout=15,
        )
        if resp.status_code == 204:
            print(f"[OK] Part{i} 送信成功 (204)")
        else:
            print(f"[ERROR] Part{i} 送信失敗: {resp.status_code} {resp.text}")
            success = False
        time.sleep(1)
    return success


def main():
    jst_now = datetime.now(JST)
    today_str = jst_now.strftime("%Y年%-m月%-d日（%a）").replace(
        "Mon","月").replace("Tue","火").replace("Wed","水").replace(
        "Thu","木").replace("Fri","金").replace("Sat","土").replace("Sun","日")

    print(f"[{jst_now.strftime('%H:%M')}] AIニュース収集開始 — {today_str}")

    articles = collect_news(max_total=40)
    print(f"収集記事数: {len(articles)}")

    if not articles:
        print("[ERROR] 記事を取得できませんでした")
        return

    print("Claude APIで要約中...")
    summaries = summarize_with_claude(articles)

    parts = split_into_parts(summaries, today_str)
    print(f"送信パート数: {len(parts)}")

    send_to_discord(parts)
    print("完了")


if __name__ == "__main__":
    main()
