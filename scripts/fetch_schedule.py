#!/usr/bin/env python3
"""YouTubeチャンネルの「配信予定（upcoming）」を取得して schedule.json に書き出す。
GitHub Actions から定期実行される。APIキーは環境変数 YOUTUBE_API_KEY から読む。"""
import json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

HANDLE = os.environ.get("YT_HANDLE", "MitaraiAsobu")
KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "schedule.json")
MAX_ITEMS = 8


def api(path, **params):
    params["key"] = KEY
    url = "https://www.googleapis.com/youtube/v3/%s?%s" % (path, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def main():
    if not KEY:
        print("YOUTUBE_API_KEY が設定されていません", file=sys.stderr)
        return 1
    ch = api("channels", part="id", forHandle=HANDLE)
    if not ch.get("items"):
        print("チャンネルが見つかりません: @%s" % HANDLE, file=sys.stderr)
        return 1
    channel_id = ch["items"][0]["id"]

    found = api("search", part="id", channelId=channel_id, eventType="upcoming",
                type="video", maxResults=25)
    ids = [i["id"]["videoId"] for i in found.get("items", []) if i.get("id", {}).get("videoId")]

    items = []
    if ids:
        vids = api("videos", part="snippet,liveStreamingDetails", id=",".join(ids))
        now = datetime.now(timezone.utc)
        for v in vids.get("items", []):
            d = v.get("liveStreamingDetails", {})
            start = d.get("scheduledStartTime")
            if not start or d.get("actualStartTime"):
                continue  # 予定時刻なし / すでに開始済み
            st = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if (now - st).total_seconds() > 6 * 3600:
                continue  # 6時間以上前の予定は古いので除外
            items.append({
                "id": v["id"],
                "title": v["snippet"]["title"],
                "start": start,
            })
    items.sort(key=lambda x: x["start"])
    data = {"channelId": channel_id, "items": items[:MAX_ITEMS]}

    # 内容が変わらないときはファイルを触らない（無駄なコミットを防ぐ）
    new = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    try:
        with open(OUT, encoding="utf-8") as f:
            if f.read() == new:
                print("変更なし")
                return 0
    except FileNotFoundError:
        pass
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)
    print("更新: %d 件" % len(data["items"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
