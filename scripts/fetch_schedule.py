#!/usr/bin/env python3
"""YouTubeチャンネルの「配信予定（upcoming）」を取得して schedule.json に書き出す。
GitHub Actions から定期実行される。APIキーは環境変数 YOUTUBE_API_KEY から読む。"""
import json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

HANDLE = os.environ.get("YT_HANDLE", "MitaraiAsobu")
KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "schedule.json")
CHANNEL_OUT = os.path.join(ROOT, "channel.json")
MAX_ITEMS = 8
# タイトルにこのいずれかが含まれる枠は表示しない
EXCLUDE_TITLE_KEYWORDS = ["スケジュール＆フリーチャット"]


def api(path, **params):
    params["key"] = KEY
    url = "https://www.googleapis.com/youtube/v3/%s?%s" % (path, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def write_if_changed(path, data):
    """内容が変わったときだけ書き込む（無駄なコミットを防ぐ）。変更したらTrue。"""
    new = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    try:
        with open(path, encoding="utf-8") as f:
            if f.read() == new:
                return False
    except FileNotFoundError:
        pass
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)
    return True


def fetch_channel(channel_id):
    r = api("channels", part="snippet,statistics", id=channel_id)
    if not r.get("items"):
        return None
    it = r["items"][0]
    st = it.get("statistics", {})
    th = it["snippet"].get("thumbnails", {})
    pic = (th.get("medium") or th.get("default") or {}).get("url", "")
    data = {
        "title": it["snippet"]["title"],
        "url": "https://www.youtube.com/@%s" % HANDLE,
        "thumbnail": pic,
        "videoCount": int(st.get("videoCount", 0)),
        "viewCount": int(st.get("viewCount", 0)),
    }
    if not st.get("hiddenSubscriberCount"):
        data["subscriberCount"] = int(st.get("subscriberCount", 0))  # APIの仕様で上位3桁に丸められる
    return data


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
            title = v["snippet"]["title"]
            if any(k in title for k in EXCLUDE_TITLE_KEYWORDS):
                continue  # 表示しない枠
            items.append({
                "id": v["id"],
                "title": v["snippet"]["title"],
                "start": start,
            })
    items.sort(key=lambda x: x["start"])
    data = {"channelId": channel_id, "items": items[:MAX_ITEMS]}

    changed = write_if_changed(OUT, data)
    print("配信予定: %s (%d 件)" % ("更新" if changed else "変更なし", len(data["items"])))

    ch = fetch_channel(channel_id)
    if ch:
        changed = write_if_changed(CHANNEL_OUT, ch)
        print("チャンネル情報: %s" % ("更新" if changed else "変更なし"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
