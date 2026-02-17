import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // 行番号マッピング型
import { buildActivityKey } from '../parser/diff-calculator'; // アクティビティキー生成
import { translateActivityType, translatePropertyName, t } from '../i18n/i18n'; // i18n翻訳関数
import { getSubProperties, getActivityPropertyConfig, hasSubPanel, isDefinedActivity } from './property-config'; // プロパティ分類設定

/**
 * Sequenceワークフローのレンダラー
 */
export type ScreenshotPathResolver = (filename: string) => string; // スクリーンショットパス解決関数の型

export class SequenceRenderer {
  private lineIndex: ActivityLineIndex | null = null; // 行番号マッピング
  private activityIndex: number = 0; // アクティビティインデックス（キー生成用）
  private screenshotPathResolver: ScreenshotPathResolver; // スクリーンショットパスリゾルバー

  constructor(screenshotPathResolver?: ScreenshotPathResolver) {
    this.screenshotPathResolver = screenshotPathResolver || ((f) => `.screenshots/${f}`); // デフォルトは相対パス
  }

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

    // 未定義アクティビティで、子が全て内部XML要素（定義済み子孫なし）の場合のみ子を非表示
    // 一つでも定義済み子孫がある子がいれば全子要素を表示（SendMailConnections等のカード自体は残す）
    const childrenToRender = (
      !isDefinedActivity(activity.type) && // 自身が未定義
      activity.children.length > 0 && // 子がある
      !activity.children.some(child => this.hasDefinedDescendant(child)) // 全子が未定義ツリー
    ) ? [] : activity.children; // 条件を満たす場合のみ子を非表示、それ以外は全子を表示

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'activity-header';

    // 折りたたみボタン（表示対象の子要素がある場合のみ表示）
    if (childrenToRender.length > 0) {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.textContent = '▼'; // 展開状態のアイコン
      collapseBtn.title = '折りたたみ/展開';
      header.appendChild(collapseBtn);
    }

    const title = document.createElement('span');
    title.className = 'activity-title';
    title.textContent = `${translateActivityType(activity.type)}: ${activity.displayName}`; // アクティビティタイプを翻訳

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

    // サブプロパティパネル挿入（メインプロパティの後、スクリーンショットの前）
    if (isDefinedActivity(activity.type) && hasSubPanel(activity.type) && Object.keys(activity.properties).length > 0) {
      const subProps = getSubProperties(activity.properties, activity.type); // サブプロパティを抽出
      if (Object.keys(subProps).length > 0) {
        const subPanel = this.renderSubPropertyPanel(subProps, activity.type); // サブパネルを生成
        card.appendChild(subPanel.toggle); // トグルボタンを追加
        card.appendChild(subPanel.panel); // パネル本体を追加
      }
    }

    // InformativeScreenshot表示
    if (activity.informativeScreenshot) {
      const screenshotDiv = this.renderScreenshot(activity.informativeScreenshot);
      card.appendChild(screenshotDiv);
    }

