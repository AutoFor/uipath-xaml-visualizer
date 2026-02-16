import { DiffResult, DiffActivity, DiffType, PropertyChange, buildActivityKey } from '../parser/diff-calculator';
import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // 行番号マッピング型
import { translateActivityType, translatePropertyName, t } from '../i18n/i18n'; // i18n翻訳関数

/**
 * 差分レンダラー
 */
export type DiffScreenshotPathResolver = (filename: string) => string; // スクリーンショットパス解決関数の型

export class DiffRenderer {
  private activityIndex: number = 0; // アクティビティインデックス（キー生成用）
  private headLineIndex: ActivityLineIndex | null = null; // head側の行番号マッピング
  private baseLineIndex: ActivityLineIndex | null = null; // base側の行番号マッピング
  private screenshotPathResolver: DiffScreenshotPathResolver; // スクリーンショットパスリゾルバー

  constructor(screenshotPathResolver?: DiffScreenshotPathResolver) {
    this.screenshotPathResolver = screenshotPathResolver || ((f) => `.screenshots/${f}`); // デフォルトは相対パス
  }

  /**
   * 差分結果をHTMLとしてレンダリング
   */
  render(
    diff: DiffResult,
    container: HTMLElement,
    headLineIndex?: ActivityLineIndex,  // head側の行番号マッピング
    baseLineIndex?: ActivityLineIndex   // base側の行番号マッピング
  ): void {
    container.innerHTML = '';                   // コンテナをクリア
    this.activityIndex = 0; // インデックスをリセット
    this.headLineIndex = headLineIndex || null; // head側行マップを保存
    this.baseLineIndex = baseLineIndex || null; // base側行マップを保存

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

    // アクティビティキーを計算
    const activityKey = this.getActivityKeyForDiff(diffActivity);
    card.dataset.activityKey = activityKey; // data属性にキーを保存

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'activity-header';

    const icon = this.getActivityIcon(diffActivity.activity.type);
    const badge = this.getDiffBadge(diffActivity.diffType);

    const title = document.createElement('span');
    title.className = 'activity-title';

    title.innerHTML = `${translateActivityType(diffActivity.activity.type)}: ${diffActivity.activity.displayName} ${badge}`; // アクティビティタイプを翻訳

    header.appendChild(title);

    // 行番号バッジを挿入（追加→head、削除→base、変更→head）
    const lineIndex = diffActivity.diffType === DiffType.REMOVED ? this.baseLineIndex : this.headLineIndex;
    if (lineIndex) {
      const lineRange = lineIndex.keyToLines.get(activityKey); // アクティビティの行範囲を取得
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
          e.stopPropagation(); // カードのクリックイベントを阻止
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
    if (diffActivity.activity.annotations) {
      const annotationDiv = this.renderAnnotation(diffActivity.activity.annotations); // 注釈をレンダリング
      card.appendChild(annotationDiv);
    }

    // Assignアクティビティの代入式を表示（追加・削除の場合）
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'Assign') {
      const expr = this.renderAssignExpression(diffActivity.activity, diffActivity.diffType);
      if (expr) card.appendChild(expr);          // 代入式があれば表示
    }

    // MultipleAssignアクティビティの代入式を表示（追加・削除の場合）
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'MultipleAssign') {
      const expr = this.renderMultipleAssignExpression(diffActivity.activity, diffActivity.diffType);
      if (expr) card.appendChild(expr);          // 代入式があれば表示
    }

