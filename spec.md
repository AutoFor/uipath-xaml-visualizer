# UiPath XAML Visualizer for GitHub

## 概要

GitHub上でUiPath StudioのXAMLファイルを視覚的に表示するブラウザ拡張機能。生のXMLコードではなく、ワークフローの構造を直感的に理解できる形式で表示する。

---

## 背景・課題

### 現状の問題点

- GitHubでUiPath XAMLファイルを開くと、生のXMLコードとして表示される
- XMLの名前空間、属性、ネストが複雑で可読性が低い
- ワークフローの全体像を把握するのに時間がかかる
- コードレビュー時に変更点の影響範囲が理解しにくい

### 解決策

XAMLをパースし、UiPath Studioに近いビジュアル表現で表示する拡張機能を開発する。

---

## 対象ユーザー

- UiPath RPA開発者
- コードレビュー担当者
- プロジェクト管理者・リーダー

---

## 機能要件

### 1. 基本機能

#### 1.1 自動検出・変換

| 機能 | 説明 |
|------|------|
| XAML自動検出 | GitHubの`.xaml`ファイルページを自動検出 |
| UiPath判定 | UiPath固有の名前空間（`http://schemas.uipath.com/workflow/activities`）で識別 |
| 表示切替 | 「Raw XML」⇔「Visual View」のトグルボタン |

#### 1.2 ワークフロー可視化

**対応するワークフロータイプ:**

- **Sequence** - 順次実行のアクティビティリスト
- **Flowchart** - フローチャート形式（ノード＋接続線）
- **StateMachine** - 状態遷移図

**表示要素:**

```
┌─────────────────────────────────────┐
│ [Sequence] Main                     │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ 📝 Assign                    │   │
│  │    result = "Hello"          │   │
│  └──────────────────────────────┘   │
│            ↓                        │
│  ┌──────────────────────────────┐   │
│  │ 🔀 If                        │   │
│  │    condition: result != ""   │   │
│  │  ┌─Then──┐  ┌─Else───┐       │   │
│  │  │ ...   │  │  ...   │       │   │
│  │  └───────┘  └────────┘       │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 2. アクティビティ表示

#### 2.1 アクティビティカード

各アクティビティを以下の形式で表示:

| 項目 | 内容 |
|------|------|
| アイコン | アクティビティタイプに応じたアイコン |
| 名前 | `DisplayName`属性の値 |
| タイプ | アクティビティの種類（Assign, Click, TypeIntoなど） |
| 主要プロパティ | 重要な引数・設定値のプレビュー |

#### 2.2 対応アクティビティ（主要なもの）

**制御フロー:**
- Sequence
- Flowchart / FlowDecision / FlowSwitch
- If / Else
- While / DoWhile
- ForEach / ParallelForEach
- Switch
- TryCatch
- StateMachine / State

**データ操作:**
- Assign
- AddToCollection
- InvokeWorkflowFile

**UI自動化:**
- Click
- TypeInto
- GetText
- ElementExists
- FindElement

**その他:**
- LogMessage / WriteLine
- Delay
- InvokeCode

### 3. 階層表示・ナビゲーション

#### 3.1 ツリービュー

```
📁 Main.xaml
├── 🔄 Sequence: Initialize
│   ├── 📝 Assign: Set Config
│   └── 📝 Assign: Set Variables
├── 🔀 If: Check Condition
│   ├── ✅ Then
│   │   └── 📝 Assign
│   └── ❌ Else
│       └── 📝 Assign
└── 📤 InvokeWorkflow: Process Data
```

#### 3.2 インタラクション

- **折りたたみ/展開** - ネストしたアクティビティの表示制御
- **クリックでジャンプ** - ツリー項目クリックで該当箇所にスクロール
- **検索** - アクティビティ名やプロパティで検索

### 4. 詳細パネル

アクティビティをクリック時に表示:

```
┌─────────────────────────────────────┐
│ 📝 Assign                           │
├─────────────────────────────────────┤
│ DisplayName: Set Result Variable    │
│ To:          resultVar              │
│ Value:       "Success"              │
├─────────────────────────────────────┤
│ 📎 Annotations:                     │
│    "処理結果を格納する"              │
└─────────────────────────────────────┘
```

### 4.5 Informative Screenshot 表示

UiPath Studioで保存された Informative Screenshot（操作対象画面のスクリーンショット）を表示する機能。

#### 4.5.1 概要

UiPathプロジェクトでは、UI操作アクティビティ（Click、TypeIntoなど）作成時に、操作対象のスクリーンショットが自動保存される:

- **保存場所**: プロジェクトルートの `.screenshots` フォルダ（隠しフォルダ）
- **参照方法**: XAMLの `InformativeScreenshot` 属性にファイル名が格納

```xml
<ui:Click DisplayName="Click Login Button" 
          InformativeScreenshot="click_login_btn_abc123.png">
  <ui:Click.Target>
    <ui:Target Selector="&lt;html app='chrome.exe'/&gt;..." />
  </ui:Click.Target>
