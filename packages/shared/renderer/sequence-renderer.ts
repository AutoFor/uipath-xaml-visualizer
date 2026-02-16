import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // 行番号マッピング型
import { buildActivityKey } from '../parser/diff-calculator'; // アクティビティキー生成

/**
 * Sequenceワークフローのレンダラー
 */
export class SequenceRenderer {
  private lineIndex: ActivityLineIndex | null = null; // 行番号マッピング
  private activityIndex: number = 0; // アクティビティインデックス（キー生成用）

  /**
   * アクティビティツリーをHTMLとしてレンダリング
   */
  render(parsedData: any, container: HTMLElement, lineIndex?: ActivityLineIndex): void {
    container.innerHTML = '';                   // コンテナをクリア
    this.lineIndex = lineIndex || null;        // 行番号マッピングを保存
    this.activityIndex = 0;                    // インデックスをリセット

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

    // 折りたたみボタン（子要素がある場合のみ表示）
    if (activity.children.length > 0) {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.textContent = '▼'; // 展開状態のアイコン
      collapseBtn.title = '折りたたみ/展開';
      header.appendChild(collapseBtn);
    }

    const title = document.createElement('span');
    title.className = 'activity-title';
    title.textContent = `${activity.type}: ${activity.displayName}`;

    header.appendChild(title);

    // アクティビティキーを算出してdata属性に設定（カーソル同期用）
    const activityKey = buildActivityKey(activity, this.activityIndex); // キーを生成
    this.activityIndex++; // インデックスをインクリメント
    card.dataset.activityKey = activityKey; // data属性にキーを保存

    // 行番号バッジを挿入
    if (this.lineIndex) {
      const lineRange = this.lineIndex.keyToLines.get(activityKey); // 行範囲を取得
      if (lineRange) {
        const lineBadge = document.createElement('span'); // バッジ要素
        lineBadge.className = 'line-range-badge'; // スタイル用クラス
        lineBadge.dataset.startLine = String(lineRange.startLine); // 開始行をdata属性に保存
        lineBadge.dataset.endLine = String(lineRange.endLine); // 終了行をdata属性に保存
        lineBadge.textContent = lineRange.startLine === lineRange.endLine
          ? `L${lineRange.startLine}`                // 1行の場合
          : `L${lineRange.startLine}-L${lineRange.endLine}`; // 複数行の場合
        lineBadge.title = `XAML ${lineRange.startLine}行目〜${lineRange.endLine}行目`; // ツールチップ
        lineBadge.style.cursor = 'pointer'; // クリック可能カーソル
        lineBadge.addEventListener('click', (e) => {
          e.stopPropagation(); // カードのクリックイベント（detailPanel表示）を阻止
          lineBadge.dispatchEvent(new CustomEvent('visualizer-line-click', { // カーソル同期イベントを発火
            bubbles: true, // バブリングでパネルまで伝播
            detail: { activityKey, startLine: lineRange.startLine, endLine: lineRange.endLine }
          }));
        });
        header.appendChild(lineBadge);
      }
    }

    card.appendChild(header);

    // 注釈表示（DisplayNameの直後に表示）
    if (activity.annotations) {
      const annotationDiv = this.renderAnnotation(activity.annotations); // 注釈をレンダリング
      card.appendChild(annotationDiv);
    }

    // プロパティ表示
    if (Object.keys(activity.properties).length > 0) {
      const propsDiv = this.renderProperties(activity.properties, activity.type); // アクティビティタイプを渡す
      if (propsDiv) { // nullチェックを追加
        card.appendChild(propsDiv);
      }
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

      // 折りたたみボタンのクリックイベント
      const collapseBtn = header.querySelector('.collapse-btn');
      if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // カードのクリックイベントを阻止
          const isCollapsed = card.classList.toggle('collapsed'); // collapsed クラスをトグル
          collapseBtn.textContent = isCollapsed ? '▶' : '▼'; // アイコンを変更
        });
      }
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
  private renderProperties(properties: Record<string, any>, activityType?: string): HTMLElement | null {
    const propsDiv = document.createElement('div');
    propsDiv.className = 'activity-properties';

    // Assignアクティビティの場合はTo/Valueを統合形式で表示
    if (activityType === 'Assign' && (properties['To'] || properties['Value'])) {
      const propItem = document.createElement('div'); // 統合表示用の行
      propItem.className = 'property-item';

      const propValue = document.createElement('span'); // 代入式テキスト
      propValue.className = 'assign-expression'; // 白文字・モノスペースフォント
      propValue.textContent = `${this.formatValue(properties['To'])} = ${this.formatValue(properties['Value'])}`; // [左辺] = [右辺]

      propItem.appendChild(propValue);
      propsDiv.appendChild(propItem);

      // To/Value以外の主要プロパティも表示
      const otherImportantProps = ['Condition', 'Selector', 'Message']; // To/Valueを除く主要プロパティ
      Object.entries(properties).forEach(([key, value]) => {
        if (otherImportantProps.includes(key)) {
          const otherItem = document.createElement('div');
          otherItem.className = 'property-item';

          const otherKey = document.createElement('span');
          otherKey.className = 'property-key';
          otherKey.textContent = `${key}:`;

          const otherValue = document.createElement('span');
          otherValue.className = 'property-value';
          otherValue.textContent = this.formatValue(value);

          otherItem.appendChild(otherKey);
          otherItem.appendChild(otherValue);
          propsDiv.appendChild(otherItem);
        }
      });

      return propsDiv;
    }

    // MultipleAssignアクティビティの場合はAssignOperationsの各式を表示
    if (activityType === 'MultipleAssign' && properties['AssignOperations']) {
      const operations = properties['AssignOperations'] as Array<{ To: string; Value: string }>; // 代入操作リスト
      operations.forEach(op => {
        const propItem = document.createElement('div'); // 各代入式の行
        propItem.className = 'property-item';

        const propValue = document.createElement('span'); // 代入式テキスト
        propValue.className = 'assign-expression'; // Assignと同じスタイル
        propValue.textContent = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`; // [左辺] = [右辺]

        propItem.appendChild(propValue);
        propsDiv.appendChild(propItem);
      });

      return propsDiv;
    }

    // LogMessageアクティビティの場合はLevel/Messageを表示
    if (activityType === 'LogMessage') {
      let hasVisibleProps = false; // 表示可能なプロパティがあるかフラグ

      // Levelプロパティを表示
      if (properties['Level']) {
        const levelItem = document.createElement('div'); // レベル表示用の行
        levelItem.className = 'property-item';

        const levelKey = document.createElement('span'); // ラベル
        levelKey.className = 'property-key';
        levelKey.textContent = 'Level:';

        const levelValue = document.createElement('span'); // レベル値
        levelValue.className = 'property-value';
        levelValue.textContent = this.formatValue(properties['Level']);

        levelItem.appendChild(levelKey);
        levelItem.appendChild(levelValue);
        propsDiv.appendChild(levelItem);
        hasVisibleProps = true;
      }

      // Messageプロパティを表示
      if (properties['Message']) {
        const msgItem = document.createElement('div'); // メッセージ表示用の行
        msgItem.className = 'property-item';

        const msgKey = document.createElement('span'); // ラベル
        msgKey.className = 'property-key';
        msgKey.textContent = 'Message:';

        const msgValue = document.createElement('span'); // メッセージ値
        msgValue.className = 'property-value';
        msgValue.textContent = this.formatValue(properties['Message']);

        msgItem.appendChild(msgKey);
        msgItem.appendChild(msgValue);
        propsDiv.appendChild(msgItem);
        hasVisibleProps = true;
      }

      return hasVisibleProps ? propsDiv : null;
    }

    // 主要なプロパティのみ表示（簡略表示）
    const importantProps = ['To', 'Value', 'Condition', 'Selector', 'Message'];
    let hasVisibleProps = false; // 表示可能なプロパティがあるかフラグ

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
        hasVisibleProps = true; // プロパティが追加された
      }
    });

    // 表示可能なプロパティがない場合はnullを返す
    return hasVisibleProps ? propsDiv : null;
  }

  /**
   * 注釈をレンダリング（メモ風表示）
   */
  private renderAnnotation(text: string): HTMLElement {
    const div = document.createElement('div'); // 注釈コンテナ
    div.className = 'activity-annotation'; // メモ風スタイル用クラス
    div.textContent = text; // 注釈テキストを設定
    return div;
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
          <h3>${filename}</h3>
          <button class="modal-close">X</button>
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
}
