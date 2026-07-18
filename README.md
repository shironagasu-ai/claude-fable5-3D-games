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
| [Airlock Escape](games/airlock-escape/) | 電源が落ちた宇宙ステーションからの一人称視点 3D 脱出ゲーム。アイテム探索 → 電源復旧 → コード解読の謎解きチェーン | Three.js / Pointer Lock / WebAudio |
| [Cargo Crane](games/cargo-crane/) | 旋回クレーンから貨物を落として積み上げる物理タワービルダー。剛体スタッキング・弾道予測マーカー・ワンボタン操作 | Three.js / cannon-es |
| [Aurora Sea](games/aurora-sea/) | オーロラの海を駆けるゲートスラローム。Gerstner風の波・プロシージャル空・オーロラ・ポストプロセスブルームまで全て自作 GLSL | Three.js / 自作シェーダー |
| [Swarm](games/swarm/) | 深海の発光魚 2,200 体（Boids）を捕食者から守る群体シミュレーションゲーム。空間ハッシュ近傍探索＋InstancedMesh 1ドローコール描画 | Three.js / Boids / データ指向設計 |
| [Drone Arena](games/drone-arena/) | ウェーブ制ツインスティック・シューター。追跡自爆／側面急襲／遠距離カイティングの3種の敵AIステートマシン、弾プール、画面シェイク等のゲームフィール演出 | Three.js / 敵AI / オブジェクトプール |
| [Flip Wall](games/flip-wall/) | アップロードしたイラスト（最大6枚・1枚でも可）をボクセル壁に展示し、クリック地点からさざなみ状にフリップして切り替えるインタラクティブ・ギャラリー。立方体の6面=6枚をカスタムシェーダーで割り当て | Three.js / カスタムシェーダー / File API |

## GitHub Pages の設定

リポジトリの **Settings → Pages** で、ブランチ（`main`）のルート `/` を公開対象に設定してください。