</ui:Click>
```

#### 4.5.2 表示UI

**アクティビティカード内での表示:**

```
┌─────────────────────────────────────────────────────┐
│ 🖱️ Click: Click Login Button                        │
├─────────────────────────────────────────────────────┤
│ Selector: <html app='chrome.exe'/>...               │
│                                                     │
│ 📷 Informative Screenshot:          [🔍 拡大]       │
│ ┌─────────────────────────────────┐                 │
│ │                                 │                 │
│ │   [サムネイル画像]               │                 │
│ │    (クリック位置がハイライト)    │                 │
│ │                                 │                 │
│ └─────────────────────────────────┘                 │
│ 📁 .screenshots/click_login_btn_abc123.png          │
└─────────────────────────────────────────────────────┘
```

**拡大表示（モーダル）:**

```
┌───────────────────────────────────────────────────────────┐
│ 📷 Click Login Button - Screenshot              [✕ 閉じる]│
├───────────────────────────────────────────────────────────┤
│                                                           │
│   ┌─────────────────────────────────────────────────┐     │
│   │                                                 │     │
│   │                                                 │     │
│   │            [フルサイズ画像]                      │     │
│   │                                                 │     │
│   │                 🔴 ← クリック位置               │     │
│   │                                                 │     │
│   └─────────────────────────────────────────────────┘     │
│                                                           │
│ ファイル: .screenshots/click_login_btn_abc123.png         │
│ サイズ: 1920 x 1080                                       │
└───────────────────────────────────────────────────────────┘
```

#### 4.5.3 対応アクティビティ

Informative Screenshot を持つ可能性のあるアクティビティ:

| アクティビティ | 用途 |
|---------------|------|
| Click | クリック操作 |
| DoubleClick | ダブルクリック |
| TypeInto | テキスト入力 |
| GetText | テキスト取得 |
| SetText | テキスト設定 |
| Hover | マウスホバー |
| CheckAppState | アプリ状態確認 |
| ElementExists | 要素存在確認 |
| FindElement | 要素検索 |
| GetAttribute | 属性取得 |
| SelectItem | ドロップダウン選択 |

#### 4.5.4 GitHub上での画像取得

**画像取得フロー:**

```
1. XAMLから InformativeScreenshot 属性を抽出
   └─ 例: "click_login_abc123.png"

2. .screenshots フォルダのパスを構築
   └─ 同一リポジトリ内: /{owner}/{repo}/blob/{branch}/.screenshots/
   └─ サブフォルダ対応: /{path}/.screenshots/

3. GitHub Raw URL で画像を取得
   └─ https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.screenshots/{filename}

4. 画像をキャッシュして表示
```

**フォルダ構造の考慮:**

```
project-root/
├── .screenshots/           ← ルートの .screenshots
│   ├── main_click_001.png
│   └── main_type_002.png
├── Main.xaml
├── SubProcess/
│   ├── .screenshots/       ← サブフォルダの .screenshots
│   │   └── sub_click_001.png
│   └── Process.xaml
└── Framework/
    ├── .screenshots/
    └── Init.xaml
```

- XAMLファイルの場所を基準に、同階層または親階層の `.screenshots` を検索
- 見つからない場合はプロジェクトルートの `.screenshots` にフォールバック

#### 4.5.5 画像が見つからない場合

```
┌─────────────────────────────────────────────────────┐
│ 🖱️ Click: Click Login Button                        │
├─────────────────────────────────────────────────────┤
│ 📷 Informative Screenshot:                          │
│ ┌─────────────────────────────────┐                 │
│ │  ⚠️ 画像が見つかりません          │                 │
│ │  .screenshots/click_login.png   │                 │
│ │                                 │                 │
│ │  考えられる原因:                 │                 │
│ │  • .screenshots がコミット対象外 │                 │
│ │  • ファイルが削除された          │                 │
│ └─────────────────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

#### 4.5.6 差分表示でのスクリーンショット比較

PRやCommit差分で、スクリーンショットの変更も視覚的に比較:

```
┌─────────────────────────────────────────────────────────────┐
│ 🖱️ Click: Click Submit Button                    🟡 変更    │
├─────────────────────────────────────────────────────────────┤
│ Selector: (変更あり)                                        │
│                                                             │
│ 📷 Screenshot 変更:                                         │
│ ┌────────────────────┐    ┌────────────────────┐           │
│ │                    │    │                    │           │
│ │   [Before]         │ → │   [After]          │           │
│ │   旧UI画面         │    │   新UI画面         │           │
│ │                    │    │                    │           │
│ └────────────────────┘    └────────────────────┘           │
│      (削除)                    (追加)                       │
│                                                             │
│ [🔀 スライダー比較] [👁️ オーバーレイ比較] [⬅️➡️ 左右比較]    │
└─────────────────────────────────────────────────────────────┘
```

**比較モード:**

| モード | 説明 |
|--------|------|
| スライダー比較 | 画像を重ねてスライダーで切り替え |
| オーバーレイ比較 | 差分部分をハイライト表示 |
| 左右比較 | Before/After を並べて表示 |

#### 4.5.7 設定オプション

| 設定項目 | デフォルト | 説明 |
|----------|-----------|------|
| スクリーンショット自動表示 | ON | アクティビティ展開時に自動読み込み |
| サムネイルサイズ | 200px | カード内のサムネイル幅 |
| 画像キャッシュ | ON | 一度読み込んだ画像をキャッシュ |
| 遅延読み込み | ON | スクロール時に画像を読み込み |

### 5. 差分表示（Diff View）

Pull Request / Commit差分ページでの機能。

