import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // Line number mapping type
import { buildActivityKey } from '../parser/diff-calculator'; // Activity key generation

/**
 * Tree view renderer: renders the Activity tree as a collapsible tree.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#tree-view-renderer
 */
export class TreeViewRenderer {
  private lineIndex: ActivityLineIndex | null = null; // Line number mapping
  private activityIndex: number = 0; // Activity index (for key generation)

  /**
   * Render an Activity tree as a collapsible tree into the given container.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#tree-view-renderer
   */
  render(parsedData: any, container: HTMLElement, lineIndex?: ActivityLineIndex): void {
    container.innerHTML = '';                   // Clear container
    this.lineIndex = lineIndex || null;        // Store line number mapping
    this.activityIndex = 0;                    // Reset index

    // Build tree starting from the root activity
    const tree = this.createTreeNode(parsedData.rootActivity, 0);
    container.appendChild(tree);
  }

  /**
   * Create a tree node element for the given activity
   */
  private createTreeNode(activity: Activity, depth: number): HTMLElement {
    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';
    treeItem.dataset.id = activity.id;          // Store ID in data attribute
    treeItem.style.paddingLeft = `${depth * 20}px`; // Indent by depth

    // Expand/collapse toggle button
    const hasChildren = activity.children.length > 0;
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'tree-toggle';
    toggleBtn.textContent = hasChildren ? '▼' : '  '; // Show ▼ if has children
    toggleBtn.style.cursor = hasChildren ? 'pointer' : 'default';

    // Label
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = `${this.getActivityIcon(activity.type)} ${activity.displayName}`;

    // Click label to highlight the corresponding card in the main sequence view
    label.addEventListener('click', () => {
      this.highlightActivity(activity.id);
    });

    treeItem.appendChild(toggleBtn);
    treeItem.appendChild(label);

    // Insert line number badge
    if (this.lineIndex) {
      const activityKey = buildActivityKey(activity, this.activityIndex);
      this.activityIndex++;
      const lineRange = this.lineIndex.keyToLines.get(activityKey);
      if (lineRange) {
        const lineBadge = document.createElement('span');
        lineBadge.className = 'line-range-badge';
        lineBadge.textContent = lineRange.startLine === lineRange.endLine
          ? `L${lineRange.startLine}`
          : `L${lineRange.startLine}-L${lineRange.endLine}`;
        lineBadge.title = `XAML line ${lineRange.startLine}–${lineRange.endLine}`;
        treeItem.appendChild(lineBadge);
      }
    }

    // Children container
    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';

      activity.children.forEach(child => {
        const childNode = this.createTreeNode(child, depth + 1);
        childrenContainer.appendChild(childNode);
      });

      treeItem.appendChild(childrenContainer);

      // Expand/collapse event
      toggleBtn.addEventListener('click', () => {
        const isExpanded = !childrenContainer.classList.contains('collapsed');
        childrenContainer.classList.toggle('collapsed', isExpanded);
        toggleBtn.textContent = isExpanded ? '▶' : '▼'; // Toggle icon
      });
    }

    return treeItem;
  }

  /**
   * Highlight the corresponding activity card in the main sequence view and scroll to it
   */
  private highlightActivity(activityId: string): void {
    // Remove existing highlights
    document.querySelectorAll('.activity-card.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // Add highlight to the target activity card
    const targetCard = document.querySelector(`.activity-card[data-id="${activityId}"]`);
    if (targetCard) {
      targetCard.classList.add('highlighted');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Smooth scroll
    }
  }

  /**
   * Get the icon string for an activity type
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

    return iconMap[type] || '[Act]';            // Default icon
  }
}
