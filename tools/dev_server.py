# -*- coding: utf-8 -*-
"""ローカル開発・価格編集用サーバー（ローカル専用）。

静的ファイルを site/ から配信し、加えて価格管理ページの保存API
  POST /api/save-prices   ボディ = prices.json の全文(JSON)
を受け取って site/data/prices.json に直接上書きする。

使い方（リポジトリのルートで）:
    python tools/dev_server.py
    -> http://localhost:8000/  をブラウザで開く
    -> 右上の歯車から価格管理ページへ。編集して「保存」でファイルへ直接書き込み。

このサーバーは公開には使いません（ローカルでの編集専用）。
"""
import http.server
import json
import os
import sys

PORT = 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
ROOT = os.path.abspath(ROOT)
PRICES_PATH = os.path.join(ROOT, "data", "prices.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # キャッシュ無効化（編集結果がすぐ見えるように）
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/save-prices":
            self.send_error(404, "Not Found")
            return
        try:
            # ?file= で保存先を切替（シーズン2は prices-s2.json）。ホワイトリスト外は拒否
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            fname = qs.get("file", ["prices.json"])[0]
            if fname not in ("prices.json", "prices-s2.json"):
                self.send_error(400, f"Invalid target file: {fname}")
                return
            target = os.path.join(ROOT, "data", fname)
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            # JSONとして妥当か検証してから保存（壊れたデータで上書きしない）
            parsed = json.loads(raw.decode("utf-8"))
            text = json.dumps(parsed, ensure_ascii=False, indent=2) + "\n"
            with open(target, "w", encoding="utf-8") as f:
                f.write(text)
            body = json.dumps({"ok": True, "path": f"data/{fname}"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            print(f"[save] data/{fname} を上書きしました（{len(text)} bytes）")
        except json.JSONDecodeError as e:
            self.send_error(400, f"Invalid JSON: {e}")
        except Exception as e:
            self.send_error(500, f"Save failed: {e}")


def main():
    os.chdir(ROOT)
    addr = ("127.0.0.1", PORT)
    httpd = http.server.ThreadingHTTPServer(addr, Handler)
    print(f"ローカル編集サーバー起動: http://localhost:{PORT}/")
    print(f"  配信ルート : {ROOT}")
    print(f"  保存先     : {PRICES_PATH}")
    print("  Ctrl+C で停止")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n停止しました")
        httpd.server_close()


if __name__ == "__main__":
    main()