#### 5.1 アクティビティレベルの差分

- 変更されたアクティビティのハイライト
- 追加/削除/変更のカラーコーディング
  - 🟢 緑: 追加
  - 🔴 赤: 削除
  - 🟡 黄: 変更

#### 5.2 プロパティレベルの差分

アクティビティ内のプロパティ変更を詳細に表示:

```
┌─────────────────────────────────────────────────────┐
│ 📝 Assign: Set Result Variable              🟡 変更 │
├─────────────────────────────────────────────────────┤
│ プロパティ変更:                                      │
│                                                     │
│  DisplayName:                                       │
│    - "Set Result"                                   │
│    + "Set Result Variable"                          │
│                                                     │
│  Value:                                             │
│    - "Pending"                                      │
│    + "Success"                                      │
│                                                     │
│  To: resultVar                          (変更なし)  │
└─────────────────────────────────────────────────────┘
```

#### 5.3 対応するプロパティタイプ

| カテゴリ | プロパティ例 |
|----------|-------------|
| 基本情報 | DisplayName, Annotation |
| 入出力 | Arguments (In/Out/InOut), Variables |
| 設定値 | Timeout, ContinueOnError, DelayBefore/After |
| セレクター | Selector, Target.Selector |
| 式・値 | Condition, Value, Expression |
| ファイルパス | WorkflowFileName, FilePath |

#### 5.4 差分表示モード

**サマリービュー（デフォルト）:**
- 変更のあるアクティビティのみ表示
- 変更プロパティ数をバッジで表示

```
┌────────────────────────────────────────┐
│ 📁 Main.xaml  (+2 -1 ~3)               │
├────────────────────────────────────────┤
│ + 🆕 LogMessage: Log End               │
│ - 🗑️ Delay: Wait 5 seconds             │
│ ~ 📝 Assign: Set Result       (2 props)│
│ ~ 🔀 If: Check Status         (1 prop) │
│ ~ 📤 InvokeWorkflow           (1 prop) │
└────────────────────────────────────────┘
```

**詳細ビュー:**
- すべてのプロパティ変更を展開表示
- インラインdiff形式

#### 5.5 プロパティ差分の視覚化

**テキスト値の差分:**
```
Message:
  - "Processing item: " + itemId
  + "Processing item: " + itemId + " at " + DateTime.Now.ToString()
```

**セレクターの差分（構造化表示）:**
```
Selector:
  <html app='chrome.exe' />
    <webctrl tag='input' 
-            id='username' />
+            id='email' 
+            class='form-control' />
```

**複雑な式の差分:**
```
Condition:
  - result.Contains("error")
  + result.Contains("error") OrElse result.Contains("failed")
```

#### 5.6 フィルタリング・ソート

| フィルタ | 説明 |
|----------|------|
| 変更タイプ | 追加のみ / 削除のみ / 変更のみ |
| プロパティタイプ | セレクター変更 / ロジック変更 / 表示名変更 |
| 重要度 | 破壊的変更 / 軽微な変更 |

#### 5.7 変更サマリーレポート

PR全体の変更サマリーを生成:

```
┌─────────────────────────────────────────────────────┐
│ 📊 変更サマリー                                      │
├─────────────────────────────────────────────────────┤
│ 変更ファイル: 3                                      │
│ アクティビティ: +5 / -2 / ~8                         │
│                                                     │
│ 主な変更:                                           │
│ • セレクター変更: 3箇所                              │
│ • 条件式変更: 2箇所                                  │
│ • ワークフロー呼び出し先変更: 1箇所                   │
│ • エラーハンドリング追加: 1箇所                       │
│                                                     │
│ ⚠️ 注意が必要な変更:                                 │
│ • Timeout値の変更 (30s → 60s) in Process.xaml       │
│ • ContinueOnError が True に変更                    │
└─────────────────────────────────────────────────────┘
```

---

## 非機能要件

### パフォーマンス

| 項目 | 目標値 |
|------|--------|
| 初期レンダリング | 1,000行のXAMLを2秒以内 |
| メモリ使用量 | 50MB以下 |
| 大規模ファイル対応 | 10,000行以上は警告表示 |

### ブラウザ対応

- Google Chrome（優先）
- Microsoft Edge
- Firefox（将来対応）

### セキュリティ

- XAMLデータは外部サーバーに送信しない
- すべての処理はクライアントサイドで完結
- 最小限の権限リクエスト

---

## 技術設計

### アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│                  Browser Extension                   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Content    │  │  XAML       │  │  Renderer   │  │
│  │  Script     │→ │  Parser     │→ │  Engine     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│         ↓                                ↓          │
│  ┌─────────────┐               ┌─────────────────┐  │
│  │  GitHub     │               │  Visual         │  │
│  │  DOM        │               │  Components     │  │
│  └─────────────┘               └─────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### ディレクトリ構成