    // NApplicationCardアクティビティの重要プロパティを表示（追加・削除の場合）
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'NApplicationCard') {
      const props = this.renderNApplicationCardProperties(diffActivity.activity, diffActivity.diffType);
      if (props) card.appendChild(props); // URL・リポジトリ状態があれば表示
    }

    // 変更内容を表示（変更の場合のみ）
    if (diffActivity.diffType === DiffType.MODIFIED && diffActivity.changes) {
      if (diffActivity.activity.type === 'Assign') {
        const assignChanges = this.renderAssignChanges(diffActivity);  // Assign専用の変更表示
        card.appendChild(assignChanges);
      } else if (diffActivity.activity.type === 'MultipleAssign') {
        const multiChanges = this.renderMultipleAssignChanges(diffActivity); // MultipleAssign専用の変更表示
        card.appendChild(multiChanges);
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
   * アクティビティキーをDiffActivityから取得
   */
  private getActivityKeyForDiff(diffActivity: DiffActivity): string {
    const key = buildActivityKey(diffActivity.activity, this.activityIndex); // 組み込みキー生成
    this.activityIndex++;
    return key;
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

  // ========== 既存メソッド ==========

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
      propName.textContent = `${translatePropertyName(change.propertyName)}:`; // プロパティ名を翻訳

      // Before値（ワードレベルdiff付き）
      const beforeText = this.formatValue(change.before); // 変更前テキスト
      const afterText = this.formatValue(change.after);   // 変更後テキスト

      const beforeValue = document.createElement('div');
      beforeValue.className = 'diff-before';
      this.buildWordDiffHtml(beforeValue, '-', beforeText, afterText); // 差分部分をハイライト

      // After値（ワードレベルdiff付き）
      const afterValue = document.createElement('div');
      afterValue.className = 'diff-after';
      this.buildWordDiffHtml(afterValue, '+', afterText, beforeText); // 差分部分をハイライト

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
    header.textContent = t('Screenshot Changed:'); // スクリーンショット変更ラベルを翻訳

    const compareContainer = document.createElement('div');
    compareContainer.className = 'compare-container';

    // Before画像
    const beforeScreenshot = diffActivity.beforeActivity?.informativeScreenshot;
    if (beforeScreenshot) {
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'screenshot-before';
      beforeDiv.innerHTML = `
        <div class="label">${t('Before')}</div>
        <img src="${this.screenshotPathResolver(beforeScreenshot)}" alt="${t('Before')}" />
      `;
      compareContainer.appendChild(beforeDiv);
    }

    // After画像
    const afterScreenshot = diffActivity.activity.informativeScreenshot;
    if (afterScreenshot) {
      const afterDiv = document.createElement('div');
      afterDiv.className = 'screenshot-after';
      afterDiv.innerHTML = `
        <div class="label">${t('After')}</div>
        <img src="${this.screenshotPathResolver(afterScreenshot)}" alt="${t('After')}" />
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

    const beforeAct = diffActivity.beforeActivity;  // 変更前のアクティビティ
    const afterAct = diffActivity.activity;         // 変更後のアクティビティ

    // To/Valueのいずれかが変更されていれば統合形式で表示
    const hasAssignChange = diffActivity.changes?.some(
      c => c.propertyName === 'To' || c.propertyName === 'Value'
    );

    if (hasAssignChange && beforeAct) {
      const beforeTo = beforeAct.properties['To'];      // 変更前の左辺
      const beforeVal = beforeAct.properties['Value'];  // 変更前の右辺
      const afterTo = afterAct.properties['To'];        // 変更後の左辺
      const afterVal = afterAct.properties['Value'];    // 変更後の右辺

      // 変更前/後のテキストを生成
      const beforeText = `${this.formatValue(beforeTo)} = ${this.formatValue(beforeVal)}`; // 変更前テキスト
      const afterText = `${this.formatValue(afterTo)} = ${this.formatValue(afterVal)}`;   // 変更後テキスト

      // 変更前の行（ワードレベルdiff付き）
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'diff-before';
      this.buildWordDiffHtml(beforeDiv, '-', beforeText, afterText); // 差分部分をハイライト
      container.appendChild(beforeDiv);

      // 変更後の行（ワードレベルdiff付き）
      const afterDiv = document.createElement('div');
      afterDiv.className = 'diff-after';
      this.buildWordDiffHtml(afterDiv, '+', afterText, beforeText); // 差分部分をハイライト
      container.appendChild(afterDiv);
    }

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
   * MultipleAssignアクティビティの代入式をレンダリング（追加・削除用）
   */
  private renderMultipleAssignExpression(activity: Activity, diffType: DiffType): HTMLElement | null {
    const operations = activity.properties['AssignOperations'] as Array<{ To: string; Value: string }>;
    if (!operations || operations.length === 0) return null; // 代入操作がなければ表示しない

    const container = document.createElement('div'); // コンテナ
    container.className = 'property-changes';
    const isAdded = diffType === DiffType.ADDED; // 追加か削除かで表示を切替

    operations.forEach(op => {
      const div = document.createElement('div'); // 各代入式の行
      div.className = isAdded ? 'diff-after' : 'diff-before';
      const prefix = isAdded ? '+' : '-'; // プレフィックス
      div.textContent = `${prefix} ${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`; // [左辺] = [右辺]
      container.appendChild(div);
    });

    return container;
  }

  /**
   * NApplicationCardアクティビティの重要プロパティをレンダリング（追加・削除用）
   */
  private renderNApplicationCardProperties(activity: Activity, diffType: DiffType): HTMLElement | null {
    const targetApp = activity.properties['TargetApp']; // TargetAppオブジェクトを取得
    if (!targetApp || typeof targetApp !== 'object') return null; // オブジェクトでなければ表示しない

    const propsDiv = document.createElement('div'); // コンテナ
    propsDiv.className = 'property-changes';
    const isAdded = diffType === DiffType.ADDED; // 追加か削除かで表示を切替
    const className = isAdded ? 'diff-after' : 'diff-before';
    const prefix = isAdded ? '+' : '-';
    let hasProps = false;

    // URLを表示
    if (targetApp.Url) {
      const urlDiv = document.createElement('div'); // URL行
      urlDiv.className = className;
      urlDiv.textContent = `${prefix} ${translatePropertyName('Url')}: ${targetApp.Url}`; // URL値
      propsDiv.appendChild(urlDiv);
      hasProps = true;
    }

    // オブジェクトリポジトリ連携状態を表示
    const repoDiv = document.createElement('div'); // リポジトリ状態行
    repoDiv.className = className;
    repoDiv.textContent = `${prefix} ${translatePropertyName('ObjectRepository')}: ${targetApp.Reference ? t('Linked') : t('Not linked')}`; // 連携状態
    propsDiv.appendChild(repoDiv);
    hasProps = true;

    return hasProps ? propsDiv : null;
  }

  /**
   * MultipleAssignアクティビティの変更詳細をレンダリング
   */
  private renderMultipleAssignChanges(diffActivity: DiffActivity): HTMLElement {
    const container = document.createElement('div'); // コンテナ
    container.className = 'property-changes';

    const hasAssignOpsChange = diffActivity.changes?.some(
      c => c.propertyName === 'AssignOperations'
    ); // AssignOperationsの変更があるか

    if (hasAssignOpsChange && diffActivity.beforeActivity) {
      const beforeOps = (diffActivity.beforeActivity.properties['AssignOperations'] || []) as Array<{ To: string; Value: string }>;
      const afterOps = (diffActivity.activity.properties['AssignOperations'] || []) as Array<{ To: string; Value: string }>;

      // 変更前の各代入式を表示
      beforeOps.forEach(op => {
        const beforeText = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`; // 変更前テキスト
        const beforeDiv = document.createElement('div'); // 行要素
        beforeDiv.className = 'diff-before';
        beforeDiv.textContent = `- ${beforeText}`; // 削除プレフィックス
        container.appendChild(beforeDiv);
      });

      // 変更後の各代入式を表示
      afterOps.forEach(op => {
        const afterText = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`; // 変更後テキスト
        const afterDiv = document.createElement('div'); // 行要素
        afterDiv.className = 'diff-after';
        afterDiv.textContent = `+ ${afterText}`; // 追加プレフィックス
        container.appendChild(afterDiv);
      });
    }

    // AssignOperations以外のプロパティ変更は通常通り表示
    const otherChanges = diffActivity.changes?.filter(
      c => c.propertyName !== 'AssignOperations'
    ) || [];

    if (otherChanges.length > 0) {
      const otherDiv = this.renderPropertyChanges(otherChanges); // 汎用プロパティ変更表示
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
   * ワードレベルdiffでHTMLを構築（変更箇所だけ<span class="word-highlight">で囲む）
   */
  private buildWordDiffHtml(div: HTMLElement, prefix: string, text: string, otherText: string): void {
    const common = this.findCommonParts(text, otherText); // 共通部分と差分部分を計算
    div.textContent = ''; // textContentをクリア
    div.appendChild(document.createTextNode(prefix + ' ')); // プレフィックス（- / +）
    common.forEach(part => {
      if (part.same) {
        div.appendChild(document.createTextNode(part.value)); // 共通部分はそのまま
      } else {
        const span = document.createElement('span'); // 差分部分はspanで囲む
        span.className = 'word-highlight'; // ワードハイライトクラス
        span.textContent = part.value;
        div.appendChild(span);
      }
    });
  }

  /**
   * 2つの文字列の共通部分と差分部分を計算
   */
  private findCommonParts(a: string, b: string): { value: string; same: boolean }[] {
    const result: { value: string; same: boolean }[] = [];
    let ai = 0; // aのインデックス
    let bi = 0; // bのインデックス

    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        let start = ai; // 共通部分の開始位置
        while (ai < a.length && bi < b.length && a[ai] === b[bi]) {
          ai++;
          bi++;
        }
        result.push({ value: a.substring(start, ai), same: true }); // 共通部分
      } else {
        // 次の同期位置を探す（3パターン）
        let foundA = -1;    // aだけスキップ（aに余分な文字がある）
        let foundB = -1;    // bだけスキップ（bに余分な文字がある）
        let foundBoth = -1; // 両方同じ量スキップ（文字の置換）
        const searchLimit = Math.min(Math.max(a.length - ai, b.length - bi), 20); // 探索範囲
        for (let d = 1; d < searchLimit; d++) {
          if (foundBoth < 0 && ai + d < a.length && bi + d < b.length && a[ai + d] === b[bi + d]) {
            foundBoth = d; // 両方d文字進めると一致（置換）
          }
          if (foundA < 0 && ai + d < a.length && a[ai + d] === b[bi]) {
            foundA = d; // a側にd文字進めると一致（aに余分）
          }
          if (foundB < 0 && bi + d < b.length && a[ai] === b[bi + d]) {
            foundB = d; // b側にd文字進めると一致（bに余分）
          }
          if (foundBoth >= 0 || foundA >= 0 || foundB >= 0) break; // いずれか見つかったら終了
        }

        // 最小コストの戦略を選択
        if (foundBoth >= 0 && (foundA < 0 || foundBoth <= foundA) && (foundB < 0 || foundBoth <= foundB)) {
          result.push({ value: a.substring(ai, ai + foundBoth), same: false }); // 置換部分
          ai += foundBoth;
          bi += foundBoth;
        } else if (foundA >= 0 && (foundB < 0 || foundA <= foundB)) {
          result.push({ value: a.substring(ai, ai + foundA), same: false }); // aの余分な文字
          ai += foundA;
        } else if (foundB >= 0) {
          bi += foundB; // bの余分な文字をスキップ（aには出力なし）
        } else {
          result.push({ value: a.substring(ai), same: false }); // 残り全部が差分
          ai = a.length;
          bi = b.length;
        }
      }
    }
    if (ai < a.length) {
      result.push({ value: a.substring(ai), same: false }); // aの残り
    }
    return result;
  }

  /**
   * 差分タイプに応じたバッジを取得
   */
  private getDiffBadge(diffType: DiffType): string {
    const badgeMap: Record<DiffType, string> = {
      [DiffType.ADDED]: `<span class="badge badge-added">+ ${t('Added')}</span>`, // 追加バッジを翻訳
      [DiffType.REMOVED]: `<span class="badge badge-removed">- ${t('Removed')}</span>`, // 削除バッジを翻訳
      [DiffType.MODIFIED]: `<span class="badge badge-modified">~ ${t('Modified')}</span>` // 変更バッジを翻訳
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
