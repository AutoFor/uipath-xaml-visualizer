import { DiffResult, DiffActivity, DiffType, PropertyChange } from '../parser/diff-calculator';
import { Activity } from '../parser/xaml-parser';

/**
 * 差分レンダラー
 */
export class DiffRenderer {
  /**
   * 差分結果をHTMLとしてレンダリング
   */
  render(diff: DiffResult, container: HTMLElement): void {
    container.innerHTML = '';                   // コンテナをクリア

    // 追加されたアクティビティ
    diff.added.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });

    // 削除されたアクティビティ
    diff.removed.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });

    // 変更されたアクティビティ
    diff.modified.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });
  }

  /**
   * 差分アクティビティをレンダリング
   */
  private renderDiffActivity(diffActivity: DiffActivity): HTMLElement {
    const card = document.createElement('div');
    card.className = `diff-item activity-card diff-${diffActivity.diffType}`;
    card.dataset.id = diffActivity.activity.id;

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'activity-header';

    const icon = this.getActivityIcon(diffActivity.activity.type);
    const badge = this.getDiffBadge(diffActivity.diffType);

    const title = document.createElement('span');
    title.className = 'activity-title';
    title.innerHTML = `${icon} ${diffActivity.activity.type}: ${diffActivity.activity.displayName} ${badge}`;

    header.appendChild(title);
    card.appendChild(header);

    // Assignアクティビティの代入式を表示（追加・削除の場合）
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'Assign') {
      const expr = this.renderAssignExpression(diffActivity.activity, diffActivity.diffType);
      if (expr) card.appendChild(expr);          // 代入式があれば表示
    }

    // 変更内容を表示（変更の場合のみ）
    if (diffActivity.diffType === DiffType.MODIFIED && diffActivity.changes) {
      if (diffActivity.activity.type === 'Assign') {
        const assignChanges = this.renderAssignChanges(diffActivity);  // Assign専用の変更表示
        card.appendChild(assignChanges);
      } else {
        const changesDiv = this.renderPropertyChanges(diffActivity.changes);
        card.appendChild(changesDiv);
      }
    }

    // スクリーンショット変更を表示
    if (this.hasScreenshotChange(diffActivity)) {
      const screenshotDiff = this.renderScreenshotDiff(diffActivity);
      card.appendChild(screenshotDiff);
    }

    return card;
  }

  /**
   * プロパティ変更をレンダリング
   */
  private renderPropertyChanges(changes: PropertyChange[]): HTMLElement {
    const changesDiv = document.createElement('div');
    changesDiv.className = 'property-changes';

    const changesList = document.createElement('div');
    changesList.className = 'property-diff-detail';

    changes.forEach(change => {
      const changeItem = document.createElement('div');
      changeItem.className = 'property-change-item';

      // プロパティ名
      const propName = document.createElement('div');
      propName.className = 'prop-name';
      propName.textContent = `${change.propertyName}:`;

      // Before値
      const beforeValue = document.createElement('div');
      beforeValue.className = 'diff-before';
      beforeValue.textContent = `- ${this.formatValue(change.before)}`;

      // After値
      const afterValue = document.createElement('div');
      afterValue.className = 'diff-after';
      afterValue.textContent = `+ ${this.formatValue(change.after)}`;

      changeItem.appendChild(propName);
      changeItem.appendChild(beforeValue);
      changeItem.appendChild(afterValue);
      changesList.appendChild(changeItem);
    });

    changesDiv.appendChild(changesList);
    return changesDiv;
  }

  /**
   * スクリーンショット変更があるかチェック
   */
  private hasScreenshotChange(diffActivity: DiffActivity): boolean {
    if (diffActivity.diffType !== DiffType.MODIFIED) {
      return false;
    }

    return diffActivity.changes?.some(
      change => change.propertyName === 'InformativeScreenshot'
    ) || false;
  }

  /**
   * スクリーンショット差分をレンダリング
   */
  private renderScreenshotDiff(diffActivity: DiffActivity): HTMLElement {
    const screenshotDiffDiv = document.createElement('div');
    screenshotDiffDiv.className = 'screenshot-compare';

    const header = document.createElement('div');
    header.className = 'screenshot-header';
    header.textContent = '📷 Screenshot 変更:';

    const compareContainer = document.createElement('div');
    compareContainer.className = 'compare-container';

    // Before画像
    const beforeScreenshot = diffActivity.beforeActivity?.informativeScreenshot;
    if (beforeScreenshot) {
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'screenshot-before';
      beforeDiv.innerHTML = `
        <div class="label">Before</div>
        <img src=".screenshots/${beforeScreenshot}" alt="Before" />
      `;
      compareContainer.appendChild(beforeDiv);
    }

    // After画像
    const afterScreenshot = diffActivity.activity.informativeScreenshot;
    if (afterScreenshot) {
      const afterDiv = document.createElement('div');
      afterDiv.className = 'screenshot-after';
      afterDiv.innerHTML = `
        <div class="label">After</div>
        <img src=".screenshots/${afterScreenshot}" alt="After" />
      `;
      compareContainer.appendChild(afterDiv);
    }

    screenshotDiffDiv.appendChild(header);
    screenshotDiffDiv.appendChild(compareContainer);

    return screenshotDiffDiv;
  }

  /**
   * Assignアクティビティの代入式をレンダリング
   */
  private renderAssignExpression(activity: Activity, diffType: DiffType): HTMLElement | null {
    const to = activity.properties['To'];        // 代入先（左辺）
    const value = activity.properties['Value'];  // 代入値（右辺）
    if (!to && !value) return null;              // 両方なければ表示しない

    const div = document.createElement('div');
    const isAdded = diffType === DiffType.ADDED;  // 追加か削除かで表示を切替
    div.className = isAdded ? 'diff-after' : 'diff-before';
    const prefix = isAdded ? '+' : '-';
    div.textContent = `${prefix} ${this.formatValue(to)} = ${this.formatValue(value)}`;
    return div;
  }

  /**
   * Assignアクティビティの変更詳細をレンダリング
   */
  private renderAssignChanges(diffActivity: DiffActivity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-changes';

    // To/Valueの変更を「左辺/右辺」ラベル付きでGitHub風diff表示
    const assignChanges = diffActivity.changes?.filter(
      c => c.propertyName === 'To' || c.propertyName === 'Value'
    ) || [];

    assignChanges.forEach(change => {
      const item = document.createElement('div');
      item.className = 'property-change-item';

      // 左辺/右辺のラベル
      const sideLabel = document.createElement('span');
      const isLeft = change.propertyName === 'To';  // Toは左辺、Valueは右辺
      sideLabel.className = `assign-change-side ${isLeft ? 'left' : 'right'}`;
      sideLabel.textContent = isLeft ? '左辺' : '右辺';

      const propLabel = document.createElement('span');
      propLabel.className = 'assign-change-label';
      propLabel.textContent = ` (${change.propertyName}):`;

      // 変更前の値（赤）
      const beforeValue = document.createElement('div');
      beforeValue.className = 'diff-before';
      beforeValue.textContent = `- ${this.formatValue(change.before)}`;

      // 変更後の値（緑）
      const afterValue = document.createElement('div');
      afterValue.className = 'diff-after';
      afterValue.textContent = `+ ${this.formatValue(change.after)}`;

      item.appendChild(sideLabel);
      item.appendChild(propLabel);
      item.appendChild(beforeValue);
      item.appendChild(afterValue);
      container.appendChild(item);
    });

    // To/Value以外のプロパティ変更は通常通り表示
    const otherChanges = diffActivity.changes?.filter(
      c => c.propertyName !== 'To' && c.propertyName !== 'Value'
    ) || [];

    if (otherChanges.length > 0) {
      const otherDiv = this.renderPropertyChanges(otherChanges);
      container.appendChild(otherDiv);
    }

    return container;
  }

  /**
   * XMLエンティティをデコード
   */
  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')                   // アンパサンド
      .replace(/&lt;/g, '<')                     // 小なり
      .replace(/&gt;/g, '>')                     // 大なり
      .replace(/&quot;/g, '"')                   // ダブルクォート
      .replace(/&apos;/g, "'")                   // シングルクォート
      .replace(/&nbsp;/g, ' ');                  // ノーブレークスペース
  }

  /**
   * 値をフォーマット
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (typeof value === 'object') {
      return this.decodeXmlEntities(JSON.stringify(value));  // オブジェクトはJSON文字列化してデコード
    }

    return this.decodeXmlEntities(String(value));  // 文字列化してXMLエンティティをデコード
  }

  /**
   * 差分タイプに応じたバッジを取得
   */
  private getDiffBadge(diffType: DiffType): string {
    const badgeMap: Record<DiffType, string> = {
      [DiffType.ADDED]: '<span class="badge badge-added">🆕 追加</span>',
      [DiffType.REMOVED]: '<span class="badge badge-removed">🗑️ 削除</span>',
      [DiffType.MODIFIED]: '<span class="badge badge-modified">🟡 変更</span>'
    };

    return badgeMap[diffType];
  }

  /**
   * アクティビティタイプに応じたアイコンを取得
   */
  private getActivityIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'Sequence': '🔄',
      'Flowchart': '📊',
      'Assign': '📝',
      'If': '🔀',
      'While': '🔁',
      'ForEach': '🔁',
      'Click': '🖱️',
      'TypeInto': '⌨️',
      'GetText': '📄',
      'LogMessage': '📋',
      'InvokeWorkflowFile': '📤',
      'TryCatch': '⚠️',
      'Delay': '⏱️'
    };

    return iconMap[type] || '📦';               // デフォルトアイコン
  }
}