    // 子アクティビティを再帰的にレンダリング（フィルタ済み）
    if (childrenToRender.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'activity-children';

      childrenToRender.forEach(child => {
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
   * アクティビティのサブツリー内に定義済みアクティビティが存在するか判定
   * 未定義アクティビティの内部XML要素（BackupSlot等）をフィルタするために使用
   */
  private hasDefinedDescendant(activity: Activity): boolean {
    if (isDefinedActivity(activity.type)) return true; // 自身が定義済み
    return activity.children.some(child => this.hasDefinedDescendant(child)); // 子孫に定義済みがあるか再帰チェック
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
          otherKey.textContent = `${translatePropertyName(key)}:`; // プロパティ名を翻訳

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

    // NApplicationCardアクティビティの場合はTargetAppからアプリ名を表示
    if (activityType === 'NApplicationCard' && properties['TargetApp']) {
      const appName = this.formatTargetApp(properties['TargetApp']); // アプリ名を抽出
      if (appName) {
        const propItem = document.createElement('div'); // アプリ名表示用の行
        propItem.className = 'property-item';

        const propKey = document.createElement('span'); // ラベル
        propKey.className = 'property-key';
        propKey.textContent = `${translatePropertyName('TargetApp')}:`; // プロパティ名を翻訳

        const propValue = document.createElement('span'); // アプリ名値
        propValue.className = 'property-value';
        propValue.textContent = appName; // 抽出したアプリ名

        propItem.appendChild(propKey);
        propItem.appendChild(propValue);
        propsDiv.appendChild(propItem);
        return propsDiv;
      }
    }

    // NClick/NTypeInto/NGetTextアクティビティの場合はメインプロパティのみ表示
    if (activityType && activityType.startsWith('N') && activityType !== 'NApplicationCard') {
      const config = getActivityPropertyConfig(activityType); // アクティビティ別設定を取得
      let hasVisibleMainProps = false; // メインプロパティがあるかフラグ

      for (const mainKey of config.mainProperties) { // メインプロパティのみループ
        if (properties[mainKey] !== undefined) {
          const propItem = document.createElement('div'); // プロパティ行
          propItem.className = 'property-item';

          const propKey = document.createElement('span'); // ラベル
          propKey.className = 'property-key';
          propKey.textContent = `${translatePropertyName(mainKey)}:`; // プロパティ名を翻訳

          const propValue = document.createElement('span'); // 値
          propValue.className = 'property-value';
          propValue.textContent = this.formatValue(properties[mainKey]); // フォーマット済み値

          propItem.appendChild(propKey);
          propItem.appendChild(propValue);
          propsDiv.appendChild(propItem);
          hasVisibleMainProps = true;
        }
      }

      return hasVisibleMainProps ? propsDiv : null;
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
        levelKey.textContent = `${translatePropertyName('Level')}:`; // プロパティ名を翻訳

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
        msgKey.textContent = `${translatePropertyName('Message')}:`; // プロパティ名を翻訳

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

    // 未定義アクティビティはプロパティを非表示
    return null;
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

    screenshotDiv.appendChild(img);

    return screenshotDiv;
  }

  /**
   * スクリーンショットのパスを解決
   */
  private resolveScreenshotPath(filename: string): string {
    return this.screenshotPathResolver(filename); // リゾルバーで解決
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
        <h4>${translateActivityType(activity.type)}</h4>
        <p><strong>${translatePropertyName('DisplayName')}:</strong> ${activity.displayName}</p>
      </div>
      <div class="detail-section">
        <h4>${t('Properties')}</h4>
        ${this.renderAllProperties(activity.properties)}
      </div>
      ${activity.annotations ? `
        <div class="detail-section">
          <h4>${t('Annotations')}</h4>
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
          <span class="prop-key">${translatePropertyName(key)}:</span>
          <span class="prop-value">${this.formatValue(value)}</span>
        </div>
      `)
      .join('');
  }

  /**
   * サブプロパティパネルをレンダリング（トグルボタン + パネル本体）
   */
  private renderSubPropertyPanel(
    subProps: Record<string, any>, // サブプロパティ
    activityType: string // アクティビティタイプ
  ): { toggle: HTMLElement; panel: HTMLElement } { // トグルボタンとパネルを返す
    // トグルボタン
    const toggle = document.createElement('button'); // トグルボタン要素
    toggle.className = 'property-sub-panel-toggle'; // CSSクラス
    toggle.textContent = `${t('Toggle property panel')} ▶`; // ボタンラベル（折りたたみ状態）

    // パネル本体（初期非表示）
    const panel = document.createElement('div'); // パネル要素
    panel.className = 'property-sub-panel'; // CSSクラス
    panel.style.display = 'none'; // 初期非表示

    // アクティビティ設定のグループを取得
    const config = getActivityPropertyConfig(activityType); // 設定を取得

    if (config.subGroups.length > 0) {
      // グループ別に表示
      const groupedKeys = new Set<string>(); // グループに属するキーの集合
      for (const group of config.subGroups) { // 各グループをループ
        const groupProps: Record<string, any> = {}; // グループ内のプロパティ
        for (const propName of group.properties) { // グループ内の各プロパティ名
          if (subProps[propName] !== undefined) { // サブプロパティに存在するか
            groupProps[propName] = subProps[propName]; // グループに追加
            groupedKeys.add(propName); // 使用済みとしてマーク
          }
        }
        if (Object.keys(groupProps).length > 0) { // グループに表示対象があれば
          const groupDiv = this.renderPropertyGroup(group.label(), groupProps); // グループをレンダリング
          panel.appendChild(groupDiv); // パネルに追加
        }
      }

      // グループに属さないプロパティを「共通」グループで表示
      const ungrouped: Record<string, any> = {}; // 未グループのプロパティ
      for (const [key, value] of Object.entries(subProps)) { // サブプロパティ全体をループ
        if (!groupedKeys.has(key)) { // グループに属していない場合
          ungrouped[key] = value; // 未グループに追加
        }
      }
      if (Object.keys(ungrouped).length > 0) { // 未グループのプロパティがあれば
        const commonDiv = this.renderPropertyGroup(t('Common'), ungrouped); // 共通グループとしてレンダリング
        panel.appendChild(commonDiv); // パネルに追加
      }
    } else {
      // グループなし: フラットにプロパティを表示
      for (const [key, value] of Object.entries(subProps)) { // サブプロパティ全体をループ
        const propItem = document.createElement('div'); // プロパティ行
        propItem.className = 'property-item'; // CSSクラス

        const propKey = document.createElement('span'); // プロパティ名
        propKey.className = 'property-key'; // CSSクラス
        propKey.textContent = `${translatePropertyName(key)}:`; // 翻訳済みプロパティ名

        const propValue = document.createElement('span'); // プロパティ値
        propValue.className = 'property-value'; // CSSクラス
        propValue.textContent = this.formatValue(value); // フォーマット済み値

        propItem.appendChild(propKey); // 名前を追加
        propItem.appendChild(propValue); // 値を追加
        panel.appendChild(propItem); // パネルに追加
      }
    }

    // トグルボタンのクリックイベント
    toggle.addEventListener('click', (e) => {
      e.stopPropagation(); // カードのクリックイベントを阻止
      const isExpanded = panel.style.display !== 'none'; // 現在の表示状態を取得
      panel.style.display = isExpanded ? 'none' : 'block'; // 表示/非表示を切り替え
      toggle.textContent = isExpanded
        ? `${t('Toggle property panel')} ▶` // 折りたたみ状態
        : `${t('Toggle property panel')} ▼`; // 展開状態
    });

    return { toggle, panel }; // トグルとパネルを返す
  }

  /**
   * プロパティグループをレンダリング（UiPath Studio風のカテゴリ表示）
   */
  private renderPropertyGroup(label: string, properties: Record<string, any>): HTMLElement { // グループ名とプロパティを受け取る
    const groupDiv = document.createElement('div'); // グループコンテナ
    groupDiv.className = 'property-group'; // CSSクラス

    const headerDiv = document.createElement('div'); // グループヘッダー
    headerDiv.className = 'property-group-header'; // CSSクラス
    headerDiv.textContent = label; // グループ名
    groupDiv.appendChild(headerDiv); // ヘッダーを追加

    const bodyDiv = document.createElement('div'); // グループ本体
    bodyDiv.className = 'property-group-body'; // CSSクラス

    for (const [key, value] of Object.entries(properties)) { // プロパティをループ
      const propItem = document.createElement('div'); // プロパティ行
      propItem.className = 'property-item'; // CSSクラス

      const propKey = document.createElement('span'); // プロパティ名
      propKey.className = 'property-key'; // CSSクラス
      propKey.textContent = `${translatePropertyName(key)}:`; // 翻訳済みプロパティ名

      const propValue = document.createElement('span'); // プロパティ値
      propValue.className = 'property-value'; // CSSクラス
      propValue.textContent = this.formatValue(value); // フォーマット済み値

      propItem.appendChild(propKey); // 名前を追加
      propItem.appendChild(propValue); // 値を追加
      bodyDiv.appendChild(propItem); // グループ本体に追加
    }

    groupDiv.appendChild(bodyDiv); // 本体をグループに追加
    return groupDiv; // グループ要素を返す
  }

  /**
   * TargetAppオブジェクトからアプリ名を抽出
   * FilePathまたはSelectorのtitle属性からアプリ名を取得
   */
  private formatTargetApp(targetApp: any): string { // TargetAppプロパティからアプリ名を抽出
    if (typeof targetApp === 'string') return targetApp; // 文字列ならそのまま返す
    if (typeof targetApp !== 'object' || targetApp === null) return ''; // オブジェクト以外は空文字

    // FilePathからアプリ名を取得
    if (targetApp.FilePath) return String(targetApp.FilePath); // ファイルパスがあればそれを返す

    // Selectorのtitle属性からアプリ名を取得
    if (targetApp.Selector) {
      const selector = String(targetApp.Selector); // セレクターを文字列化
      const titleMatch = selector.match(/title='([^']+)'/); // title属性を抽出
      if (titleMatch) return titleMatch[1]; // 一致すればtitle値を返す
    }

    // AppDescriptorからアプリ名を取得
    if (targetApp.AppDescriptor) return String(targetApp.AppDescriptor); // AppDescriptorがあればそれを返す

    return this.formatValue(targetApp); // フォールバック: JSON文字列化
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