```
uipath-xaml-visualizer/
├── manifest.json           # 拡張機能マニフェスト（v3）
├── src/
│   ├── content/
│   │   ├── content.js      # GitHubページ検出・DOM操作
│   │   └── content.css     # ビジュアルスタイル
│   ├── parser/
│   │   ├── xaml-parser.js  # XAMLパーサー
│   │   └── activity-map.js # アクティビティ定義マップ
│   ├── renderer/
│   │   ├── sequence.js     # Sequence描画
│   │   ├── flowchart.js    # Flowchart描画
│   │   ├── tree-view.js    # ツリービュー
│   │   └── detail-panel.js # 詳細パネル
│   └── utils/
│       └── helpers.js      # ユーティリティ関数
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html          # ポップアップUI
│   └── popup.js
└── styles/
    └── main.css
```

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "UiPath XAML Visualizer for GitHub",
  "version": "1.0.0",
  "description": "GitHubでUiPath XAMLファイルを視覚的に表示",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://github.com/*"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["src/content/content.js"],
      "css": ["src/content/content.css"]
    }
  ]
}
```

### XAMLパース処理

```javascript
// 主要な名前空間
const UIPATH_NS = 'http://schemas.uipath.com/workflow/activities';
const XAML_NS = 'http://schemas.microsoft.com/winfx/2006/xaml';

// アクティビティタイプの判定
function parseActivity(element) {
  return {
    type: element.localName,
    displayName: element.getAttribute('DisplayName'),
    annotations: parseAnnotations(element),
    properties: parseProperties(element),
    children: parseChildren(element)
  };
}
```

---

## UI/UXデザイン

### カラースキーム

| 用途 | カラー |
|------|--------|
| Sequence背景 | `#E3F2FD` (薄い青) |
| Flowchart背景 | `#F3E5F5` (薄い紫) |
| If/条件分岐 | `#FFF3E0` (薄いオレンジ) |
| ループ | `#E8F5E9` (薄い緑) |
| エラーハンドリング | `#FFEBEE` (薄い赤) |

### アイコン

- Material Icons または Lucide Icons を使用
- UiPath Studioのアイコンに近いデザイン

---

## 開発ロードマップ

### Phase 1: MVP（2週間）

- [x] プロジェクトセットアップ
- [ ] 基本的なXAMLパーサー
- [ ] Sequence表示
- [ ] 表示切替ボタン

### Phase 2: 主要機能（2週間）

- [ ] Flowchart表示
- [ ] ツリービュー
- [ ] 詳細パネル
- [ ] 検索機能

### Phase 3: 拡張機能（2週間）

- [ ] StateMachine対応
- [ ] Diff View対応
- [ ] 設定画面
- [ ] ダークモード対応

### Phase 4: 最適化・公開（1週間）

- [ ] パフォーマンス最適化
- [ ] Chrome Web Store公開
- [ ] ドキュメント整備

---

## テスト計画

### テスト戦略

```
┌─────────────────────────────────────────────────────────────┐
│                      テストピラミッド                        │
├─────────────────────────────────────────────────────────────┤
│                        ┌─────┐                              │
│                       /  E2E  \                             │
│                      /─────────\                            │
│                     / 統合テスト \                           │
│                    /───────────────\                        │
│                   /   ユニットテスト   \                      │
│                  ─────────────────────                      │
└─────────────────────────────────────────────────────────────┘
```

| レベル | 比率 | ツール |
|--------|------|--------|
| ユニットテスト | 70% | Jest |
| 統合テスト | 20% | Jest + jsdom |
| E2Eテスト | 10% | Playwright / Puppeteer |

---

### 1. ユニットテスト

#### 1.1 XAMLパーサーテスト

**テストファイル:** `tests/unit/parser/xaml-parser.test.js`

```javascript
describe('XAMLParser', () => {
  describe('parseActivity', () => {
    test('Sequence要素を正しくパースできる', () => {
      const xaml = `<Sequence DisplayName="Main">...</Sequence>`;
      const result = parseActivity(xaml);
      expect(result.type).toBe('Sequence');
      expect(result.displayName).toBe('Main');
    });

    test('ネストしたアクティビティをパースできる', () => {
      const xaml = `
        <Sequence DisplayName="Parent">
          <Assign DisplayName="Child1" />
          <Assign DisplayName="Child2" />
        </Sequence>
      `;
      const result = parseActivity(xaml);
      expect(result.children).toHaveLength(2);
    });

    test('UiPath名前空間のアクティビティを識別できる', () => {
      const xaml = `<ui:Click DisplayName="Click Button" />`;
      const result = parseActivity(xaml);
      expect(result.type).toBe('Click');
      expect(result.namespace).toBe('ui');
    });
  });
});
```

**テストケース一覧:**

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| UP-001 | 空のXAML | エラーハンドリング |
| UP-002 | 不正なXML構文 | パースエラー返却 |
| UP-003 | Sequence単体 | 正常パース |
| UP-004 | Flowchart単体 | 正常パース |
| UP-005 | StateMachine単体 | 正常パース |
| UP-006 | 深いネスト（10階層） | 正常パース |
| UP-007 | 大量アクティビティ（100個） | 正常パース |
| UP-008 | 日本語DisplayName | 正常パース |
| UP-009 | 特殊文字を含む属性値 | エスケープ処理 |
| UP-010 | InformativeScreenshot属性 | ファイル名抽出 |

#### 1.2 プロパティ抽出テスト

**テストファイル:** `tests/unit/parser/property-extractor.test.js`

