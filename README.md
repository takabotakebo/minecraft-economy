# マイクラ経済ワールド ルールサイト

マインクラフト8人ワールドの経済・職業・政府運用ルールを、マイクラ風UIで見やすくまとめた説明サイトです。

現在のバージョン: **v0.1.0**

## ディレクトリ構成

```
MINECRAFT_economy/
├── rules/                                      ← ルール本文（マスター。改定はここから）
│   └── minecraft_world_economy_rules_v0-1-0.md
├── site/                                       ← 公開サイト（マルチページ）
│   ├── index.html                              ← ホーム（概要＋各ページ入口）
│   ├── system.html                             ← PART1 国のシステム
│   ├── jobs.html                               ← PART2 各職業（概要・共通ルール）
│   ├── jobs/                                    ← 職業ごとの相場ページ
│   │   ├── material.html  (材料屋)
│   │   ├── farmer.html    (農家)
│   │   ├── adventurer.html(冒険家)
│   │   ├── builder.html   (建築家)
│   │   ├── engineer.html  (装置技師)
│   │   └── tamer.html     (調教師)
│   ├── summary.html                            ← PART3 まとめ
│   ├── changelog.html                          ← 変更履歴ページ
│   ├── css/style.css                           ← マイクラ風スタイル
│   ├── js/nav.js                               ← 共通ヘッダー/サイドナビ/フッターを注入
│   ├── js/main.js                              ← スクロール連動・トップ戻り
│   └── assets/icons/                           ← Minecraftアイテムアイコン 1854種（全件）
└── README.md
```

## サイトの見方

`site/index.html` をブラウザで開くだけで表示できます（ビルド不要の静的サイト）。
WEB公開する場合はベーシック認証をかけて限定公開する想定です。

## ルール改定の手順（今後のバージョンアップ）

ルールは `rules/` のマークダウンをマスターとし、サイトはそれに準拠して更新します。

1. **新しいルール md を作成**
   `rules/minecraft_world_economy_rules_v0-2-0.md` のように、
   バージョンを上げた md を新規作成する（前版は履歴として残す）。

2. **該当ページを更新**
   変更箇所に応じて `site/system.html`（国のシステム）、`site/jobs.html` や
   `site/jobs/*.html`（各職業）、`site/summary.html` を編集する。

3. **バージョン番号を更新**
   `site/js/nav.js` の `var VERSION = 'v0.1.0';` を書き換えるだけで、
   全ページのヘッダーバッジとフッターが一括更新される。

4. **変更履歴を追記**
   `site/changelog.html` の先頭に新バージョンのエントリを追加する。

### サイトの仕組み（マルチページ構成）

- 各ページは本文（`#app` 内のヒーロー＋セクション）だけを持つ薄いHTML。
- 共通のヘッダー（ドロップダウン付きグローバルナビ）・サイドナビ・フッターは
  `js/nav.js` が実行時に注入する。**ナビ項目やバージョンは nav.js を直すだけで全ページに反映される。**
- 各 HTML の `<body data-page="..." data-depth="...">` で「現在ページ」と「階層の深さ（jobs/ 配下は 1）」を指定。
  `data-depth` に応じて nav.js が相対パスを調整するので、サブフォルダでもアイコン・リンクが壊れない。
- ページ追加時は、①薄いHTMLを作る（`data-page`/`data-depth` を設定）→ ②`js/nav.js` の `NAV`/`JOBS` 配列に項目を足す、の2ステップ。

### バージョニング規則

`v[メジャー].[マイナー].[パッチ]`

| 種類 | 上げる桁 | 例 |
|---|---|---|
| 大きな制度変更（職業追加、通貨ルール変更など） | マイナー | v0.1.0 → v0.2.0 |
| 価格・数値・文言の小修正 | パッチ | v0.1.0 → v0.1.1 |
| 正式運用開始・全面改訂 | メジャー | v0.x.x → v1.0.0 |

## アイコン素材について

- アイテムアイコンは [destruc7i0n/minecraft-textures](https://github.com/destruc7i0n/minecraft-textures)
  より jsDelivr CDN 経由で取得し、`site/assets/icons/` に同梱しています（全1854種）。
- 今後のルール改定で新アイテムが登場しても対応できるよう、**使う/使わないに関わらず全件保存**しています。
- アイコンの著作権は © Mojang Studios / Microsoft。本サイトは非公式のファン制作・非商用です。

### アイコンの追加取得（必要な場合）

新バージョンのテクスチャを追加したいときは、以下で取得できます（Git Bash）。

```bash
BASE="https://cdn.jsdelivr.net/gh/destruc7i0n/minecraft-textures@master/data/textures"
# 例: 1.21 の特定テクスチャ
curl -sL "${BASE}/1.21/<item_name>.png" -o "site/assets/icons/<item_name>.png"
```

> 注意: `minecraft.wiki` は Cloudflare の bot 対策で直接ダウンロードできません。jsDelivr CDN を使ってください。
