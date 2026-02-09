import { Activity } from '../parser/xaml-parser';

/**
 * ツリービューレンダラー
 */
export class TreeViewRenderer {
  /**
   * アクティビティツリーをツリー表示としてレンダリング
   */
  render(parsedData: any, container: HTMLElement): void {
    container.innerHTML = '';                   // コンテナをクリア

    // ルートアクティビティからツリーを生成
    const tree = this.createTreeNode(parsedData.rootActivity, 0);
    container.appendChild(tree);
  }

  /**
   * ツリーノードを作成
   */
  private createTreeNode(activity: Activity, depth: number): HTMLElement {
    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';
    treeItem.dataset.id = activity.id;          // データ属性にIDを設定
    treeItem.style.paddingLeft = `${depth * 20}px`; // インデント

    // 展開/折りたたみボタン
    const hasChildren = activity.children.length > 0;
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'tree-toggle';
    toggleBtn.textContent = hasChildren ? '▼' : '  '; // 子がある場合は▼
    toggleBtn.style.cursor = hasChildren ? 'pointer' : 'default';

    // ラベル
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = `${this.getActivityIcon(activity.type)} ${activity.displayName}`;

    // ノードをクリックしたらメインビューでハイライト
    label.addEventListener('click', () => {
      this.highlightActivity(activity.id);
    });

    treeItem.appendChild(toggleBtn);
    treeItem.appendChild(label);

    // 子ノードのコンテナ
    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';

      activity.children.forEach(child => {
        const childNode = this.createTreeNode(child, depth + 1);
        childrenContainer.appendChild(childNode);
      });

      treeItem.appendChild(childrenContainer);

      // 展開/折りたたみのイベント
      toggleBtn.addEventListener('click', () => {
        const isExpanded = !childrenContainer.classList.contains('collapsed');
        childrenContainer.classList.toggle('collapsed', isExpanded);
        toggleBtn.textContent = isExpanded ? '▶' : '▼'; // アイコン変更
      });
    }

    return treeItem;
  }

  /**
   * メインビューで該当アクティビティをハイライト
   */
  private highlightActivity(activityId: string): void {
    // 既存のハイライトを削除
    document.querySelectorAll('.activity-card.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // 該当アクティビティにハイライトを追加
    const targetCard = document.querySelector(`.activity-card[data-id="${activityId}"]`);
    if (targetCard) {
      targetCard.classList.add('highlighted');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); // スクロール
    }
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