```javascript
describe('PropertyExtractor', () => {
  describe('extractProperties', () => {
    test('Assign のTo/Valueを抽出できる', () => {
      const activity = parseActivity(`
        <Assign DisplayName="Set Variable">
          <Assign.To><OutArgument>[result]</OutArgument></Assign.To>
          <Assign.Value><InArgument>"Success"</InArgument></Assign.Value>
        </Assign>
      `);
      const props = extractProperties(activity);
      expect(props.to).toBe('result');
      expect(props.value).toBe('"Success"');
    });

    test('Click のSelectorを抽出できる', () => {
      const activity = parseActivity(`
        <ui:Click DisplayName="Click">
          <ui:Click.Target>
            <ui:Target Selector="<html/><webctrl id='btn'/>" />
          </ui:Click.Target>
        </ui:Click>
      `);
      const props = extractProperties(activity);
      expect(props.selector).toContain('webctrl');
    });

    test('InformativeScreenshotを抽出できる', () => {
      const activity = parseActivity(`
        <ui:Click InformativeScreenshot="click_001.png" />
      `);
      const props = extractProperties(activity);
      expect(props.informativeScreenshot).toBe('click_001.png');
    });
  });
});
```

**テストケース一覧:**

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| PE-001 | Assign.To / Assign.Value | 変数名・値を抽出 |
| PE-002 | If.Condition | 条件式を抽出 |
| PE-003 | ForEach.Values | コレクション式を抽出 |
| PE-004 | InvokeWorkflowFile.WorkflowFileName | ファイルパスを抽出 |
| PE-005 | Selector（エスケープ済み） | デコード済みセレクター |
| PE-006 | Timeout属性 | 数値として抽出 |
| PE-007 | ContinueOnError属性 | Boolean値として抽出 |
| PE-008 | Arguments（複数） | 全引数をリストで抽出 |
| PE-009 | Variables（複数） | 全変数をリストで抽出 |
| PE-010 | Annotation | アノテーションテキスト抽出 |

#### 1.3 差分検出テスト

**テストファイル:** `tests/unit/diff/activity-diff.test.js`

```javascript
describe('ActivityDiff', () => {
  describe('compareActivities', () => {
    test('追加されたアクティビティを検出', () => {
      const before = [{ id: '1', type: 'Assign' }];
      const after = [
        { id: '1', type: 'Assign' },
        { id: '2', type: 'Click' }
      ];
      const diff = compareActivities(before, after);
      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].type).toBe('Click');
    });

    test('削除されたアクティビティを検出', () => {
      const before = [
        { id: '1', type: 'Assign' },
        { id: '2', type: 'Click' }
      ];
      const after = [{ id: '1', type: 'Assign' }];
      const diff = compareActivities(before, after);
      expect(diff.removed).toHaveLength(1);
    });

    test('プロパティ変更を検出', () => {
      const before = [{ id: '1', displayName: 'Old Name' }];
      const after = [{ id: '1', displayName: 'New Name' }];
      const diff = compareActivities(before, after);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes.displayName).toEqual({
        before: 'Old Name',
        after: 'New Name'
      });
    });
  });
});
```

**テストケース一覧:**

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| AD-001 | アクティビティ追加 | added配列に含まれる |
| AD-002 | アクティビティ削除 | removed配列に含まれる |
| AD-003 | DisplayName変更 | modified.changesに含まれる |
| AD-004 | Selector変更 | modified.changesに含まれる |
| AD-005 | Condition変更 | modified.changesに含まれる |
| AD-006 | 複数プロパティ同時変更 | すべてchangesに含まれる |
| AD-007 | 順序変更のみ | 変更なしと判定 |
| AD-008 | ネスト内の変更 | 親子関係を維持して検出 |
| AD-009 | InformativeScreenshot変更 | 画像ファイル名の変更を検出 |
| AD-010 | 空→値あり | 追加として検出 |

#### 1.4 スクリーンショットパス解決テスト

**テストファイル:** `tests/unit/screenshot/path-resolver.test.js`

```javascript
describe('ScreenshotPathResolver', () => {
  describe('resolveScreenshotPath', () => {
    test('ルートの.screenshotsから解決', () => {
      const xamlPath = '/owner/repo/blob/main/Main.xaml';
      const filename = 'click_001.png';
      const result = resolveScreenshotPath(xamlPath, filename);
      expect(result).toBe(
        'https://raw.githubusercontent.com/owner/repo/main/.screenshots/click_001.png'
      );
    });

    test('サブフォルダの.screenshotsから解決', () => {
      const xamlPath = '/owner/repo/blob/main/SubProcess/Process.xaml';
      const filename = 'click_002.png';
      const result = resolveScreenshotPath(xamlPath, filename, {
        checkSubfolder: true
      });
      expect(result).toContain('SubProcess/.screenshots/click_002.png');
    });

    test('ブランチ名にスラッシュを含む場合', () => {
      const xamlPath = '/owner/repo/blob/feature/new-ui/Main.xaml';
      const filename = 'click_001.png';
      const result = resolveScreenshotPath(xamlPath, filename);
      expect(result).toContain('feature/new-ui');
    });
  });
});
```

**テストケース一覧:**

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| SP-001 | ルートXAML + ルート.screenshots | 正しいURL生成 |
| SP-002 | サブフォルダXAML + 同階層.screenshots | 正しいURL生成 |
| SP-003 | サブフォルダXAML + ルート.screenshots（フォールバック） | 正しいURL生成 |
| SP-004 | feature/xxx ブランチ | スラッシュを正しく処理 |
| SP-005 | 日本語ファイル名 | URLエンコード |
| SP-006 | スペースを含むファイル名 | URLエンコード |
| SP-007 | 存在しないファイル | null返却 |
| SP-008 | プライベートリポジトリ | 認証エラーハンドリング |

