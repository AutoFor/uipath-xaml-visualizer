import * as SDK from 'azure-devops-extension-sdk';
import { XamlParser } from './parser/xaml-parser';
import { DiffCalculator } from './parser/diff-calculator';
import { DiffRenderer } from './renderer/diff-renderer';
import './styles/main.css';
import './styles/diff.css';

/**
 * XAML差分ビューアのメインクラス
 */
class XamlDiffViewer {
  private parser: XamlParser;                    // XAMLパーサー
  private diffCalculator: DiffCalculator;        // 差分計算機
  private diffRenderer: DiffRenderer;            // 差分レンダラー
  private currentFilter: string = 'all';         // 現在のフィルタ設定

  constructor() {
    this.parser = new XamlParser();
    this.diffCalculator = new DiffCalculator();
    this.diffRenderer = new DiffRenderer();
    this.initializeEventListeners();             // イベントリスナーを初期化
  }

  /**
   * イベントリスナーを初期化
   */
  private initializeEventListeners(): void {
    // フィルタ選択
    const filterSelect = document.getElementById('filter-type') as HTMLSelectElement;
    filterSelect?.addEventListener('change', (e) => {
      this.currentFilter = (e.target as HTMLSelectElement).value;
      this.applyFilter();                       // フィルタを適用
    });

    // サマリー/詳細ビュー切替
    const summaryBtn = document.getElementById('summary-view');
    const detailBtn = document.getElementById('detail-view');

    summaryBtn?.addEventListener('click', () => {
      summaryBtn.classList.add('active');
      detailBtn?.classList.remove('active');
      this.showSummaryView();                   // サマリービューを表示
    });

    detailBtn?.addEventListener('click', () => {
      detailBtn.classList.add('active');
      summaryBtn?.classList.remove('active');
      this.showDetailView();                    // 詳細ビューを表示
    });
  }

  /**
   * Azure DevOps から差分データを取得して表示
   */
  async loadDiff(): Promise<void> {
    try {
      this.showLoading(true);                    // ローディング表示

      // Azure DevOps SDK を使用して差分データを取得
      await SDK.ready();
      const config = SDK.getConfiguration();
      const beforeContent = config.beforeContent; // 変更前のXAML
      const afterContent = config.afterContent;   // 変更後のXAML

      if (!beforeContent || !afterContent) {
        throw new Error('差分データを取得できませんでした');
      }

      await this.renderDiff(beforeContent, afterContent);

      this.showLoading(false);                   // ローディング非表示
    } catch (error) {
      this.showError(error instanceof Error ? error.message : '不明なエラー');
      this.showLoading(false);
    }
  }

  /**
   * 差分を計算してレンダリング
   */
  private async renderDiff(beforeXaml: string, afterXaml: string): Promise<void> {
    // XAMLをパース
    const beforeData = this.parser.parse(beforeXaml);
    const afterData = this.parser.parse(afterXaml);

    // 差分を計算
    const diff = this.diffCalculator.calculate(beforeData, afterData);

    // 差分を表示
    const diffContent = document.getElementById('diff-content');
    if (diffContent) {
      this.diffRenderer.render(diff, diffContent);
    }
  }

  /**
   * フィルタを適用
   */
  private applyFilter(): void {
    const items = document.querySelectorAll('.diff-item');
    items.forEach(item => {
      const element = item as HTMLElement;
      if (this.currentFilter === 'all') {
        element.style.display = 'block';        // すべて表示
      } else {
        // フィルタに一致するものだけ表示
        element.style.display = element.classList.contains(`diff-${this.currentFilter}`)
          ? 'block'
          : 'none';
      }
    });
  }

  /**
   * サマリービューを表示
   */
  private showSummaryView(): void {
    // 簡易表示モード（変更プロパティ数のみ表示）
    const detailElements = document.querySelectorAll('.property-diff-detail');
    detailElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  /**
   * 詳細ビューを表示
   */
  private showDetailView(): void {
    // 詳細表示モード（すべてのプロパティ変更を表示）
    const detailElements = document.querySelectorAll('.property-diff-detail');
    detailElements.forEach(el => {
      (el as HTMLElement).style.display = 'block';
    });
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
  const viewer = new XamlDiffViewer();
  viewer.loadDiff();                            // 差分データを読み込んで表示
});
