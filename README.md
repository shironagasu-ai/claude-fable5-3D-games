# claude-fable5-3D-games

Claude の Fable モデルでどの程度 3D ゲーム開発ができるかを試す実験リポジトリです。

- ホスティング: **GitHub Pages** 前提（ビルド不要・静的ファイルのみ）
- すべてのゲームはブラウザ（HTML + WebGL）上で動作します
- 複数の 3D ゲームを順次追加していきます

## 構成

```
index.html            … ゲーム一覧のポータルページ
games/
  <game-name>/
    index.html        … 各ゲーム（自己完結の1ファイル構成が基本）
```

```
vendor/               … ライブラリ（Three.js など）をバージョン固定でベンダリング
```

外部 CDN には依存せず、ライブラリは `vendor/` に同梱しています。ローカルでの動作確認は ES Modules を使う都合上、簡易サーバー経由で行います:

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

## ゲーム一覧

| ゲーム | 概要 | 技術 |
|---|---|---|
| [Star Runner](games/star-runner/) | 小惑星帯を突き抜ける 3D エンドレスランナー。キーボード / タッチ操作対応 | Three.js |

## GitHub Pages の設定

リポジトリの **Settings → Pages** で、ブランチ（`main`）のルート `/` を公開対象に設定してください。
