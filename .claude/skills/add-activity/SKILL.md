---
name: add-activity
description: UiPath アクティビティの調査・プロパティ選定・レンダラー実装を自動化する。`/add-activity /path/to/sample.xaml` のように XAML パスを指定すると、未実装アクティビティを自動検出して選択・実装できる。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - WebSearch
  - WebFetch
  - AskUserQuestion
  - Skill
  - Task
---

# アクティビティ追加スキル

UiPath アクティビティのビジュアライズ対応を追加するスキル。
XAML パスから未実装アクティビティを自動検出し、調査 → プロパティ選定 → コード実装 → ビルドまでを一貫して実行する。

## 引数

- 第1引数（必須）: XAML ファイルまたはディレクトリのパス
- 引数なしの場合: 「XAML ファイルまたはディレクトリのパスを指定してください（例: `/add-activity /path/to/sample.xaml`）」と表示して **停止する**

## 実行フロー

### Step 1: 引数パース

引数から XAML ファイルまたはディレクトリのパスを取得する。

---

### Step 2: 未実装アクティビティ検出

#### 2a. XAML から全アクティビティタイプを抽出

指定パスの XAML ファイルを Grep で検索し、XML タグ名を抽出する。

- パスがファイルの場合: そのファイルを対象
- パスがディレクトリの場合: `*.xaml` を再帰検索

```
Grep: 指定パスから開始タグ `<` に続くタグ名を抽出
```

- 名前空間プレフィックスを除去して `localName` のみ取得（例: `<uix:NClick` → `NClick`, `<Assign` → `Assign`）
- 重複排除して一覧化

#### 2b. 実装済みタイプを取得

以下の **2箇所** から実装済みアクティビティを収集する:

**① `property-config.ts` の `ACTIVITY_CONFIGS`:**

```
Grep: property-config.ts から ACTIVITY_CONFIGS のキー（'NApplicationCard': 等のパターン）を検索
```

`ACTIVITY_CONFIGS` に登録されているアクティビティタイプを実装済みとする。

**② `sequence-renderer.ts` の特殊レンダリング分岐:**

```
Grep: sequence-renderer.ts から activityType === '([^']+)' パターンを検索
```

マッチしたタイプ名も実装済みリストに追加する。

両方の結果を統合（重複排除）して実装済みリストとする。

#### 2c. コンテナ型・制御フロー型を除外

以下はプロパティ表示不要なため候補から除外する:

- `Sequence`, `Flowchart`, `StateMachine`（コンテナ）
- `If`, `While`, `ForEach`, `Switch`, `TryCatch`（制御フロー）
- `Activity`（抽象型）

#### 2d. 差分計算

```
未実装 = XAML内タイプ - 実装済み - 除外タイプ
```

---

### Step 3: ユーザー選択

未実装アクティビティの件数に応じて分岐:

- **0件**: 「すべてのアクティビティが実装済みです」と表示して **停止する**
- **1件**: 自動選択して次のステップへ進む
- **2件以上**: AskUserQuestion で未実装リストを提示し、ユーザーに選択させる（複数選択可能）

---

### Step 4: 調査フェーズ

選択されたアクティビティに対して、以下のソースを調査する。
XAML パスは Step 1 で取得済みのものをそのまま使用する。

#### 4a. XAML ファイルから属性・子要素を抽出

指定されたパスに対して Grep で対象アクティビティ名を検索する。

- パスがファイルの場合: そのファイル内を検索
- パスがディレクトリの場合: `*.xaml` を再帰検索

```
Grep: {指定パス} から対象アクティビティ名を検索（前後 10行）
```

- マッチした箇所の属性名・子要素名・デフォルト値を記録する

#### 4b. UiPath ドキュメントで説明・プロパティ・翻訳名を取得

```
WebSearch: "UiPath {ActivityName} activity properties"
```

- 検索結果から UiPath 公式ドキュメントの URL を特定
- WebFetch でページ内容を取得し、プロパティ一覧と説明を抽出

