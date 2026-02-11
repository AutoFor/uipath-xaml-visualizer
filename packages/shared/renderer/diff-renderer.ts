import { DiffResult, DiffActivity, DiffType, PropertyChange } from '../parser/diff-calculator';

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

    // 変更内容を表示（変更の場合のみ）
    if (diffActivity.diffType === DiffType.MODIFIED && diffActivity.changes) {
      const changesDiv = this.renderPropertyChanges(diffActivity.changes);
      card.appendChild(changesDiv);
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

    const header = document.createElement('div');
    header.className = 'changes-header';
    header.textContent = `プロパティ変更 (${changes.length})`;
    changesDiv.appendChild(header);

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
    header.textContent = 'Screenshot 変更:';

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
   * 値をフォーマット
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);             // オブジェクトはJSON文字列化
    }

    return String(value);
  }

  /**
   * 差分タイプに応じたバッジを取得
   */
  private getDiffBadge(diffType: DiffType): string {
    const badgeMap: Record<DiffType, string> = {
      [DiffType.ADDED]: '<span class="badge badge-added">+ 追加</span>',
      [DiffType.REMOVED]: '<span class="badge badge-removed">- 削除</span>',
      [DiffType.MODIFIED]: '<span class="badge badge-modified">~ 変更</span>'
    };

    return badgeMap[diffType];
  }

  /**
   * アクティビティタイプに応じたアイコンを取得
   */
  private getActivityIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'Sequence': '[Seq]',
      'Flowchart': '[Flow]',
      'Assign': '[=]',
      'If': '[?]',
      'While': '[Loop]',
      'ForEach': '[Loop]',
      'Click': '[Click]',
      'TypeInto': '[Type]',
      'GetText': '[Get]',
      'LogMessage': '[Log]',
      'InvokeWorkflowFile': '[Invoke]',
      'TryCatch': '[Try]',
      'Delay': '[Wait]'
    };

    return iconMap[type] || '[Act]';            // デフォルトアイコン
  }
}
