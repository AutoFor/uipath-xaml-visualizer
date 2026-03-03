// Parser exports
export { XamlParser } from './parser/xaml-parser'; // XAML parser class
export { DiffCalculator, buildActivityKey } from './parser/diff-calculator'; // Diff calculator and key builder
export { XamlLineMapper } from './parser/line-mapper'; // XAML line number mapper

// Renderer exports
export { SequenceRenderer } from './renderer/sequence-renderer'; // Sequence renderer class
export type { ScreenshotPathResolver } from './renderer/sequence-renderer'; // Screenshot path resolver type
export { TreeViewRenderer } from './renderer/tree-view-renderer'; // Tree view renderer class
export { DiffRenderer } from './renderer/diff-renderer'; // Diff renderer class
export { isHiddenProperty, getActivityPropertyConfig, getSubProperties, hasSubPanel, isDefinedActivity, categorizeDiffChanges } from './renderer/property-config'; // Property classification functions
export type { PropertyGroup, ActivityPropertyConfig } from './renderer/property-config'; // Property classification types

// i18n (internationalization) exports
export { setLanguage, getLanguage, translateActivityType, translatePropertyName, t } from './i18n/i18n'; // Translation functions
export type { Language } from './i18n/i18n'; // Language type

// Type definition exports
export type { Activity, ParsedXaml, Variable, Argument } from './parser/xaml-parser'; // Core types
export type { DiffResult, DiffActivity, DiffType, PropertyChange } from './parser/diff-calculator'; // Diff types
export type { ActivityLineRange, ActivityLineIndex } from './parser/line-mapper'; // Line mapping types
