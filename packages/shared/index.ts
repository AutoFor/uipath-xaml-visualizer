// XAMLパーサーのエクスポート
export { XamlParser } from './parser/xaml-parser'; // XAML解析クラス
export { DiffCalculator, buildActivityKey } from './parser/diff-calculator'; // 差分計算クラス・キー生成関数
export { XamlLineMapper } from './parser/line-mapper'; // XAML行番号マッパー

// レンダラーのエクスポート
export { SequenceRenderer } from './renderer/sequence-renderer'; // Sequenceレンダリングクラス
export { TreeViewRenderer } from './renderer/tree-view-renderer'; // ツリービュークラス
export { DiffRenderer } from './renderer/diff-renderer'; // 差分表示レンダリングクラス

// 型定義のエクスポート
export type { Activity, ParsedXaml, Variable, Argument } from './parser/xaml-parser'; // 型定義
export type { DiffResult, DiffActivity, DiffType, PropertyChange } from './parser/diff-calculator'; // 差分型定義
export type { ActivityLineRange, ActivityLineIndex } from './parser/line-mapper'; // 行マッピング型定義
export type { CommentRenderOptions, ReviewCommentData } from './renderer/diff-renderer'; // コメントUI型定義