**日本語ドキュメントも検索してプロパティ名・アクティビティ名の日本語訳を取得する:**

```
WebSearch: "UiPath {ActivityName} アクティビティ プロパティ" site:docs.uipath.com
```

- 日本語版ページからアクティビティの日本語表示名（例: `Click` → `クリック`）を取得
- 各プロパティの日本語表示名（例: `ClickType` → `クリック種別`）を取得
- 英語名は XAML のキーをそのまま使用する（翻訳不要）
- 日本語名は UiPath 日本語ドキュメントの表記に合わせる（推定ではなくドキュメント準拠）
- 日本語ページが見つからない場合のみ、既存の `i18n.ts` の翻訳パターンを参考に推定する

#### 4c. nupkg XML ドキュメントで補足情報を取得

```
Grep: /mnt/c/Users/SeiyaKawashima/.nuget/packages/ 配下の *.xml から対象アクティビティ名を検索
```

- XML ドキュメント内のメンバー説明（`<member name="...">`）を抽出
- ヒットしない場合はスキップして構わない（N系アクティビティはほぼ未収録）

---

### Step 5: プロパティ分類

調査結果をもとに、表示するプロパティを分類する。

**重要**: パーサーが既にプロパティ除外を行っているため、スキル側で独自の除外リストは持たない。
パーサーが `properties` に残したものだけを対象に重要度を判断する。

#### パーサーの除外ロジック（参照先）

| 箇所 | 何を除外 |
|------|---------|
| `xaml-parser.ts` `extractProperties()` L331-332 | `DisplayName`, `InformativeScreenshot`, `sap2010:Annotation.AnnotationText` を属性から除外 |
| `xaml-parser.ts` `isMetadataElement()` L549-578 | メタデータ要素を除外（`sap:`, `x:` 等のプレフィックス、`Variable`, `Property` 等） |
| `property-config.ts` `isHiddenProperty()` | `sap:`, `sap2010:`, `xmlns`, `mc:`, `mva:` プレフィックスのプロパティを非表示 |
| `property-config.ts` `getSubProperties()` | `DisplayName`, `AssignOperations`, メインプロパティ、メタデータをサブパネルから除外 |

スキルのプロパティ選定ステップでは、パーサーが `properties` に残したものだけを対象に重要度を判断すればよい。
デフォルト値の判定（`KeyModifiers="None"` 等）は XAML の実例と UiPath docs から判断する。

#### プロパティの分類先

`property-config.ts` の `ActivityPropertyConfig` に従い、プロパティを以下に分類する:

| 分類 | 説明 | 対応フィールド |
|------|------|--------------|
| メインプロパティ | アクティビティカードに直接表示 | `mainProperties` |
| サブプロパティ（グループ付き） | サブパネル内にグループ表示 | `subGroups` |
| 非表示 | デフォルト値で表示不要 | （設定に含めない） |

#### デフォルト値の場合に非表示にする候補

以下のプロパティはデフォルト値の場合のみ非表示にする:

| プロパティ | デフォルト値 |
|-----------|------------|
| `ActivateBefore` | `True` |
| `InteractionMode` | `SameAsCard` |
| `KeyModifiers` | `None` |
| `DelayAfter` | `00:00:00.30` または `300` |
| `DelayBefore` | `00:00:00.20` または `200` |
| `TimeoutMS` | `30000` |

#### 重要プロパティの選定基準

以下の優先度で表示プロパティを選定する:

1. **メインプロパティ**: アクティビティの動作を定義する中心的プロパティ（例: Click の `ClickType`, TypeInto の `Text`）
2. **サブプロパティ**: Input / Options / Misc 等のグループに分類して表示
3. **非表示**: デフォルト値であり表示の必要がないプロパティ

---

### Step 6: ユーザーに提案

調査結果とプロパティ分類をユーザーに提示し、承認を求める。

**表示形式:**

