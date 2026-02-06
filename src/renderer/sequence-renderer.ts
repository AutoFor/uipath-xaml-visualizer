import { Activity } from '../parser/xaml-parser';

/**
 * Sequenceワークフローのレンダラー
 */
export class SequenceRenderer {
  /**
   * アクティビティツリーをHTMLとしてレンダリング
   */
  render(parsedData: any, container: HTMLElement): void {
    container.innerHTML = '';                   // コンテナをクリア

    // ルートアクティビティからレンダリング開始
    const rootElement = this.renderActivity(parsedData.rootActivity);
    container.appendChild(rootElement);
  }

  /**
   * アクティビティをHTMLにレンダリング
   */
  private renderActivity(activity: Activity): HTMLElement {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.dataset.id = activity.id;              // データ属性にIDを設定
    card.dataset.type = activity.type;          // データ属性にタイプを設定

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'activity-header';

    const title = document.createElement('span');
    title.className = 'activity-title';
    title.textContent = `${activity.type}: ${activity.displayName}`;

    header.appendChild(title);
    card.appendChild(header);

    // プロパティ表示
    if (Object.keys(activity.properties).length > 0) {
      const propsDiv = this.renderProperties(activity.properties);
      card.appendChild(propsDiv);
    }

    // InformativeScreenshot表示
    if (activity.informativeScreenshot) {
      const screenshotDiv = this.renderScreenshot(activity.informativeScreenshot);
      card.appendChild(screenshotDiv);
    }

    // 子アクティビティを再帰的にレンダリング
    if (activity.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'activity-children';

      activity.children.forEach(child => {
        const childElement = this.renderActivity(child);
        childrenContainer.appendChild(childElement);
      });

      card.appendChild(childrenContainer);
    }

    // クリックイベント: 詳細パネルを開く
    card.addEventListener('click', (e) => {
      e.stopPropagation();                      // イベント伝播を停止
      this.showDetailPanel(activity);
    });

    return card;
  }

  /**
   * プロパティをレンダリング
   */
  private renderProperties(properties: Record<string, any>): HTMLElement {
    const propsDiv = document.createElement('div');
    propsDiv.className = 'activity-properties';

    // 主要なプロパティのみ表示（簡略表示）
    const importantProps = ['To', 'Value', 'Condition', 'Selector', 'Message'];

    Object.entries(properties).forEach(([key, value]) => {
      if (importantProps.includes(key)) {
        const propItem = document.createElement('div');
        propItem.className = 'property-item';

        const propKey = document.createElement('span');
        propKey.className = 'property-key';
        propKey.textContent = `${key}:`;

        const propValue = document.createElement('span');
        propValue.className = 'property-value';
        propValue.textContent = this.formatValue(value);

        propItem.appendChild(propKey);
        propItem.appendChild(propValue);
        propsDiv.appendChild(propItem);
      }
    });

    return propsDiv;
  }

  /**
   * スクリーンショットをレンダリング
   */
  private renderScreenshot(filename: string): HTMLElement {
    const screenshotDiv = document.createElement('div');
    screenshotDiv.className = 'informative-screenshot';

    const label = document.createElement('div');
    label.className = 'screenshot-label';
    label.textContent = 'Informative Screenshot:';

    const img = document.createElement('img');
    img.className = 'screenshot-thumbnail';
    img.src = this.resolveScreenshotPath(filename); // スクリーンショットパスを解決
    img.alt = filename;
    img.loading = 'lazy';                       // 遅延読み込み

    // 画像読み込みエラー時の処理
    img.onerror = () => {
      screenshotDiv.innerHTML = `
        <div class="screenshot-error">
          [!] Image not found<br>
          ${filename}
        </div>
      `;
    };

    // 拡大ボタン
    const expandBtn = document.createElement('button');
    expandBtn.className = 'screenshot-expand-btn';
    expandBtn.textContent = 'Zoom';
    expandBtn.onclick = (e) => {
      e.stopPropagation();                      // カードのクリックイベントを阻止
      this.showScreenshotModal(filename, img.src);
    };

    screenshotDiv.appendChild(label);
    screenshotDiv.appendChild(img);
    screenshotDiv.appendChild(expandBtn);

    return screenshotDiv;
  }

  /**
   * スクリーンショットのパスを解決
   */
  private resolveScreenshotPath(filename: string): string {
    // TODO: Azure DevOps APIを使用して実際のパスを取得
    // 現時点ではプレースホルダーを返す
    return `.screenshots/${filename}`;
  }

  /**
   * スクリーンショット拡大モーダルを表示
   */
  private showScreenshotModal(filename: string, src: string): void {
    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'screenshot-modal';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📷 ${filename}</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <img src="${src}" alt="${filename}" />
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 閉じるボタンのイベント
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // モーダル背景クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * 詳細パネルを表示
   */
  private showDetailPanel(activity: Activity): void {
    const detailPanel = document.getElementById('detail-panel');
    const detailContent = document.getElementById('detail-content');

    if (!detailPanel || !detailContent) return;

    // 詳細情報をレンダリング
    detailContent.innerHTML = `
      <div class="detail-section">
        <h4>${activity.type}</h4>
        <p><strong>DisplayName:</strong> ${activity.displayName}</p>
      </div>
      <div class="detail-section">
        <h4>Properties</h4>
        ${this.renderAllProperties(activity.properties)}
      </div>
      ${activity.annotations ? `
        <div class="detail-section">
          <h4>Annotations</h4>
          <p>${activity.annotations}</p>
        </div>
      ` : ''}
    `;

    detailPanel.style.display = 'block';        // パネルを表示
  }

  /**
   * すべてのプロパティを詳細表示
   */
  private renderAllProperties(properties: Record<string, any>): string {
    return Object.entries(properties)
      .map(([key, value]) => `
        <div class="property-row">
          <span class="prop-key">${key}:</span>
          <span class="prop-value">${this.formatValue(value)}</span>
        </div>
      `)
      .join('');
  }

  /**
   * 値をフォーマット
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);    // オブジェクトはJSON文字列化
    }

    return String(value);
  }

  /**
   * アクティビティタイプに応じたアイコンを取得
   */
  private getActivityIcon(type: string): string {
    // アイコンなし - 空文字を返す
    return '';
  }
}
