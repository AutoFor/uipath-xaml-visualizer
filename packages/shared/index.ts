// XAMLパーサーのエクスポート
export { XamlParser } from './parser/xaml-parser'; // XAML解析クラス
export { DiffCalculator, buildActivityKey } from './parser/diff-calculator'; // 差分計算クラス・キー生成関数
export { XamlLineMapper } from './parser/line-mapper'; // XAML行番号マッパー

// レンダラーのエクスポート
export { SequenceRenderer } from './renderer/sequence-renderer'; // Sequenceレンダリングクラス
export type { ScreenshotPathResolver } from './renderer/sequence-renderer'; // スクリーンショットパスリゾルバー型
export { TreeViewRenderer } from './renderer/tree-view-renderer'; // ツリービュークラス
export { DiffRenderer } from './renderer/diff-renderer'; // 差分表示レンダリングクラス
export { isHiddenProperty, getActivityPropertyConfig, getSubProperties, hasSubPanel } from './renderer/property-config'; // プロパティ分類関数
export type { PropertyGroup, ActivityPropertyConfig } from './renderer/property-config'; // プロパティ分類型

// i18n（国際化）のエクスポート
export { setLanguage, getLanguage, translateActivityType, translatePropertyName, t } from './i18n/i18n'; // 翻訳関数
export type { Language } from './i18n/i18n'; // 言語型

// 型定義のエクスポート
export type { Activity, ParsedXaml, Variable, Argument } from './parser/xaml-parser'; // 型定義
export type { DiffResult, DiffActivity, DiffType, PropertyChange } from './parser/diff-calculator'; // 差分型定義
export type { ActivityLineRange, ActivityLineIndex } from './parser/line-mapper'; // 行マッピング型定義
