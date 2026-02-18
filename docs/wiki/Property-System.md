# プロパティ・サブプロパティの仕組み

## 概要

UiPath XAML Visualizer では、各アクティビティが持つプロパティ（設定値）を **メインプロパティ** と **サブプロパティ** の 2 層に分類して表示します。重要な情報はカード上にすぐ見える形で、詳細設定は折りたたみパネルの中に配置することで、視認性と情報量のバランスを取っています。

```
┌─────────────────────────────────┐
│ [アイコン] Click                │  ← アクティビティカード
│                                 │
│  Target: "btnSubmit"            │  ← メインプロパティ（常に表示）
│                                 │
│  ▶ プロパティ詳細               │  ← サブプロパティ（折りたたみ）
│    ┌─ Target ─────────────────┐ │
│    │ FullSelectorArgument     │ │
│    │ ObjectRepository         │ │
│    ├─ Input ──────────────────┤ │
│    │ ClickType                │ │
│    │ MouseButton              │ │
│    ├─ Options ────────────────┤ │
│    │ InteractionMode          │ │
│    │ ActivateBefore           │ │
│    └──────────────────────────┘ │
└─────────────────────────────────┘
```

## プロパティの分類

すべてのプロパティは、以下の 3 つのカテゴリに分類されます。

| カテゴリ | 表示場所 | 例 |
|---------|---------|-----|
| **メインプロパティ** | カード上に直接表示 | `Target`, `To`, `Value`, `Message` |
| **サブプロパティ** | 折りたたみパネル内に表示 | `ClickType`, `InteractionMode`, `DelayBefore` |
| **非表示プロパティ** | 表示しない | `sap:VirtualizedContainerService.HintSize`, `xmlns:ui` |

### メインプロパティ

アクティビティの**最も重要な設定値**です。カード上に常に表示され、ワークフローの流れを一目で把握できます。

どのプロパティがメインになるかは、アクティビティごとに `property-config.ts` の `ACTIVITY_CONFIGS` で定義されています。

### サブプロパティ

メインプロパティ以外の**補助的な設定値**です。折りたたみパネル（「プロパティ詳細」ボタン）の中にグループ分けされて表示されます。

### 非表示プロパティ

XAML の内部メタデータなど、ユーザーが見る必要のないプロパティです。以下のプレフィックスで始まるものが自動的に除外されます。

| プレフィックス | 意味 |
|--------------|------|
| `sap:` | System.Activities.Presentation 名前空間 |
| `sap2010:` | System.Activities.Presentation 2010 名前空間 |
| `xmlns` | XML 名前空間宣言 |
| `mc:` | Markup Compatibility 名前空間 |
| `mva:` | Microsoft.VisualBasic.Activities 名前空間 |

さらに、以下のプロパティ名も個別に除外されます。

| プロパティ名 | 理由 |
|-------------|------|
| `DisplayName` | カードのヘッダーに表示済み |
| `Body` | アクティビティコンテナ（子要素として描画） |
| `ScopeGuid`, `ScopeIdentifier` | 内部管理用 ID |
| `Version` | 内部バージョン情報 |
| `AssignOperations` | MultipleAssign の専用レンダリングで処理 |
| `VerifyOptions` | 複合オブジェクト（展開すると冗長） |

## 表示・非表示の判定フロー

プロパティの表示先は、以下のフローで決定されます。

```
プロパティを取得
  │
  ├─ 非表示プレフィックス（sap:, xmlns 等）に該当？ → 非表示
  ├─ 個別除外リスト（DisplayName, Body 等）に該当？ → 非表示
  │
  ├─ アクティビティが「定義済み」か？
  │   │
  │   ├─ NO（未定義アクティビティ）→ 全プロパティ非表示
  │   │
  │   └─ YES
  │       │
  │       ├─ ACTIVITY_CONFIGS に登録あり？
  │       │   ├─ mainProperties に含まれる → メイン表示
  │       │   └─ 含まれない → サブパネル（グループ分け表示）
  │       │
  │       ├─ 専用レンダリング（Assign, LogMessage 等）？
  │       │   └─ 専用ロジックで表示
  │       │
  │       └─ その他の定義済み（N プレフィックス等）？
  │           ├─ DEFAULT_MAIN_PROPERTIES に含まれる → メイン表示
  │           └─ 含まれない → サブパネル（グループなし）
  │
  └─ 結果: メイン ／ サブ ／ 非表示
```

## アクティビティ別の設定