---

### 2. 統合テスト

#### 2.1 レンダラー統合テスト

**テストファイル:** `tests/integration/renderer.test.js`

```javascript
describe('Renderer Integration', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('Sequenceワークフローを正しくレンダリング', async () => {
    const xaml = loadFixture('sequence-workflow.xaml');
    await renderWorkflow(xaml, container);
    
    expect(container.querySelector('.sequence-container')).toBeTruthy();
    expect(container.querySelectorAll('.activity-card')).toHaveLength(5);
  });

  test('Flowchartワークフローを正しくレンダリング', async () => {
    const xaml = loadFixture('flowchart-workflow.xaml');
    await renderWorkflow(xaml, container);
    
    expect(container.querySelector('.flowchart-container')).toBeTruthy();
    expect(container.querySelectorAll('.flowchart-node')).toHaveLength(8);
    expect(container.querySelectorAll('.flowchart-edge')).toHaveLength(10);
  });

  test('ツリービューとメインビューが連動する', async () => {
    const xaml = loadFixture('nested-workflow.xaml');
    await renderWorkflow(xaml, container);
    
    const treeItem = container.querySelector('.tree-item[data-id="activity-3"]');
    treeItem.click();
    
    const activityCard = container.querySelector('.activity-card[data-id="activity-3"]');
    expect(activityCard.classList.contains('highlighted')).toBe(true);
  });

  test('スクリーンショットが正しく表示される', async () => {
    const xaml = loadFixture('click-with-screenshot.xaml');
    mockFetch('https://raw.githubusercontent.com/.../click_001.png', mockImageBlob);
    
    await renderWorkflow(xaml, container);
    
    const screenshot = container.querySelector('.informative-screenshot img');
    expect(screenshot).toBeTruthy();
    expect(screenshot.src).toContain('click_001.png');
  });
});
```

#### 2.2 差分表示統合テスト

**テストファイル:** `tests/integration/diff-view.test.js`

```javascript
describe('DiffView Integration', () => {
  test('プロパティ差分が正しく表示される', async () => {
    const beforeXaml = loadFixture('before.xaml');
    const afterXaml = loadFixture('after.xaml');
    
    const container = document.createElement('div');
    await renderDiffView(beforeXaml, afterXaml, container);
    
    // 変更されたアクティビティにマーカーがある
    const modifiedCards = container.querySelectorAll('.activity-card.modified');
    expect(modifiedCards.length).toBeGreaterThan(0);
    
    // プロパティ差分が表示されている
    const propDiffs = container.querySelectorAll('.property-diff');
    expect(propDiffs.length).toBeGreaterThan(0);
    
    // Before/After値が表示されている
    const beforeValue = container.querySelector('.diff-before');
    const afterValue = container.querySelector('.diff-after');
    expect(beforeValue).toBeTruthy();
    expect(afterValue).toBeTruthy();
  });

  test('スクリーンショット差分が比較表示される', async () => {
    const beforeXaml = loadFixture('click-before.xaml');
    const afterXaml = loadFixture('click-after.xaml');
    
    mockFetch('.../.screenshots/click_old.png', mockOldImage);
    mockFetch('.../.screenshots/click_new.png', mockNewImage);
    
    const container = document.createElement('div');
    await renderDiffView(beforeXaml, afterXaml, container);
    
    const screenshotDiff = container.querySelector('.screenshot-diff');
    expect(screenshotDiff).toBeTruthy();
    expect(screenshotDiff.querySelectorAll('img')).toHaveLength(2);
  });
});
```

#### 2.3 GitHub DOM統合テスト

**テストファイル:** `tests/integration/github-dom.test.js`

```javascript
describe('GitHub DOM Integration', () => {
  test('GitHubのファイルビューページを検出', () => {
    document.body.innerHTML = loadFixture('github-file-view.html');
    
    const detector = new GitHubPageDetector();
    expect(detector.isFileView()).toBe(true);
    expect(detector.getFilePath()).toBe('/owner/repo/blob/main/Main.xaml');
  });

  test('GitHubのPRページを検出', () => {
    document.body.innerHTML = loadFixture('github-pr-diff.html');
    
    const detector = new GitHubPageDetector();
    expect(detector.isPullRequest()).toBe(true);
    expect(detector.getDiffFiles()).toContain('Main.xaml');
  });

  test('表示切替ボタンが正しい位置に挿入される', () => {
    document.body.innerHTML = loadFixture('github-file-view.html');
    
    insertToggleButton();
    
    const button = document.querySelector('.xaml-visualizer-toggle');
    expect(button).toBeTruthy();
    expect(button.closest('.file-actions')).toBeTruthy();
  });
});
```

---

### 3. E2Eテスト

#### 3.1 基本操作E2Eテスト

