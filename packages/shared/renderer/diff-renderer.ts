import { DiffResult, DiffActivity, DiffType, PropertyChange, buildActivityKey } from '../parser/diff-calculator';
import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // 行番号マッピング型

/**
 * レビューコメント型（github-extensionのReviewCommentと同一構造）
 */
export interface ReviewCommentData {
  id: number;                // コメントID
  body: string;              // コメント本文
  user: {                    // 投稿ユーザー
    login: string;           // ユーザー名
    avatar_url: string;      // アバターURL
  };
  created_at: string;        // 作成日時
  html_url: string;          // コメントのWeb URL
}

/**
 * コメントレンダリングオプション
 */
export interface CommentRenderOptions {
  commentsMap: Map<string, ReviewCommentData[]>;  // アクティビティキー→コメントリスト
  onPostComment: (activityKey: string, body: string) => Promise<void>; // コメント投稿コールバック
  getActivityKey: (activity: Activity, index: number) => string; // アクティビティキー取得関数
}

/**
 * 差分レンダラー
 */
export class DiffRenderer {
  private commentOptions: CommentRenderOptions | null = null; // コメントオプション
  private activityIndex: number = 0; // アクティビティインデックス（キー生成用）
  private headLineIndex: ActivityLineIndex | null = null; // head側の行番号マッピング
  private baseLineIndex: ActivityLineIndex | null = null; // base側の行番号マッピング

  /**
   * 差分結果をHTMLとしてレンダリング
   */
  render(
    diff: DiffResult,
    container: HTMLElement,
    commentOptions?: CommentRenderOptions,
    headLineIndex?: ActivityLineIndex,  // head側の行番号マッピング
    baseLineIndex?: ActivityLineIndex   // base側の行番号マッピング
  ): void {
    container.innerHTML = '';                   // コンテナをクリア
    this.commentOptions = commentOptions || null; // コメントオプションを保存
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

    title.innerHTML = `${diffActivity.activity.type}: ${diffActivity.activity.displayName} ${badge}`;

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

    // コメントインジケーター・追加ボタンを挿入
    if (this.commentOptions) {
      const comments = this.commentOptions.commentsMap.get(activityKey); // このアクティビティのコメント
      const commentIndicator = this.renderCommentIndicator(comments?.length || 0, card); // インジケーター
      header.appendChild(commentIndicator);

      const addCommentBtn = this.renderAddCommentButton(activityKey, card); // コメント追加ボタン
      header.appendChild(addCommentBtn);
    }

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

    // コメントパネル（コメントがある場合のみ初期生成）
    if (this.commentOptions) {
      const comments = this.commentOptions.commentsMap.get(activityKey);
      if (comments && comments.length > 0) {
        const panel = this.renderCommentPanel(activityKey, comments);
        panel.style.display = 'none'; // 初期状態は非表示
        card.appendChild(panel);
      }
    }

    return card;
  }

  // ========== コメント UI メソッド ==========

  /**
   * コメントインジケーターバッジをレンダリング
   */
  private renderCommentIndicator(count: number, card: HTMLElement): HTMLElement {
    const indicator = document.createElement('span'); // インジケーター要素
    indicator.className = 'comment-indicator';

    if (count > 0) {
      indicator.textContent = `[Cmt: ${count}]`; // コメント数を表示
      indicator.style.cursor = 'pointer'; // クリック可能
      indicator.addEventListener('click', (e) => {
        e.stopPropagation(); // イベント伝播停止
        this.toggleCommentPanel(card); // コメントパネルの展開/折りたたみ
      });
    }

    return indicator;
  }

