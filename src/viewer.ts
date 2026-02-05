import * as SDK from 'azure-devops-extension-sdk';
import { XamlParser } from './parser/xaml-parser';
import { SequenceRenderer } from './renderer/sequence-renderer';
import { TreeViewRenderer } from './renderer/tree-view-renderer';
import './styles/main.css';

// Azure DevOps SDK を初期化
SDK.init();

/**
 * XAMLビューアのメインクラス
 */
class XamlViewer {
  private parser: XamlParser;                    // XAMLパーサーのインスタンス
  private sequenceRenderer: SequenceRenderer;    // Sequenceレンダラー
  private treeRenderer: TreeViewRenderer;        // ツリービューレンダラー
  private currentXaml: string = '';              // 現在読み込まれているXAML
  private isVisualMode: boolean = true;          // ビジュアルモード/Rawモード

  constructor() {
    this.parser = new XamlParser();
    this.sequenceRenderer = new SequenceRenderer();
    this.treeRenderer = new TreeViewRenderer();
    this.initializeEventListeners();             // イベントリスナーを初期化
  }

  /**
   * イベントリスナーを初期化
   */
  private initializeEventListeners(): void {
    // ビュー切替ボタン
    const toggleViewBtn = document.getElementById('toggle-view');
    toggleViewBtn?.addEventListener('click', () => this.toggleView());

    // ツリー表示切替ボタン
    const toggleTreeBtn = document.getElementById('toggle-tree');
    toggleTreeBtn?.addEventListener('click', () => this.toggleTreeView());

    // 詳細パネル閉じるボタン
    const closePanelBtn = document.getElementById('close-panel');
    closePanelBtn?.addEventListener('click', () => this.closeDetailPanel());
  }

  /**
   * Azure DevOps からファイル内容を取得して表示
   */
  async loadFile(): Promise<void> {
    try {
      this.showLoading(true);                    // ローディング表示

      // Azure DevOps SDK を使用してファイル内容を取得
      await SDK.ready();
      const config = SDK.getConfiguration();
      const fileContent = config.fileContent;    // ファイル内容を取得

      if (!fileContent) {
        throw new Error('ファイル内容を取得できませんでした');
      }

      this.currentXaml = fileContent;
      await this.renderXaml(fileContent);        // XAMLをレンダリング

      this.showLoading(false);                   // ローディング非表示
    } catch (error) {
      this.showError(error instanceof Error ? error.message : '不明なエラー');
      this.showLoading(false);
    }
  }

  /**
   * XAMLをパースしてビジュアル表示
   */
  private async renderXaml(xaml: string): Promise<void> {
    // XAMLをパース
    const parsedData = this.parser.parse(xaml);

    // ツリービューを生成
    const treeContent = document.getElementById('tree-content');
    if (treeContent) {
      this.treeRenderer.render(parsedData, treeContent);
    }

    // メインビューを生成
    const visualView = document.getElementById('visual-view');
    if (visualView) {
      this.sequenceRenderer.render(parsedData, visualView);
    }

    // Raw XMLも準備
    const rawXml = document.getElementById('raw-xml');
    if (rawXml) {
      rawXml.textContent = xaml;
    }
  }

  /**
   * ビジュアルモード/Rawモード切替
   */
  private toggleView(): void {
    this.isVisualMode = !this.isVisualMode;

    const visualView = document.getElementById('visual-view');
    const rawView = document.getElementById('raw-view');
    const toggleBtn = document.getElementById('toggle-view');

    if (this.isVisualMode) {
      visualView!.style.display = 'block';      // ビジュアル表示
      rawView!.style.display = 'none';          // Raw非表示
      toggleBtn!.textContent = 'Raw XML';
    } else {
      visualView!.style.display = 'none';       // ビジュアル非表示
      rawView!.style.display = 'block';         // Raw表示
      toggleBtn!.textContent = 'Visual View';
    }
  }

  /**
   * ツリービュー表示切替
   */
  private toggleTreeView(): void {
    const treeView = document.getElementById('tree-view');
    if (treeView) {
      treeView.classList.toggle('hidden');      // hiddenクラスをトグル
    }
  }

  /**
   * 詳細パネルを閉じる
   */
  private closeDetailPanel(): void {
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) {
      detailPanel.style.display = 'none';       // 詳細パネルを非表示
    }
  }

  /**
   * ローディング表示切替
   */
  private showLoading(show: boolean): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * エラー表示
   */
  private showError(message: string): void {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');

    if (errorDiv && errorMessage) {
      errorMessage.textContent = message;
      errorDiv.style.display = 'block';
    }
  }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  const viewer = new XamlViewer();
  viewer.loadFile();                            // ファイルを読み込んで表示
});
