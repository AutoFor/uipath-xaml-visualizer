---
name: japanese-comments
description: TypeScript/JavaScript コードに日本語の行末コメントを追加する。ユーザーが「コードを書いて」「関数を作成して」「実装して」と言ったときに自動適用します。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
---

# 日本語コメント追加スキル

このスキルは、UiPath XAML Visualizer プロジェクトのコーディング規約に従い、TypeScript/JavaScript コードに日本語の行末コメントを追加します。

## コメント追加のルール

### 基本方針

1. **すべての重要な行に日本語コメントを追加する**
   - 関数/メソッドの宣言
   - 変数の宣言（特に重要なもの）
   - 制御構文（if, for, while など）
   - 重要なロジック

2. **初心者にも理解できる平易な説明を書く**
   - 専門用語は避けるか、説明を加える
   - 「何をしているか」を明確に
   - 「なぜそうするのか」も可能な限り説明

3. **行末コメントを使用する**
   - コードの右側にコメントを配置
   - コードとコメントのバランスを保つ

## コメントの書き方例

### ✅ 良い例

```typescript
function parseXaml(content: string): XamlNode {  // XAML文字列を解析してノードツリーを生成
    const parser = new DOMParser();  // XMLパーサーを初期化
    const doc = parser.parseFromString(content, "text/xml");  // 文字列をXMLドキュメントに変換

    if (doc.querySelector("parsererror")) {  // パースエラーが発生した場合
        throw new Error("無効なXAML形式です");  // エラーをスロー
    }

    return buildNodeTree(doc.documentElement);  // ドキュメント要素からノードツリーを構築
}

const PORT = 3000;  // プレビューサーバーのポート番号
const rootElement = document.getElementById("root");  // ルート要素を取得

for (let i = 0; i < nodes.length; i++) {  // すべてのノードを順番に処理
    processNode(nodes[i]);  // ノードを処理
}
```

### ❌ 悪い例

```typescript
// この関数はXAMLをパースします
function parseXaml(content: string): XamlNode {
    const parser = new DOMParser();
    // パース
    const doc = parser.parseFromString(content, "text/xml");

    // エラーチェック
    if (doc.querySelector("parsererror")) {
        throw new Error("無効なXAML形式です");
    }

    return buildNodeTree(doc.documentElement);
}
```

## コメントのパターン

### 1. 関数/メソッドの宣言

```typescript
function calculateSize(width: number, height: number): number {  // 幅と高さから面積を計算
    return width * height;  // 幅×高さを返す
}

async function loadFile(path: string): Promise<string> {  // ファイルを非同期で読み込む
    const content = await fs.readFile(path, "utf-8");  // UTF-8形式でファイル内容を取得
    return content;  // ファイル内容を返す
}
```

### 2. 変数の宣言

```typescript
const MAX_DEPTH = 10;  // ノードツリーの最大深度
let currentIndex = 0;  // 現在処理中のインデックス
const isValid = checkValidity();  // 入力値の妥当性を確認
```

### 3. 制御構文

```typescript
if (node.children.length > 0) {  // 子ノードが存在する場合
    processChildren(node.children);  // 子ノードを再帰的に処理
}

for (const child of node.children) {  // すべての子ノードを順番に処理
    renderChild(child);  // 子ノードをレンダリング
}

while (queue.length > 0) {  // キューが空になるまで処理を続ける
    const item = queue.shift();  // キューから先頭要素を取り出す
    processItem(item);  // 要素を処理
}
```

### 4. 条件分岐

```typescript
const result = isValid  // 妥当性に応じて結果を決定
    ? "成功"  // 妥当な場合は成功
    : "失敗";  // 無効な場合は失敗
```

### 5. オブジェクト/配列の定義

```typescript
const config = {
    port: 3000,  // サーバーポート
    host: "localhost",  // ホスト名
    debug: true  // デバッグモードの有効化
};

const colors = [
    "#FF0000",  // 赤
    "#00FF00",  // 緑
    "#0000FF"   // 青
];
```

## コメントを省略してもよいケース

以下の場合は、コメントを省略しても構いません：

1. **自明な処理**
   ```typescript
   const sum = a + b;  // コメント不要（明らかに足し算）
   ```

2. **一時変数（スコープが狭い）**
   ```typescript
   const temp = value;  // 一時的な値の保持
   ```

3. **単純な return 文**
   ```typescript
   return true;  // コメント不要（明らかに真を返す）
   ```

## 実装時の注意事項

### コードを新規作成する場合

- 最初から日本語コメントを含めてコードを生成する
- コメントとコードを同時に書く

### 既存コードを編集する場合

- 新しく追加する行には必ず日本語コメントを付ける
- 既存のコメントがない行を編集する場合、コメントを追加する
- 既存のコメントがある行は、そのコメントを更新する

### コメントの長さ

- 1行あたり最大50文字程度を目安にする
- 長い説明が必要な場合は、複数行に分割するか、関数の前にブロックコメントを追加

```typescript
/**
 * XAML文字列を解析してノードツリーを生成する関数
 * @param content - 解析するXAML文字列
 * @returns 生成されたノードツリー
 * @throws パースエラーが発生した場合、Errorをスロー
 */
function parseXaml(content: string): XamlNode {  // XAML文字列を解析
    // ... 実装
}
```

## チェックリスト

コード作成・編集時に以下を確認する：

- [ ] すべての関数/メソッドに日本語コメントがある
- [ ] 重要な変数宣言に日本語コメントがある
- [ ] 制御構文（if, for, while）に日本語コメントがある
- [ ] コメントは初心者にも理解できる平易な日本語である
- [ ] コメントは行末に配置されている
- [ ] コメントとコードのバランスが適切である

## 適用例

### 変更前

```typescript
function renderNode(node: XamlNode) {
    const element = document.createElement("div");
    element.className = "node";
    element.textContent = node.name;

    if (node.children) {
        for (const child of node.children) {
            const childElement = renderNode(child);
            element.appendChild(childElement);
        }
    }

    return element;
}
```

### 変更後

```typescript
function renderNode(node: XamlNode) {  // XAMLノードをDOM要素としてレンダリング
    const element = document.createElement("div");  // 新しいdiv要素を作成
    element.className = "node";  // ノード用のCSSクラスを設定
    element.textContent = node.name;  // ノード名をテキストとして表示

    if (node.children) {  // 子ノードが存在する場合
        for (const child of node.children) {  // すべての子ノードを順番に処理
            const childElement = renderNode(child);  // 子ノードを再帰的にレンダリング
            element.appendChild(childElement);  // レンダリングした子要素を追加
        }
    }

    return element;  // 作成したDOM要素を返す
}
```

## まとめ

- **すべてのコードに日本語の行末コメントを追加**
- **初心者にも理解できる平易な説明**
- **「何をしているか」を明確に記述**
- **自明な処理以外はコメント必須**