**テストファイル:** `tests/e2e/basic-operations.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Basic Operations', () => {
  test.beforeEach(async ({ context }) => {
    // 拡張機能をロード
    await context.addInitScript(() => {
      // 拡張機能の初期化
    });
  });

  test('GitHubでXAMLファイルを開くとビジュアライザーが有効になる', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/blob/main/Main.xaml');
    
    // トグルボタンが表示される
    await expect(page.locator('.xaml-visualizer-toggle')).toBeVisible();
    
    // ボタンをクリック
    await page.click('.xaml-visualizer-toggle');
    
    // ビジュアルビューが表示される
    await expect(page.locator('.xaml-visual-view')).toBeVisible();
    await expect(page.locator('.sequence-container')).toBeVisible();
  });

  test('アクティビティをクリックすると詳細パネルが開く', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/blob/main/Main.xaml');
    await page.click('.xaml-visualizer-toggle');
    
    // アクティビティカードをクリック
    await page.click('.activity-card:first-child');
    
    // 詳細パネルが表示される
    await expect(page.locator('.detail-panel')).toBeVisible();
    await expect(page.locator('.detail-panel .property-list')).toBeVisible();
  });

  test('ツリービューで項目をクリックするとスクロールする', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/blob/main/LargeWorkflow.xaml');
    await page.click('.xaml-visualizer-toggle');
    
    // ツリーの下の方の項目をクリック
    await page.click('.tree-item:nth-child(20)');
    
    // 該当アクティビティが表示領域内にある
    const activity = page.locator('.activity-card.highlighted');
    await expect(activity).toBeInViewport();
  });
});
```

#### 3.2 差分表示E2Eテスト

**テストファイル:** `tests/e2e/diff-view.spec.js`

```javascript
test.describe('Diff View', () => {
  test('PRページでXAML差分がビジュアル表示される', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/pull/123/files');
    
    // XAMLファイルの差分セクションを見つける
    const xamlDiff = page.locator('.file-diff:has([data-path$=".xaml"])');
    
    // ビジュアル差分ボタンをクリック
    await xamlDiff.locator('.xaml-diff-toggle').click();
    
    // ビジュアル差分が表示される
    await expect(xamlDiff.locator('.visual-diff-view')).toBeVisible();
    
    // 追加・削除・変更のマーカーが表示される
    await expect(xamlDiff.locator('.diff-added')).toBeVisible();
    await expect(xamlDiff.locator('.diff-modified')).toBeVisible();
  });

  test('プロパティ差分の詳細が展開できる', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/pull/123/files');
    
    const xamlDiff = page.locator('.file-diff:has([data-path$=".xaml"])');
    await xamlDiff.locator('.xaml-diff-toggle').click();
    
    // 変更されたアクティビティをクリック
    await xamlDiff.locator('.activity-card.modified:first-child').click();
    
    // プロパティ差分詳細が表示される
    await expect(xamlDiff.locator('.property-diff-detail')).toBeVisible();
    await expect(xamlDiff.locator('.diff-before')).toBeVisible();
    await expect(xamlDiff.locator('.diff-after')).toBeVisible();
  });
});
```

#### 3.3 スクリーンショット表示E2Eテスト

**テストファイル:** `tests/e2e/screenshot.spec.js`

```javascript
test.describe('Screenshot Display', () => {
  test('InformativeScreenshotが表示される', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/blob/main/ClickWorkflow.xaml');
    await page.click('.xaml-visualizer-toggle');
    
    // Clickアクティビティを展開
    await page.click('.activity-card[data-type="Click"]');
    
    // スクリーンショットサムネイルが表示される
    const thumbnail = page.locator('.informative-screenshot img');
    await expect(thumbnail).toBeVisible();
    
    // 拡大ボタンをクリック
    await page.click('.screenshot-expand-btn');
    
    // モーダルが開く
    await expect(page.locator('.screenshot-modal')).toBeVisible();
    await expect(page.locator('.screenshot-modal img')).toBeVisible();
  });

  test('スクリーンショットが見つからない場合のエラー表示', async ({ page }) => {
    // .screenshotsフォルダがないリポジトリ
    await page.goto('https://github.com/test-org/no-screenshots-repo/blob/main/Click.xaml');
    await page.click('.xaml-visualizer-toggle');
    
    await page.click('.activity-card[data-type="Click"]');
    
    // エラーメッセージが表示される
    await expect(page.locator('.screenshot-error')).toBeVisible();
    await expect(page.locator('.screenshot-error')).toContainText('画像が見つかりません');
  });

  test('差分表示でスクリーンショット比較ができる', async ({ page }) => {
    await page.goto('https://github.com/test-org/test-repo/pull/456/files');
    
    const xamlDiff = page.locator('.file-diff:has([data-path$=".xaml"])');
    await xamlDiff.locator('.xaml-diff-toggle').click();
    
    // スクリーンショットが変更されたアクティビティ
    const modifiedClick = xamlDiff.locator('.activity-card.modified[data-type="Click"]');
    await modifiedClick.click();
    
    // 比較ビューが表示される
    await expect(xamlDiff.locator('.screenshot-compare')).toBeVisible();
    
    // スライダー比較モードに切り替え
    await page.click('.compare-mode-slider');
    await expect(xamlDiff.locator('.slider-compare')).toBeVisible();
  });
});
```

---

### 4. テストデータ（Fixtures）

#### 4.1 XAMLフィクスチャ

**ファイル構成:**

