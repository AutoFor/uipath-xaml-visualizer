/**
 * ローカルテスト用のスタンドアロンビューア
 * ブラウザのグローバルスコープに公開
 */

import { XamlParser } from './parser/xaml-parser';
import { SequenceRenderer } from './renderer/sequence-renderer';
import { TreeViewRenderer } from './renderer/tree-view-renderer';

// グローバルスコープに公開
export default {
  XamlParser,
  SequenceRenderer,
  TreeViewRenderer
};
