#!/usr/bin/env python3
"""
毎朝7時 AIニュース日報 → Discord送信スクリプト（APIキー不要版）
"""

import json
import re
import time
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

# ── 設定 ──────────────────────────────────────────
DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1487313629920493588/oO9y9B7NWV0_BfCK2DAz4pmwKbuTQxK6nFQGW_-kq36alizAUzvxZZK8e4xCSNLDozot"

JST = timezone(timedelta(hours=9))

# AIニュース RSS フィード一覧
RSS_FEEDS = [
    ("TechCrunch AI",   "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI",    "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("VentureBeat AI",  "https://venturebeat.com/category/ai/feed/"),
    ("MIT Tech Review", "https://www.technologyreview.com/feed/"),
    ("Wired AI",        "https://www.wired.com/feed/tag/ai/latest/rss"),
    ("ArsTechnica AI",  "https://feeds.arstechnica.com/arstechnica/technology-lab"),
    ("AI News",         "https://www.artificialintelligence-news.com/feed/"),
]

EMOJI_NUMS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]


def translate_ja(text: str) -> str:
    """MyMemory無料APIで英語→日本語翻訳"""
    if not text:
        return text
    try:
        r = requests.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": "en|ja"},
            timeout=10,
        )
        result = r.json()["responseData"]["translatedText"]
        time.sleep(0.5)  # レート制限対策
        return result
    except Exception:
        return text  # 失敗時は元のテキストをそのまま返す


def fetch_rss(feed_name: str, url: str, max_items: int = 7) -> list[dict]:
    """RSSフィードから最新記事を取得"""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//atom:entry", ns)

        results = []
        for item in items[:max_items]:
            title = (item.findtext("title") or
                     item.findtext("atom:title", namespaces=ns) or "").strip()
            link  = (item.findtext("link") or
                     (item.find("atom:link", ns).get("href")
                      if item.find("atom:link", ns) is not None else ""))
            desc  = (item.findtext("description") or
                     item.findtext("atom:summary", namespaces=ns) or
                     item.findtext("atom:content", namespaces=ns) or "")
            desc = re.sub(r"<[^>]+>", "", desc).strip()
            # 概要は最初の100文字まで
            desc = desc[:100] + ("…" if len(desc) > 100 else "")
            if title:
                results.append({"source": feed_name, "title": title,
                                 "link": link, "desc": desc})
        return results
    except Exception as e:
        print(f"[WARN] {feed_name}: {e}")
        return []


def collect_news(max_total: int = 10) -> list[dict]:
    """全フィードから最新10件を収集"""
    all_articles = []
    for name, url in RSS_FEEDS:
        articles = fetch_rss(name, url, max_items=3)
        all_articles.extend(articles)
        if len(all_articles) >= max_total:
            break
    return all_articles[:max_total]


def build_parts(articles: list[dict], today_str: str) -> list[str]:
    """10件の記事を3パートに分割してフォーマット"""
    def fmt(i: int, a: dict) -> str:
        lines = [f"{EMOJI_NUMS[i]} **{a['title']}**",
                 f"・出典: {a['source']}"]
        if a["desc"]:
            lines.append(f"・概要: {a['desc']}")
        if a["link"]:
            lines.append(f"・URL: {a['link']}")
        return "\n".join(lines)

    blocks = [fmt(i, a) for i, a in enumerate(articles)]

    header = (f"🤖 **AIニュース日報** - {today_str}\n\n"
              f"📰 **本日のトップ{len(articles)}ニュース**\n")
    footer = "\n---\n*🕖 毎朝7時配信 | RSSより自動収集*"

    part1 = header + "\n\n".join(blocks[0:3])
    part2 = "\n\n".join(blocks[3:7])
    part3 = "\n\n".join(blocks[7:]) + footer

    return [p for p in [part1, part2, part3] if p.strip()]


def send_to_discord(parts: list[str]) -> bool:
    """3パートをDiscordへ送信"""
    success = True
    for i, content in enumerate(parts, 1):
        if len(content) > 2000:
            print(f"[WARN] Part{i} が2000文字超 ({len(content)}文字)、切り詰めます")
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

    articles = collect_news(max_total=10)
    print(f"収集記事数: {len(articles)}")

    if not articles:
        print("[ERROR] 記事を取得できませんでした")
        return

    print("日本語に翻訳中...")
    for a in articles:
        a["title"] = translate_ja(a["title"])
        a["desc"]  = translate_ja(a["desc"]) if a["desc"] else ""

    parts = build_parts(articles, today_str)
    send_to_discord(parts)
    print("完了")


if __name__ == "__main__":
    main()