```
tests/fixtures/
├── xaml/
│   ├── sequence-simple.xaml        # シンプルなSequence
│   ├── sequence-nested.xaml        # ネストしたSequence
│   ├── flowchart-basic.xaml        # 基本的なFlowchart
│   ├── flowchart-complex.xaml      # 複雑なFlowchart
│   ├── statemachine.xaml           # StateMachine
│   ├── with-screenshot.xaml        # InformativeScreenshot付き
│   ├── large-workflow.xaml         # 大規模（100+アクティビティ）
│   ├── special-chars.xaml          # 特殊文字を含む
│   ├── japanese-names.xaml         # 日本語DisplayName
│   └── invalid/
│       ├── malformed.xaml          # 不正なXML
│       ├── missing-namespace.xaml  # 名前空間なし
│       └── empty.xaml              # 空ファイル
├── diff/
│   ├── before/
│   │   ├── simple-change.xaml
│   │   ├── property-change.xaml
│   │   └── screenshot-change.xaml
│   └── after/
│       ├── simple-change.xaml
│       ├── property-change.xaml
│       └── screenshot-change.xaml
├── github-html/
│   ├── file-view.html              # ファイル表示ページ
│   ├── pr-diff.html                # PR差分ページ
│   └── commit-diff.html            # コミット差分ページ
└── images/
    ├── click_001.png
    ├── click_002.png
    └── type_001.png
```

#### 4.2 サンプルXAMLフィクスチャ

**sequence-simple.xaml:**
```xml
<Activity x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main Sequence">
    <ui:LogMessage DisplayName="Start Log" Level="Info" Message="Started" />
    <Assign DisplayName="Set Variable">
      <Assign.To><OutArgument x:TypeArguments="x:String">[result]</OutArgument></Assign.To>
      <Assign.Value><InArgument x:TypeArguments="x:String">"OK"</InArgument></Assign.Value>
    </Assign>
    <ui:LogMessage DisplayName="End Log" Level="Info" Message="[result]" />
  </Sequence>
</Activity>
```

**with-screenshot.xaml:**
```xml
<Activity x:Class="ClickWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Click Sequence">
    <ui:Click DisplayName="Click Login" 
              InformativeScreenshot="click_login_001.png">
      <ui:Click.Target>
        <ui:Target Selector="&lt;html app='chrome.exe'/&gt;&lt;webctrl id='loginBtn'/&gt;" />
      </ui:Click.Target>
    </ui:Click>
    <ui:TypeInto DisplayName="Type Username"
                 InformativeScreenshot="type_username_001.png">
      <ui:TypeInto.Target>
        <ui:Target Selector="&lt;html app='chrome.exe'/&gt;&lt;webctrl id='username'/&gt;" />
      </ui:TypeInto.Target>
      <ui:TypeInto.Text>
        <InArgument x:TypeArguments="x:String">"testuser"</InArgument>
      </ui:TypeInto.Text>
    </ui:TypeInto>
  </Sequence>
</Activity>
```

---

### 5. テスト実行・CI設定

#### 5.1 package.json スクリプト

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage && playwright test"
  }
}
```

#### 5.2 Jest設定

**jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  }
};
```

#### 5.3 GitHub Actions CI

**.github/workflows/test.yml:**
```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

### 6. テストカバレッジ目標

| モジュール | 目標カバレッジ |
|-----------|---------------|
| XAMLパーサー | 90% |
| プロパティ抽出 | 90% |
| 差分検出 | 85% |
| レンダラー | 80% |
| スクリーンショット処理 | 85% |
| GitHub DOM操作 | 75% |
| 全体 | 80% |

---

## 競合・参考

### 既存ソリューション

| 名称 | 特徴 | 制限 |
|------|------|------|
| UiPath XAML support in GitHub (UiPath Marketplace) | 公式拡張機能 | Chrome限定、機能限定的 |
| UiPath Task Capture XAML Import | XAMLからドキュメント生成 | 別ツール必要 |

### 差別化ポイント

1. **リアルタイムプレビュー** - GitHub上で即座に確認
2. **インタラクティブ** - 折りたたみ・検索・ナビゲーション
3. **Diff対応** - PR/コミット差分の視覚化
4. **クロスブラウザ** - 複数ブラウザ対応予定

---

## リスク・課題

| リスク | 影響 | 対策 |
|--------|------|------|
| GitHubのDOM構造変更 | 拡張機能が動作しなくなる | MutationObserverで動的対応、定期メンテナンス |
| 大規模XAMLのパフォーマンス | レンダリング遅延 | 仮想スクロール、遅延読み込み |
| UiPathバージョン差異 | パース失敗 | バージョン検出、フォールバック処理 |

---

## 付録

### A. UiPath XAML構造サンプル

```xml
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main Sequence">
    <ui:LogMessage DisplayName="Log Start" Level="Info" 
                   Message="Process started" />
    <Assign DisplayName="Set Variable">
      <Assign.To>
        <OutArgument x:TypeArguments="x:String">[result]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">"Success"</InArgument>
      </Assign.Value>
    </Assign>
  </Sequence>
</Activity>
```

### B. 用語集

| 用語 | 説明 |
|------|------|
| Activity | UiPathの処理単位（アクション） |
| Sequence | 順次実行コンテナ |
| Flowchart | フロー制御図 |
| DisplayName | アクティビティの表示名 |
| Argument | ワークフローへの入出力パラメータ |
| Variable | ワークフロー内の変数 |
