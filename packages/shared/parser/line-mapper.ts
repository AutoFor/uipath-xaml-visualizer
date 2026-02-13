/**
 * XAML行番号マッパー
 * XAMLテキストを行単位でスキャンし、各アクティビティの開始行・終了行を特定する
 */


/**
 * アクティビティの行範囲
 */
export interface ActivityLineRange {
  activityKey: string;   // アクティビティの一意キー
  displayName: string;   // 表示名
  type: string;          // アクティビティタイプ
  startLine: number;     // 開始行（1-based）
  endLine: number;       // 終了行（1-based）
}

/**
 * 双方向インデックス
 */
export interface ActivityLineIndex {
  keyToLines: Map<string, ActivityLineRange>;  // アクティビティキー → 行範囲
  lineToKey: Map<number, string>;              // 行番号 → アクティビティキー
}

/**
 * XMLタグ情報
 */
interface TagInfo {
  line: number;         // タグが出現する行番号（1-based）
  tagName: string;      // タグ名（名前空間プレフィックス除去済み）
  fullTagName: string;  // 完全なタグ名（プレフィックス付き）
  isClose: boolean;     // 閉じタグかどうか
  isSelfClose: boolean; // 自己閉じタグかどうか
  attributes: Map<string, string>; // 属性名→値のマップ
}

/**
 * XAML行番号マッパークラス
 */
export class XamlLineMapper {
  /**
   * XAMLテキストから行番号インデックスを構築
   */
  static buildLineMap(xamlText: string): ActivityLineIndex {
    const keyToLines = new Map<string, ActivityLineRange>(); // キー→行範囲マップ
    const lineToKey = new Map<number, string>(); // 行→キーマップ

    if (!xamlText) {
      return { keyToLines, lineToKey }; // 空テキストの場合は空マップを返す
    }

    const lines = xamlText.split('\n'); // 行に分割
    const tagStack: { tagName: string; startLine: number; attributes: Map<string, string> }[] = []; // タグスタック
    const activityCounters = new Map<string, number>(); // アクティビティタイプごとの出現回数

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1; // 1-based行番号
      const line = lines[i]; // 現在の行

      const tags = XamlLineMapper.extractTags(line, lineNum); // 行内のタグを抽出

      for (const tag of tags) {
        if (tag.isSelfClose) {
          // 自己閉じタグ: 1行で完結するアクティビティ
          XamlLineMapper.registerActivity(
            tag, lineNum, lineNum,
            activityCounters, keyToLines, lineToKey
          );
        } else if (tag.isClose) {
          // 閉じタグ: スタックから対応する開始タグを検索
          for (let j = tagStack.length - 1; j >= 0; j--) {
            if (tagStack[j].tagName === tag.tagName) {
              const openTag = tagStack.splice(j, 1)[0]; // スタックから取り出し
              XamlLineMapper.registerActivityFromStack(
                openTag, lineNum,
                activityCounters, keyToLines, lineToKey
              );
              break;
            }
          }
        } else {
          // 開始タグ: スタックにプッシュ
          tagStack.push({
            tagName: tag.tagName,
            startLine: lineNum,
            attributes: tag.attributes
          });
        }
      }
    }

    return { keyToLines, lineToKey }; // 構築したインデックスを返す
  }

  /**
   * 行からXMLタグを抽出
   */
  private static extractTags(line: string, lineNum: number): TagInfo[] {
    const tags: TagInfo[] = []; // 抽出結果

    // XMLタグを検出する正規表現（開始タグ、閉じタグ、自己閉じタグ）
    const tagPattern = /<(\/?)([a-zA-Z0-9_:.]+)((?:\s+[^>]*?)?)(\/?)\s*>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(line)) !== null) {
      const isClose = match[1] === '/'; // 閉じタグかどうか
      const fullTagName = match[2]; // 完全なタグ名
      const attrStr = match[3]; // 属性文字列
      const isSelfClose = match[4] === '/'; // 自己閉じタグかどうか

      // 名前空間プレフィックスを除去したタグ名
      const tagName = fullTagName.includes(':')
        ? fullTagName.split(':').pop()! // コロン以降を取得
        : fullTagName;

      // 属性を解析
      const attributes = new Map<string, string>();
      if (attrStr) {
        const attrPattern = /([a-zA-Z0-9_:.]+)\s*=\s*"([^"]*)"/g; // 属性パターン
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrPattern.exec(attrStr)) !== null) {
          attributes.set(attrMatch[1], attrMatch[2]); // 属性を記録
        }
      }

      tags.push({
        line: lineNum,
        tagName,
        fullTagName,
        isClose,
        isSelfClose,
        attributes
      });
    }

    return tags;
  }

  /**
   * 自己閉じタグのアクティビティを登録
   */
  private static registerActivity(
    tag: TagInfo,
    startLine: number,
    endLine: number,
    counters: Map<string, number>,
    keyToLines: Map<string, ActivityLineRange>,
    lineToKey: Map<number, string>
  ): void {
    const idRef = tag.attributes.get('sap2010:WorkflowViewState.IdRef'); // IdRef属性
    const displayName = tag.attributes.get('DisplayName') || tag.tagName; // 表示名
    const type = tag.tagName; // アクティビティタイプ

    // インデックスをカウント（buildActivityKeyと同じフォールバックロジック）
    const counterKey = `${type}_${displayName}`; // カウンターキー
    const index = counters.get(counterKey) || 0; // 現在のインデックス
    counters.set(counterKey, index + 1); // インクリメント

    // アクティビティキーを生成（buildActivityKeyと同じロジック）
    const activityKey = idRef || `${type}_${displayName}_${index}`;

    const range: ActivityLineRange = { activityKey, displayName, type, startLine, endLine };
    keyToLines.set(activityKey, range); // キー→行範囲を登録

    // 行番号→キーのマッピングを登録
    for (let line = startLine; line <= endLine; line++) {
      lineToKey.set(line, activityKey); // 各行にキーを割り当て
    }
  }

  /**
   * スタックから取り出した開始タグ情報でアクティビティを登録
   */
  private static registerActivityFromStack(
    openTag: { tagName: string; startLine: number; attributes: Map<string, string> },
    endLine: number,
    counters: Map<string, number>,
    keyToLines: Map<string, ActivityLineRange>,
    lineToKey: Map<number, string>
  ): void {
    const idRef = openTag.attributes.get('sap2010:WorkflowViewState.IdRef'); // IdRef属性
    const displayName = openTag.attributes.get('DisplayName') || openTag.tagName; // 表示名
    const type = openTag.tagName; // アクティビティタイプ

    // インデックスをカウント
    const counterKey = `${type}_${displayName}`; // カウンターキー
    const index = counters.get(counterKey) || 0; // 現在のインデックス
    counters.set(counterKey, index + 1); // インクリメント

    // アクティビティキーを生成
    const activityKey = idRef || `${type}_${displayName}_${index}`;

    const range: ActivityLineRange = {
      activityKey,
      displayName,
      type,
      startLine: openTag.startLine,
      endLine
    };
    keyToLines.set(activityKey, range); // キー→行範囲を登録

    // 行番号→キーのマッピングを登録
    for (let line = openTag.startLine; line <= endLine; line++) {
      lineToKey.set(line, activityKey); // 各行にキーを割り当て
    }
  }
}
