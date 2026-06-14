# マイクラ経済ワールド ルールサイト

マインクラフト8人ワールドの経済・職業・政府運用ルールを、マイクラ風UIで見やすくまとめた説明サイトです。

現在のバージョン: **v0.1.0**

## ディレクトリ構成

```
MINECRAFT_economy/
├── rules/                                      ← ルール本文（マスター。改定はここから）
│   └── minecraft_world_economy_rules_v0-1-0.md
├── functions/                                  ← Cloudflare Pages Functions（リポジトリ直下に置く）
│   └── _middleware.js                          ← 全ページのベーシック認証
├── site/                                       ← 公開サイト（= ビルド出力ディレクトリ）
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
│   ├── admin.html                              ← 価格管理ページ（ローカル専用）
│   ├── data/prices.json                        ← 全価格データのマスター（職業→カテゴリ→項目）
│   ├── css/style.css                           ← マイクラ風スタイル
│   ├── css/admin.css                           ← 価格管理ページ専用スタイル
│   ├── js/nav.js                               ← 共通ヘッダー/サイドナビ/フッターを注入
│   ├── js/main.js                              ← スクロール連動・トップ戻り
│   ├── js/price-table.js                       ← prices.json から価格表を生成
│   ├── js/admin.js                             ← 価格管理ページのロジック
│   └── assets/icons/                           ← Minecraftアイテムアイコン 1854種（全件）
├── tools/
│   └── dev_server.py                           ← ローカル編集サーバー（保存API付き・公開には使わない）
└── README.md
```

> **Cloudflare Pages の注意**: Functions の `functions/` ディレクトリは
> **ビルド出力ディレクトリ（`site`）の中ではなく、リポジトリのルート直下**に置きます。
> Cloudflare はリポジトリルートの `functions/` を Pages Functions として読み込むためです。

## サイトの見方

`site/index.html` をブラウザで開くだけで表示できます（ビルド不要の静的サイト）。
WEB公開する場合はベーシック認証をかけて限定公開します。

> **ローカル確認時の注意**: 価格表は `data/prices.json` を `fetch` で読み込みます。
> `file://` で直接 HTML を開くと CORS でブロックされ価格表が出ません。
> ローカルで価格表まで確認したいときは簡易サーバー経由で開いてください。
> 例: `cd site && python -m http.server 8000` → `http://localhost:8000/`

## 価格データの一元管理（重要）

エメラルドが関わる**全ての価格・相場は [`site/data/prices.json`](site/data/prices.json) が唯一のマスター**です（schema 2）。

### データ構造（職業 → カテゴリ → 項目）

```jsonc
{
  "meta": { "version": "v0.2.0", "currency": "エメラルド", "diamondToEmerald": 10, "schema": 2 },
  "jobs": [
    {
      "id": "government", "label": "政府", "emoji": "🏛️",
      "categories": [
        {
          "id": "basic_goods", "title": "政府提供・基本物資価格",
          "columns": ["品目", "数量", "価格"],
          "items": [
            { "icon": "baked_potato", "name": "ベイクドポテト", "qty": "1スタック", "price": 0 }
          ]
        }
      ]
    }
    // farmer / material / adventurer / builder / engineer / tamer / common ...
  ]
}
```

- **価格 `price` は数値のみ**（後で作る計算ツール用）。`0` は「無料」と表示されます。
- 単位（`/10分`・`/1装備` など）は **`unit`**、範囲や但し書き（`3〜5` など）は **`note`** に分けて持ちます。
  表示は「3エメラルド/10分（範囲 3〜5）」のように組み立てられます。
- 「政府」も1つの職業として `jobs` に入っています。

### 表示のしくみ

- 各ページの価格表は HTML に直書きせず `<div data-price-table="カテゴリID"></div>` のマーカーだけ。
  表示時に [`site/js/price-table.js`](site/js/price-table.js) が `prices.json` を読み、該当カテゴリの表を生成します。
- **価格を改定するときは `prices.json` を書き換えるだけ**で全ページに反映されます。

### 価格管理ページ（ローカル専用）

ブラウザ上で価格を編集できる管理ページ [`site/admin.html`](site/admin.html) を用意しています。

- **ローカル環境（localhost / file:）でのみ**、ヘッダー右上に⚙歯車が出て管理ページへ入れます。
  公開環境（pages.dev 等）では歯車も出ず、実質アクセスされません。
- 職業・カテゴリ・項目の **編集／追加／削除**、カテゴリの**別職業への移動**ができます。価格欄は数値入力。
- **保存方法**: 下記のローカル編集サーバー経由なら「保存」で `data/prices.json` に直接上書きされます。
  サーバーが無い場合は File System Access API（Chrome）→ ダウンロードの順にフォールバックします。

### ローカル編集サーバー

価格編集と動作確認は、保存APIつきの開発サーバーで行います。

```bash
python tools/dev_server.py      # リポジトリのルートで実行
# → http://localhost:8000/  を開く（価格表の fetch も動く）
# → 右上の⚙から管理ページ。編集して「保存」で data/prices.json に直接書き込み
```

公開時は、編集後の `prices.json` を含めて push するだけです（サーバーや管理ページは公開に影響しません）。

## Cloudflare Pages での公開（ベーシック認証あり）

このサイトは **Cloudflare Pages** での公開を想定しています。

### デプロイ設定

Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git で
このリポジトリ（`takabotakebo/minecraft-economy`）を選び、以下を設定します。

| 項目 | 値 |
|---|---|
| Production branch | `main` |
| Build command | （空欄） |
| Build output directory | `site` |
| Root directory | （空欄＝リポジトリ直下のまま） |

> **重要**:
> - 出力ディレクトリは `site`（静的ファイルがここにある）。
> - **Root directory は空欄のまま**にすること。`functions/` はリポジトリ直下にあり、
>   Cloudflare はルート直下の `functions/_middleware.js` を Pages Functions として
>   読み込んで全ページにベーシック認証をかけます。Root directory を `site` にすると
>   `functions/` が見つからず認証が無効になるので注意。

### ベーシック認証の情報

- ユーザー名: `gkr`
- パスワード: `gkr`

認証ロジックは [`functions/_middleware.js`](functions/_middleware.js) にあります。
**より安全に運用したい場合**は、ソースに直書きせず Cloudflare の環境変数で上書きできます。
ダッシュボードの Settings → Environment variables で次を設定してください。

| 変数名 | 値 |
|---|---|
| `BASIC_AUTH_USER` | 任意のユーザー名 |
| `BASIC_AUTH_PASS` | 任意のパスワード |

環境変数が設定されていればそちらが優先され、未設定なら既定の `gkr` / `gkr` が使われます。

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