  /**
   * コメント追加ボタンをレンダリング（ホバー時のみ表示）
   */
  private renderAddCommentButton(activityKey: string, card: HTMLElement): HTMLElement {
    const btn = document.createElement('span'); // ボタン要素
    btn.className = 'add-comment-btn';
    btn.textContent = '[+]'; // ボタンテキスト
    btn.title = 'Add comment'; // ツールチップ
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // イベント伝播停止
      this.showCommentForm(activityKey, card); // コメント入力フォームを表示
    });

    return btn;
  }

  /**
   * コメントパネルをレンダリング
   */
  private renderCommentPanel(_activityKey: string, comments: ReviewCommentData[]): HTMLElement {
    const panel = document.createElement('div'); // パネル要素
    panel.className = 'activity-comments';

    // 各コメントを表示
    const commentList = document.createElement('div'); // コメントリストコンテナ
    commentList.className = 'comment-list';
    comments.forEach(comment => {
      const item = this.renderCommentItem(comment); // 個別コメント
      commentList.appendChild(item);
    });
    panel.appendChild(commentList);

    return panel;
  }

  /**
   * 個別コメントをレンダリング
   */
  private renderCommentItem(comment: ReviewCommentData): HTMLElement {
    const item = document.createElement('div'); // コメント要素
    item.className = 'comment-item';

    // ヘッダー（アバター + ユーザー名 + タイムスタンプ）
    const header = document.createElement('div'); // ヘッダー要素
    header.className = 'comment-header';

    if (comment.user.avatar_url) {
      const avatar = document.createElement('img'); // アバター画像
      avatar.className = 'comment-avatar';
      avatar.src = comment.user.avatar_url;
      avatar.alt = comment.user.login;
      avatar.width = 20;
      avatar.height = 20;
      header.appendChild(avatar);
    }

    const username = document.createElement('span'); // ユーザー名
    username.className = 'comment-username';
    username.textContent = comment.user.login || 'unknown';
    header.appendChild(username);

    const timestamp = document.createElement('span'); // タイムスタンプ
    timestamp.className = 'comment-timestamp';
    timestamp.textContent = this.formatTimestamp(comment.created_at); // 日時フォーマット
    header.appendChild(timestamp);

    item.appendChild(header);

    // 本文
    const body = document.createElement('div'); // 本文要素
    body.className = 'comment-body';
    body.textContent = comment.body; // コメント本文
    item.appendChild(body);

    return item;
  }

  /**
   * コメントパネルの展開/折りたたみ
   */
  private toggleCommentPanel(card: HTMLElement): void {
    const panel = card.querySelector('.activity-comments') as HTMLElement; // コメントパネル
    if (!panel) return;

    if (panel.style.display === 'none') {
      panel.style.display = 'block'; // 展開
    } else {
      panel.style.display = 'none'; // 折りたたみ
    }
  }

  /**
   * コメント入力フォームを表示
   */
  private showCommentForm(activityKey: string, card: HTMLElement): void {
    // 既存のフォームがあれば削除
    const existingForm = card.querySelector('.comment-form');
    if (existingForm) {
      existingForm.remove();
      return; // トグル動作: フォームが既にあれば閉じる
    }

    const form = document.createElement('div'); // フォーム要素
    form.className = 'comment-form';

    const textarea = document.createElement('textarea'); // テキストエリア
    textarea.className = 'comment-input';
    textarea.placeholder = 'コメントを入力...';
    textarea.rows = 3;
    form.appendChild(textarea);

    const actions = document.createElement('div'); // ボタン群
    actions.className = 'comment-form-actions';

    const cancelBtn = document.createElement('button'); // キャンセルボタン
    cancelBtn.className = 'btn btn-sm comment-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => form.remove()); // クリックでフォーム削除

    const submitBtn = document.createElement('button'); // 投稿ボタン
    submitBtn.className = 'btn btn-sm comment-submit-btn';
    submitBtn.textContent = 'Comment';
    submitBtn.addEventListener('click', async () => {
      const body = textarea.value.trim(); // コメント本文
      if (!body) return; // 空コメントは無視

      if (!this.commentOptions?.onPostComment) return; // コールバックなし

      submitBtn.disabled = true; // ボタン無効化
      submitBtn.textContent = 'Posting...'; // 投稿中表示

      try {
        await this.commentOptions.onPostComment(activityKey, body); // コメント投稿

        // 楽観的更新: コメントをリストに追加
        this.addCommentToCard(card, activityKey, body);
        form.remove(); // フォームを削除
      } catch (e) {
        console.error('コメント投稿エラー:', e);
        submitBtn.disabled = false; // ボタン再有効化
        submitBtn.textContent = 'Comment'; // テキスト復元
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    card.appendChild(form); // カードにフォームを追加
    textarea.focus(); // テキストエリアにフォーカス
  }

  /**
   * 投稿成功後にカードにコメントを追加（楽観的更新）
   */
  private addCommentToCard(card: HTMLElement, activityKey: string, body: string): void {
    // コメントパネルを取得または作成
    let panel = card.querySelector('.activity-comments') as HTMLElement;
    if (!panel) {
      panel = document.createElement('div'); // 新規パネル
      panel.className = 'activity-comments';
      const commentList = document.createElement('div'); // コメントリスト
      commentList.className = 'comment-list';
      panel.appendChild(commentList);
      card.appendChild(panel);
    }

    panel.style.display = 'block'; // パネルを表示

    // 新しいコメントを追加
    const commentList = panel.querySelector('.comment-list') || panel; // コメントリスト
    const newComment: ReviewCommentData = {
      id: Date.now(), // 仮ID
      body,
      user: { login: 'You', avatar_url: '' }, // 投稿者（ダミー）
      created_at: new Date().toISOString(),
      html_url: ''
    };
    const item = this.renderCommentItem(newComment); // コメントアイテム
    commentList.appendChild(item);

    // インジケーターを更新
    const indicator = card.querySelector('.comment-indicator') as HTMLElement;
    if (indicator) {
      const currentCount = this.commentOptions?.commentsMap.get(activityKey)?.length || 0;
      const displayCount = currentCount + 1; // 新しいコメント分を加算
      indicator.textContent = `[Cmt: ${displayCount}]`;
      indicator.style.cursor = 'pointer';

      // クリックイベントがなければ追加
      if (!indicator.dataset.hasListener) {
        indicator.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCommentPanel(card);
        });
        indicator.dataset.hasListener = 'true';
      }
    }
  }

  /**
   * アクティビティキーをDiffActivityから取得
   */
  private getActivityKeyForDiff(diffActivity: DiffActivity): string {
    if (this.commentOptions?.getActivityKey) {
      const key = this.commentOptions.getActivityKey(diffActivity.activity, this.activityIndex); // カスタムキー生成
      this.activityIndex++;
      return key;
    }
    // フォールバック: 組み込みキー生成
    const key = buildActivityKey(diffActivity.activity, this.activityIndex);
    this.activityIndex++;
    return key;
  }

  /**
   * タイムスタンプをフォーマット
   */
  private formatTimestamp(isoString: string): string {
    try {
      const date = new Date(isoString); // ISO文字列をDateに変換
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }); // 日本時間でフォーマット
    } catch {
      return isoString; // パース失敗時は元の文字列を返す
    }
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
    header.textContent = 'Screenshot Changed:';

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

      // 変更前の行（赤）
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'diff-before';
      beforeDiv.textContent = `- ${this.formatValue(beforeTo)} = ${this.formatValue(beforeVal)}`;
      container.appendChild(beforeDiv);

      // 変更後の行（緑）
      const afterDiv = document.createElement('div');
      afterDiv.className = 'diff-after';
      afterDiv.textContent = `+ ${this.formatValue(afterTo)} = ${this.formatValue(afterVal)}`;
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
      [DiffType.ADDED]: '<span class="badge badge-added">+ Added</span>',
      [DiffType.REMOVED]: '<span class="badge badge-removed">- Removed</span>',
      [DiffType.MODIFIED]: '<span class="badge badge-modified">~ Modified</span>'
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