### ACTIVITY_CONFIGS に登録済みのアクティビティ

以下のアクティビティは、メインプロパティとサブパネルのグループが明示的に定義されています。

#### NApplicationCard（アプリケーションカード）

| 区分 | プロパティ |
|------|----------|
| **メイン** | `TargetApp`（URL を抽出して表示） |
| **サブ: Target** | `Selector`, `ObjectRepository` |
| **サブ: Input** | `AttachMode` |
| **サブ: Options** | `InteractionMode`, `HealingAgentBehavior` |

#### NClick（クリック）

| 区分 | プロパティ |
|------|----------|
| **メイン** | `Target` |
| **サブ: Target** | `FullSelectorArgument`, `FuzzySelectorArgument`, `ObjectRepository` |
| **サブ: Input** | `ClickType`, `CursorMotionType`, `MouseButton` |
| **サブ: Options** | `ActivateBefore`, `AlterDisabledElement`, `InteractionMode`, `KeyModifiers` |

#### NTypeInto（文字入力）

| 区分 | プロパティ |
|------|----------|
| **メイン** | `Target`, `Text` |
| **サブ: Input** | `ClickType`, `MouseButton`, `KeyModifiers` |
| **サブ: Options** | `ActivateBefore`, `InteractionMode`, `EmptyField`, `DelayBetweenKeys`, `DelayBefore`, `DelayAfter` |

#### NGetText（テキスト取得）

| 区分 | プロパティ |
|------|----------|
| **メイン** | `Target`, `Value` |
| **サブ: Options** | `ActivateBefore`, `InteractionMode` |

### 専用レンダリングのアクティビティ

以下のアクティビティは、ACTIVITY_CONFIGS を使わず、専用のレンダリングロジックを持っています。

| アクティビティ | 表示方法 | サブパネル |
|--------------|---------|-----------|
| **Assign** | `To = Value` の代入式形式で表示 | なし |
| **MultipleAssign** | `AssignOperations` の各代入式を一覧表示 | なし |
| **LogMessage** | `Level` と `Message` のみ表示 | あり |

### デフォルト設定（上記以外の定義済みアクティビティ）

ACTIVITY_CONFIGS に未登録だが定義済みと判定されるアクティビティ（N プレフィックス等）は、以下のデフォルトメインプロパティが適用されます。

```
To, Value, Condition, Selector, Message
```

これらに該当するプロパティがメインに、それ以外がサブパネルに表示されます（グループ分けなし）。

## 定義済みアクティビティの判定

`isDefinedActivity()` 関数で判定されます。以下のいずれかに該当すると「定義済み」です。

| 条件 | 例 |
|------|-----|
| `Assign` | Assign |
| `MultipleAssign` | MultipleAssign |
| `LogMessage` | LogMessage |
| `ACTIVITY_CONFIGS` に登録 | NClick, NTypeInto, NGetText, NApplicationCard |
| `N` で始まる | NMessageBox, NDelay 等のモダンアクティビティ |

**未定義アクティビティ**（上記に該当しないもの）は、プロパティとサブパネルが完全に非表示になります。さらに、子要素も全て未定義であれば、子要素も非表示になります。

## 差分表示でのプロパティ分類

PR やコミットの差分表示では、変更があったプロパティを**メイン変更**と**サブ変更**に分類します。

### 分類ルール

```
ACTIVITY_CONFIGS に登録済みか？
  │
  ├─ NO → 全変更をメイン表示（従来どおり）
  │
  └─ YES
      │
      ├─ mainProperties に含まれる？
      │   ├─ YES → 値がオブジェクト型か？
      │   │          ├─ YES → サブに移動（展開すると冗長なため）
      │   │          └─ NO  → メイン表示
      │   └─ NO  → サブに移動
      │
      └─ 結果: メイン変更 ／ サブ変更
```

**ポイント**: メインプロパティであっても、値がオブジェクト型（`Target` の中に `Selector`, `Reference` 等を含む複合構造）の場合は、展開するとノイズが多いためサブパネルに移動します。

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `packages/shared/renderer/property-config.ts` | プロパティ分類の設定・判定ロジック |
| `packages/shared/renderer/sequence-renderer.ts` | メインプロパティ・サブパネルのレンダリング |
| `packages/shared/parser/xaml-parser.ts` | XAML からのプロパティ抽出 |
| `packages/github-extension/src/content.ts` | 差分表示でのプロパティ分類呼び出し |
