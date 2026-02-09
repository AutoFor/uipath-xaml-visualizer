// XAMLパーサーのエクスポート
export { parseXaml } from './parser/xaml-parser'; // XAML解析関数
export { calculateDiff } from './parser/diff-calculator'; // 差分計算関数

// レンダラーのエクスポート
export { renderSequence } from './renderer/sequence-renderer'; // Sequenceレンダリング関数
export { renderTreeView } from './renderer/tree-view-renderer'; // ツリービューレンダリング関数
export { renderDiff } from './renderer/diff-renderer'; // 差分表示レンダリング関数

// 型定義のエクスポート（必要に応じて追加）
export type { Activity, WorkflowData } from './parser/xaml-parser'; // 型定義
export type { DiffResult, DiffItem } from './parser/diff-calculator'; // 差分型定義