```
## {ActivityName} アクティビティの調査結果

### 概要
{UiPath ドキュメントからの説明}

### メインプロパティ（カードに直接表示）
| プロパティ | 日本語名 | 説明 |
|-----------|---------|------|
| {Prop1}   | {日本語名} | {説明} |

### サブプロパティ（サブパネル内にグループ表示）
| グループ | プロパティ | 日本語名 | 説明 |
|---------|-----------|---------|------|
| Input   | {Prop2}   | {日本語名} | {説明} |
| Options | {Prop3}   | {日本語名} | {説明} |

### 翻訳（i18n.ts に追加）
| 種別 | 英語キー | 日本語名 |
|------|---------|---------|
| アクティビティ名 | {ActivityName} | {日本語アクティビティ名} |
| プロパティ名 | {Prop1} | {日本語名} |

### 除外するプロパティ
{除外理由とともにリスト}

この内容で実装してよいですか？
```

AskUserQuestion で承認を求める。ユーザーが変更を希望した場合は調整する。

---

### Step 7: コード実装

承認を得たら、以下のファイルにコードを追加する。

#### 7a. property-config.ts にアクティビティ設定を追加

**ファイル**: `packages/shared/renderer/property-config.ts`
**場所**: `ACTIVITY_CONFIGS` オブジェクトに新しいエントリを追加

**実装パターン（NClick を参考）:**

```typescript
'{ActivityName}': { // {説明}
  mainProperties: ['{Prop1}', '{Prop2}'], // メイン: {説明}
  subGroups: [ // サブパネル内のグループ
    { label: () => t('Input'), properties: ['{Prop3}', '{Prop4}'] }, // 入力グループ
    { label: () => t('Options'), properties: ['{Prop5}', '{Prop6}'] }, // オプショングループ
  ],
},
```

#### 7b. i18n.ts に翻訳を追加

**ファイル**: `packages/shared/i18n/i18n.ts`

Step 4b で取得した UiPath 日本語ドキュメントの表記をもとに、以下のマップにエントリを追加する:

**① `activityTypeMap`**: アクティビティタイプの日本語名を追加

```typescript
'{ActivityName}': '{日本語アクティビティ名}', // {コメント}
```

**② `propertyNameMap`**: プロパティ名の日本語名を追加（既存エントリと重複しないもののみ）

```typescript
'{PropertyName}': '{日本語プロパティ名}', // {コメント}
```

**注意**: 英語名は XAML のキーをそのまま使用する（`currentLanguage === 'en'` の場合は翻訳関数がキーをそのまま返す設計）。

#### 7c. sequence-renderer.ts にプロパティ表示を追加（特殊レンダリングが必要な場合のみ）

**注意**: 7b で i18n を追加済みのため、`translatePropertyName()` が自動的に日本語表示に対応する。

**ファイル**: `packages/shared/renderer/sequence-renderer.ts`
**場所**: `renderProperties()` メソッド内

N系アクティビティ（`N` プレフィックス）の場合:
- `activityType.startsWith('N')` の汎用ハンドラが `getActivityPropertyConfig()` を呼ぶため、`property-config.ts` への設定追加だけで動作する
- **特殊レンダリング**（NApplicationCard の TargetApp 解析のような）が必要な場合のみ、専用の分岐を追加

非N系アクティビティの場合:
- LogMessage パターンを参考に、専用の `if (activityType === '...')` 分岐を追加

**挿入位置**: `renderProperties()` 内の LogMessage 分岐の後、汎用プロパティ表示（`const importantProps = [...]`）の前。

#### 7c. diff-renderer.ts に差分表示を追加

**ファイル**: `packages/shared/renderer/diff-renderer.ts`
**場所**: `renderDiffActivity()` メソッド内（MultipleAssign の分岐の後）

**追加・削除の場合の表示パターン:**

```typescript
// {ActivityName}アクティビティの重要プロパティを表示（追加・削除の場合）
if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
    && diffActivity.activity.type === '{ActivityName}') {
  const props = this.render{ActivityName}Properties(diffActivity.activity, diffActivity.diffType);
  if (props) card.appendChild(props);
}
```

