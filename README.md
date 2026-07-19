# Fable 3D Games

Claude の **Fable モデルにどこまで 3D ゲーム開発ができるか**を検証する実験リポジトリです。
企画・実装・テスト・デバッグまでを Fable との対話だけで進め、1作ごとに異なる技術領域を試しています。

## ▶ 遊ぶ

**すべてブラウザでそのまま遊べます（インストール不要・スマホ対応）:**

### 🎮 [ゲーム一覧ポータルを開く](https://shironagasu-ai.github.io/claude-fable5-3D-games/)

| # | ゲーム | ジャンル / 検証テーマ | 直リンク |
|---|--------|--------------------|----------|
| 1 | **Star Runner** 🚀 | 小惑星帯を突き抜ける 3D エンドレスランナー（反射神経） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/star-runner/) |
| 2 | **Airlock Escape** 🚪 | 電源が落ちた宇宙ステーションからの一人称脱出ゲーム（探索・謎解き） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/airlock-escape/) |
| 3 | **Cargo Crane** 🏗️ | 旋回クレーンで貨物を積み上げる物理タワービルダー（剛体物理） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/cargo-crane/) |
| 4 | **Aurora Sea** 🌌 | オーロラの海を駆けるゲートスラローム（自作GLSLシェーダー） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/aurora-sea/) |
| 5 | **Swarm** 🐟 | 発光魚2,200体の群れを捕食者から守る（Boids群体シミュレーション） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/swarm/) |
| 6 | **Drone Arena** 🎯 | ウェーブ制ツインスティック・シューター（敵AIステートマシン） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/drone-arena/) |
| 7 | **Flip Wall** 🖼️ | イラストをアップロードして飾るボクセル壁ギャラリー（GPU頂点アニメ・最大20万粒子・ベンチマーク付き） | [Play](https://shironagasu-ai.github.io/claude-fable5-3D-games/games/flip-wall/) |

## 各作品の技術ハイライト

| ゲーム | 主な実装要素 |
|--------|------------|
| [Star Runner](games/star-runner/) | オブジェクトプール、パララックス星空、パーティクル爆発、タッチ操作 |
| [Airlock Escape](games/airlock-escape/) | Pointer Lock 一人称操作、レイキャスト・インタラクション、状態機械による謎解き進行、照明の状態遷移演出、CanvasTexture、WebAudio 効果音合成 |
| [Cargo Crane](games/cargo-crane/) | cannon-es 剛体スタッキング、弾道の解析的予測マーカー、シャドウマップ、揺れるタワーの創発的崩壊 |
| [Aurora Sea](games/aurora-sea/) | 波の頂点シェーダー（CPU側と関数を完全同期）、プロシージャル空・オーロラ・泡、自前ブルーム（輝度抽出→分離ブラー→合成）、テクスチャ画像ゼロ |
| [Swarm](games/swarm/) | Boids 2,200体、均一グリッド空間ハッシュ（近傍探索 ~2.5ms）、InstancedMesh 1ドローコール、swap-remove、サメ型突進AI |
| [Drone Arena](games/drone-arena/) | 性格の異なる3種の敵AI（自爆突進/側面急襲/カイティング砲撃）、弾・パーティクルのプール、画面シェイク等のゲームフィール |
| [Flip Wall](games/flip-wall/) | GPU駆動アニメ（クォータニオン補間を頂点シェーダーで計算）、6面=6画像のカスタムシェーダー、5種の切替パターン、シネマカメラ、FPS計測ベンチマーク |

## リポジトリ構成と方針

```
index.html            … ゲーム一覧のポータルページ（Pages のルート）
games/<name>/         … 各ゲーム。自己完結の1ファイル構成が基本
vendor/               … ライブラリをバージョン固定で同梱（Three.js / cannon-es）
docs/plans/           … 企画・設計メモ
```

- **ビルド不要・静的ファイルのみ**。GitHub Pages でそのまま動く
- **外部 CDN 非依存**。ライブラリは `vendor/` に同梱
- アセットファイル不使用。ジオメトリはプリミティブ組み立て、テクスチャは Canvas 生成、効果音は WebAudio 合成
- 各ゲームはヘッドレスブラウザ（Playwright）の E2E テストで、実プレイ相当の通し検証をしてから追加

## ローカルで動かす

ES Modules を使うため簡易サーバー経由で開きます:

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

## ライセンス / クレジット

- コードは Claude（Fable モデル）との対話で生成
- 同梱ライブラリ: [three.js](https://github.com/mrdoob/three.js)（MIT）、[cannon-es](https://github.com/pmndrs/cannon-es)（MIT）— ライセンス文は `vendor/` 内