**ヘルパーメソッドのパターン（renderAssignExpression を参考）:**

```typescript
/**
 * {ActivityName}アクティビティの重要プロパティをレンダリング
 */
private render{ActivityName}Properties(activity: Activity, diffType: DiffType): HTMLElement | null {
  const propsDiv = document.createElement('div');
  const isAdded = diffType === DiffType.ADDED;  // 追加か削除かで表示を切替
  const className = isAdded ? 'diff-after' : 'diff-before';
  const prefix = isAdded ? '+' : '-';
  let hasProps = false;

  // 各プロパティを表示
  if (activity.properties['{Prop1}']) {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = `${prefix} {Prop1}: ${this.formatValue(activity.properties['{Prop1}'])}`;
    propsDiv.appendChild(div);
    hasProps = true;
  }

  return hasProps ? propsDiv : null;
}
```

#### 7e. xaml-parser.ts の更新（必要な場合のみ）

**ファイル**: `packages/shared/parser/xaml-parser.ts`

`isActivity()` メソッドの `activityTypes` 配列に対象アクティビティが **含まれていない場合のみ** 追加する。
N系アクティビティ（NClick, NTypeInto 等）は既に登録済みのため、通常は変更不要。

特殊な抽出ロジックが必要な場合（例: MultipleAssign の AssignOperations のような複合プロパティ）は、
パーサーに専用メソッドを追加する。

#### 7f. diff-renderer.ts のアクティビティバッジ追加（任意）

`getActivityBadge()` メソッドのバッジマッピングに対象アクティビティがない場合は追加を検討する。

```typescript
'{ActivityName}': '[{Badge}]',
```

---

### Step 8: ビルド・検証

実装完了後、`/dev-build` スキルを実行して Chrome 拡張機能をビルドする。

```
Skill: dev-build
```

ビルドが成功したら完了メッセージを表示する:

```
## 完了

{ActivityName} アクティビティのビジュアライズ対応を追加しました。

### 変更ファイル
- `packages/shared/renderer/property-config.ts`: アクティビティ設定を追加
- `packages/shared/i18n/i18n.ts`: アクティビティ名・プロパティ名の日本語翻訳を追加
- `packages/shared/renderer/sequence-renderer.ts`: プロパティ表示を追加（特殊レンダリングの場合のみ）
- `packages/shared/renderer/diff-renderer.ts`: 差分表示を追加

### 表示するプロパティ
{プロパティ一覧}
```

---

## 既存実装の参照先

スキル実行時にコードパターンを確認する場合は以下を参照:

| パターン | ファイル | 参照場所 |
|---------|---------|---------|
| アクティビティ名翻訳 | `i18n.ts` | `activityTypeMap` |
| プロパティ名翻訳 | `i18n.ts` | `propertyNameMap` |
| アクティビティ設定（NClick等） | `property-config.ts` | `ACTIVITY_CONFIGS` |
| N系メインプロパティ表示 | `sequence-renderer.ts` | `activityType.startsWith('N')` 分岐 |
| Assign（統合表示） | `sequence-renderer.ts` | `activityType === 'Assign'` 分岐 |
| MultipleAssign（リスト表示） | `sequence-renderer.ts` | `activityType === 'MultipleAssign'` 分岐 |
| NApplicationCard（特殊表示） | `sequence-renderer.ts` | `activityType === 'NApplicationCard'` 分岐 |
| LogMessage（Key-Value表示） | `sequence-renderer.ts` | `activityType === 'LogMessage'` 分岐 |
| 汎用プロパティ表示 | `sequence-renderer.ts` | `importantProps` 配列 |
| Assign 差分表示 | `diff-renderer.ts` | `renderAssignExpression()` |
| MultipleAssign 差分表示 | `diff-renderer.ts` | `renderMultipleAssignExpression()` |

## コーディング規約

- `/japanese-comments` スキルに従い、すべての重要な行に日本語の行末コメントを追加する
- 既存コードのスタイル（インデント、命名規則）に合わせる
