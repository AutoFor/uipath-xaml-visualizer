import { DiffResult, DiffActivity, DiffType, PropertyChange, buildActivityKey } from '../parser/diff-calculator';
import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // Line number mapping type
import { translateActivityType, translatePropertyName, t } from '../i18n/i18n'; // i18n translation functions

/**
 * Diff renderer: renders DiffResult as a list of diff cards.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#diff-renderer
 */
export type DiffScreenshotPathResolver = (filename: string) => string; // Screenshot path resolver function type

export class DiffRenderer {
  private activityIndex: number = 0; // Activity index (for key generation)
  private headLineIndex: ActivityLineIndex | null = null; // Line number mapping for head side
  private baseLineIndex: ActivityLineIndex | null = null; // Line number mapping for base side
  private screenshotPathResolver: DiffScreenshotPathResolver; // Screenshot path resolver

  constructor(screenshotPathResolver?: DiffScreenshotPathResolver) {
    this.screenshotPathResolver = screenshotPathResolver || ((f) => `.screenshots/${f}`); // Default: relative path
  }

  /**
   * Render a DiffResult as HTML into the given container.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#diff-renderer
   */
  render(
    diff: DiffResult,
    container: HTMLElement,
    headLineIndex?: ActivityLineIndex,  // Line number mapping for head side
    baseLineIndex?: ActivityLineIndex   // Line number mapping for base side
  ): void {
    container.innerHTML = '';                   // Clear container
    this.activityIndex = 0; // Reset index
    this.headLineIndex = headLineIndex || null; // Store head line map
    this.baseLineIndex = baseLineIndex || null; // Store base line map

    // Added activities
    diff.added.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });

    // Removed activities
    diff.removed.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });

    // Modified activities
    diff.modified.forEach(diffActivity => {
      const element = this.renderDiffActivity(diffActivity);
      container.appendChild(element);
    });
  }

  /**
   * Render a single diff activity as an HTML card element
   */
  private renderDiffActivity(diffActivity: DiffActivity): HTMLElement {
    const card = document.createElement('div');
    card.className = `diff-item activity-card diff-${diffActivity.diffType}`;
    card.dataset.id = diffActivity.activity.id;

    // Compute activity key
    const activityKey = this.getActivityKeyForDiff(diffActivity);
    card.dataset.activityKey = activityKey;

    // Header
    const header = document.createElement('div');
    header.className = 'activity-header';

    const badge = this.getDiffBadge(diffActivity.diffType);

    const title = document.createElement('span');
    title.className = 'activity-title';

    title.innerHTML = `${translateActivityType(diffActivity.activity.type)}: ${diffActivity.activity.displayName} ${badge}`;

    header.appendChild(title);

    // Insert line number badge (added -> head, removed -> base, modified -> head)
    const lineIndex = diffActivity.diffType === DiffType.REMOVED ? this.baseLineIndex : this.headLineIndex;
    if (lineIndex) {
      const lineRange = lineIndex.keyToLines.get(activityKey);
      if (lineRange) {
        const lineBadge = document.createElement('span');
        lineBadge.className = 'line-range-badge';
        lineBadge.dataset.startLine = String(lineRange.startLine);
        lineBadge.dataset.endLine = String(lineRange.endLine);
        lineBadge.textContent = lineRange.startLine === lineRange.endLine
          ? `L${lineRange.startLine}`
          : `L${lineRange.startLine}-L${lineRange.endLine}`;
        lineBadge.title = `XAML line ${lineRange.startLine}–${lineRange.endLine}`;
        lineBadge.style.cursor = 'pointer';
        lineBadge.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card click event
          lineBadge.dispatchEvent(new CustomEvent('visualizer-line-click', { // Fire cursor sync event
            bubbles: true, // Bubble up to the panel
            detail: { activityKey, startLine: lineRange.startLine, endLine: lineRange.endLine }
          }));
        });
        header.appendChild(lineBadge);
      }
    }

    card.appendChild(header);

    // Annotation display (shown immediately after the header)
    if (diffActivity.activity.annotations) {
      const annotationDiv = this.renderAnnotation(diffActivity.activity.annotations);
      card.appendChild(annotationDiv);
    }

    // Show assign expression for Assign (added or removed)
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'Assign') {
      const expr = this.renderAssignExpression(diffActivity.activity, diffActivity.diffType);
      if (expr) card.appendChild(expr);
    }

    // Show assign expressions for MultipleAssign (added or removed)
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'MultipleAssign') {
      const expr = this.renderMultipleAssignExpression(diffActivity.activity, diffActivity.diffType);
      if (expr) card.appendChild(expr);
    }

    // Show key properties for NApplicationCard (added or removed)
    if ((diffActivity.diffType === DiffType.ADDED || diffActivity.diffType === DiffType.REMOVED)
        && diffActivity.activity.type === 'NApplicationCard') {
      const props = this.renderNApplicationCardProperties(diffActivity.activity, diffActivity.diffType);
      if (props) card.appendChild(props);
    }

    // Show changes for modified activities
    if (diffActivity.diffType === DiffType.MODIFIED && diffActivity.changes) {
      if (diffActivity.activity.type === 'Assign') {
        const assignChanges = this.renderAssignChanges(diffActivity);  // Assign-specific change display
        card.appendChild(assignChanges);
      } else if (diffActivity.activity.type === 'MultipleAssign') {
        const multiChanges = this.renderMultipleAssignChanges(diffActivity); // MultipleAssign-specific change display
        card.appendChild(multiChanges);
      } else {
        const changesDiv = this.renderPropertyChanges(diffActivity.changes);
        card.appendChild(changesDiv);
      }
    }

    // Show screenshot diff if applicable
    if (this.hasScreenshotChange(diffActivity)) {
      const screenshotDiff = this.renderScreenshotDiff(diffActivity);
      card.appendChild(screenshotDiff);
    }

    return card;
  }

  /**
   * Get the activity key for a DiffActivity
   */
  private getActivityKeyForDiff(diffActivity: DiffActivity): string {
    const key = buildActivityKey(diffActivity.activity, this.activityIndex);
    this.activityIndex++;
    return key;
  }

  /**
   * Render an annotation as a note-style element
   */
  private renderAnnotation(text: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'activity-annotation'; // Note-style class
    div.textContent = text;
    return div;
  }

  // ========== Rendering methods ==========

  /**
   * Render property changes as a diff list
   */
  private renderPropertyChanges(changes: PropertyChange[]): HTMLElement {
    const changesDiv = document.createElement('div');
    changesDiv.className = 'property-changes';

    const changesList = document.createElement('div');
    changesList.className = 'property-diff-detail';

    changes.forEach(change => {
      // For object-to-object changes, expand to attribute-level diffs
      if (typeof change.before === 'object' && change.before !== null
          && typeof change.after === 'object' && change.after !== null
          && !Array.isArray(change.before) && !Array.isArray(change.after)) {
        this.renderObjectPropertyDiff(changesList, change.before, change.after);
        return;
      }

      const changeItem = document.createElement('div');
      changeItem.className = 'property-change-item';

      // Property name
      const propName = document.createElement('div');
      propName.className = 'prop-name';
      propName.textContent = `${translatePropertyName(change.propertyName)}:`;

      // Before value (with word-level diff highlighting)
      const beforeText = this.formatValue(change.before);
      const afterText = this.formatValue(change.after);

      const beforeValue = document.createElement('div');
      beforeValue.className = 'diff-before';
      this.buildWordDiffHtml(beforeValue, '-', beforeText, afterText);

      // After value (with word-level diff highlighting)
      const afterValue = document.createElement('div');
      afterValue.className = 'diff-after';
      this.buildWordDiffHtml(afterValue, '+', afterText, beforeText);

      changeItem.appendChild(propName);
      changeItem.appendChild(beforeValue);
      changeItem.appendChild(afterValue);
      changesList.appendChild(changeItem);
    });

    changesDiv.appendChild(changesList);
    return changesDiv;
  }

  /**
   * Expand an object-typed property change to attribute-level diffs
   */
  private renderObjectPropertyDiff(
    container: HTMLElement,
    beforeObj: Record<string, any>,
    afterObj: Record<string, any>
  ): void {
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
    for (const key of allKeys) {
      if (key === 'type') continue;                                      // Skip internal 'type' key
      const bStr = this.formatValue(beforeObj[key]);
      const aStr = this.formatValue(afterObj[key]);
      if (bStr === aStr) continue;                                       // No change

      const changeItem = document.createElement('div');
      changeItem.className = 'property-change-item';

      const propName = document.createElement('div');
      propName.className = 'prop-name';
      propName.textContent = `${key}:`;                                  // Sub-key name

      const beforeValue = document.createElement('div');
      beforeValue.className = 'diff-before';
      this.buildWordDiffHtml(beforeValue, '-', bStr, aStr);             // Word-level diff

      const afterValue = document.createElement('div');
      afterValue.className = 'diff-after';
      this.buildWordDiffHtml(afterValue, '+', aStr, bStr);             // Word-level diff

      changeItem.appendChild(propName);
      changeItem.appendChild(beforeValue);
      changeItem.appendChild(afterValue);
      container.appendChild(changeItem);
    }
  }

  /**
   * Check if a diff activity has a screenshot change
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
   * Render a screenshot comparison (before/after)
   */
  private renderScreenshotDiff(diffActivity: DiffActivity): HTMLElement {
    const screenshotDiffDiv = document.createElement('div');
    screenshotDiffDiv.className = 'screenshot-compare';

    const header = document.createElement('div');
    header.className = 'screenshot-header';
    header.textContent = t('Screenshot Changed:');

    const compareContainer = document.createElement('div');
    compareContainer.className = 'compare-container';

    // Before image
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

    // After image
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
   * Render the assign expression for an Assign activity (for added/removed)
   */
  private renderAssignExpression(activity: Activity, diffType: DiffType): HTMLElement | null {
    const to = activity.properties['To'];        // Left-hand side
    const value = activity.properties['Value'];  // Right-hand side
    if (!to && !value) return null;              // Nothing to show

    const div = document.createElement('div');
    const isAdded = diffType === DiffType.ADDED;
    div.className = isAdded ? 'diff-after' : 'diff-before';
    const prefix = isAdded ? '+' : '-';
    div.textContent = `${prefix} ${this.formatValue(to)} = ${this.formatValue(value)}`;
    return div;
  }

  /**
   * Render assign change details for a modified Assign activity
   */
  private renderAssignChanges(diffActivity: DiffActivity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-changes';

    const beforeAct = diffActivity.beforeActivity;
    const afterAct = diffActivity.activity;

    // If To or Value changed, display in unified expression format
    const hasAssignChange = diffActivity.changes?.some(
      c => c.propertyName === 'To' || c.propertyName === 'Value'
    );

    if (hasAssignChange && beforeAct) {
      const beforeTo = beforeAct.properties['To'];
      const beforeVal = beforeAct.properties['Value'];
      const afterTo = afterAct.properties['To'];
      const afterVal = afterAct.properties['Value'];

      const beforeText = `${this.formatValue(beforeTo)} = ${this.formatValue(beforeVal)}`;
      const afterText = `${this.formatValue(afterTo)} = ${this.formatValue(afterVal)}`;

      // Before line with word-level diff
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'diff-before';
      this.buildWordDiffHtml(beforeDiv, '-', beforeText, afterText);
      container.appendChild(beforeDiv);

      // After line with word-level diff
      const afterDiv = document.createElement('div');
      afterDiv.className = 'diff-after';
      this.buildWordDiffHtml(afterDiv, '+', afterText, beforeText);
      container.appendChild(afterDiv);
    }

    // Show other property changes normally
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
   * Render assign expressions for a MultipleAssign activity (for added/removed)
   */
  private renderMultipleAssignExpression(activity: Activity, diffType: DiffType): HTMLElement | null {
    const operations = activity.properties['AssignOperations'] as Array<{ To: string; Value: string }>;
    if (!operations || operations.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'property-changes';
    const isAdded = diffType === DiffType.ADDED;

    operations.forEach(op => {
      const div = document.createElement('div');
      div.className = isAdded ? 'diff-after' : 'diff-before';
      const prefix = isAdded ? '+' : '-';
      div.textContent = `${prefix} ${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`;
      container.appendChild(div);
    });

    return container;
  }

  /**
   * Render key properties for NApplicationCard (for added/removed)
   */
  private renderNApplicationCardProperties(activity: Activity, diffType: DiffType): HTMLElement | null {
    const targetApp = activity.properties['TargetApp'];
    if (!targetApp || typeof targetApp !== 'object') return null;

    const propsDiv = document.createElement('div');
    propsDiv.className = 'property-changes';
    const isAdded = diffType === DiffType.ADDED;
    const className = isAdded ? 'diff-after' : 'diff-before';
    const prefix = isAdded ? '+' : '-';
    let hasProps = false;

    // Show URL
    if (targetApp.Url) {
      const urlDiv = document.createElement('div');
      urlDiv.className = className;
      urlDiv.textContent = `${prefix} ${translatePropertyName('Url')}: ${targetApp.Url}`;
      propsDiv.appendChild(urlDiv);
      hasProps = true;
    }

    // Show object repository link status
    const repoDiv = document.createElement('div');
    repoDiv.className = className;
    repoDiv.textContent = `${prefix} ${translatePropertyName('ObjectRepository')}: ${targetApp.Reference ? t('Linked') : t('Not linked')}`;
    propsDiv.appendChild(repoDiv);
    hasProps = true;

    return hasProps ? propsDiv : null;
  }

  /**
   * Render change details for a modified MultipleAssign activity
   */
  private renderMultipleAssignChanges(diffActivity: DiffActivity): HTMLElement {
    const container = document.createElement('div');
    container.className = 'property-changes';

    const hasAssignOpsChange = diffActivity.changes?.some(
      c => c.propertyName === 'AssignOperations'
    );

    if (hasAssignOpsChange && diffActivity.beforeActivity) {
      const beforeOps = (diffActivity.beforeActivity.properties['AssignOperations'] || []) as Array<{ To: string; Value: string }>;
      const afterOps = (diffActivity.activity.properties['AssignOperations'] || []) as Array<{ To: string; Value: string }>;

      // Show each before expression
      beforeOps.forEach(op => {
        const beforeText = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`;
        const beforeDiv = document.createElement('div');
        beforeDiv.className = 'diff-before';
        beforeDiv.textContent = `- ${beforeText}`; // Removal prefix
        container.appendChild(beforeDiv);
      });

      // Show each after expression
      afterOps.forEach(op => {
        const afterText = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`;
        const afterDiv = document.createElement('div');
        afterDiv.className = 'diff-after';
        afterDiv.textContent = `+ ${afterText}`; // Addition prefix
        container.appendChild(afterDiv);
      });
    }

    // Show other property changes normally
    const otherChanges = diffActivity.changes?.filter(
      c => c.propertyName !== 'AssignOperations'
    ) || [];

    if (otherChanges.length > 0) {
      const otherDiv = this.renderPropertyChanges(otherChanges);
      container.appendChild(otherDiv);
    }

    return container;
  }

  /**
   * Decode XML entities in a string
   */
  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')                   // Ampersand
      .replace(/&lt;/g, '<')                     // Less than
      .replace(/&gt;/g, '>')                     // Greater than
      .replace(/&quot;/g, '"')                   // Double quote
      .replace(/&apos;/g, "'")                   // Single quote
      .replace(/&nbsp;/g, ' ');                  // Non-breaking space
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (typeof value === 'object') {
      return this.decodeXmlEntities(JSON.stringify(value));  // Stringify and decode XML entities
    }

    return this.decodeXmlEntities(String(value));  // Stringify and decode XML entities
  }

  /**
   * Build word-level diff HTML, wrapping changed parts in <span class="word-highlight">.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#word-level-diff
   */
  private buildWordDiffHtml(div: HTMLElement, prefix: string, text: string, otherText: string): void {
    const common = this.findCommonParts(text, otherText); // Compute common and diff parts
    div.textContent = ''; // Clear text content
    div.appendChild(document.createTextNode(prefix + ' ')); // Prefix (- or +)

    // Calculate similarity (if too low, highlight the entire string)
    const sameLen = common.reduce((sum, p) => sum + (p.same ? p.value.length : 0), 0);
    const totalLen = common.reduce((sum, p) => sum + p.value.length, 0);
    const similarity = totalLen > 0 ? sameLen / totalLen : 0;

    if (similarity < 0.5) {
      // Less than 50% similarity: highlight the whole string (prevents spurious hash matches)
      const span = document.createElement('span');
      span.className = 'word-highlight';
      span.textContent = text;
      div.appendChild(span);
      return;
    }

    common.forEach(part => {
      if (part.same) {
        div.appendChild(document.createTextNode(part.value)); // Common parts as plain text
      } else {
        const span = document.createElement('span'); // Wrap diff parts in a span
        span.className = 'word-highlight';
        span.textContent = part.value;
        div.appendChild(span);
      }
    });
  }

  /**
   * Compute common and differing parts between two strings (character-level LCS approximation)
   */
  private findCommonParts(a: string, b: string): { value: string; same: boolean }[] {
    const result: { value: string; same: boolean }[] = [];
    let ai = 0; // Index into a
    let bi = 0; // Index into b

    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        let start = ai; // Start of common section
        while (ai < a.length && bi < b.length && a[ai] === b[bi]) {
          ai++;
          bi++;
        }
        result.push({ value: a.substring(start, ai), same: true }); // Common part
      } else {
        // Find the next sync point (three strategies)
        let foundA = -1;    // Skip only in a (extra chars in a)
        let foundB = -1;    // Skip only in b (extra chars in b)
        let foundBoth = -1; // Skip same amount in both (replacement)
        const searchLimit = Math.min(Math.max(a.length - ai, b.length - bi), 20); // Search window
        for (let d = 1; d < searchLimit; d++) {
          if (foundBoth < 0 && ai + d < a.length && bi + d < b.length && a[ai + d] === b[bi + d]) {
            foundBoth = d; // Advancing d steps in both leads to a match (replacement)
          }
          if (foundA < 0 && ai + d < a.length && a[ai + d] === b[bi]) {
            foundA = d; // Advancing d steps in a leads to a match (extra chars in a)
          }
          if (foundB < 0 && bi + d < b.length && a[ai] === b[bi + d]) {
            foundB = d; // Advancing d steps in b leads to a match (extra chars in b)
          }
          if (foundBoth >= 0 || foundA >= 0 || foundB >= 0) break;
        }

        // Choose the minimum-cost strategy
        if (foundBoth >= 0 && (foundA < 0 || foundBoth <= foundA) && (foundB < 0 || foundBoth <= foundB)) {
          result.push({ value: a.substring(ai, ai + foundBoth), same: false }); // Replacement
          ai += foundBoth;
          bi += foundBoth;
        } else if (foundA >= 0 && (foundB < 0 || foundA <= foundB)) {
          result.push({ value: a.substring(ai, ai + foundA), same: false }); // Extra chars in a
          ai += foundA;
        } else if (foundB >= 0) {
          bi += foundB; // Skip extra chars in b (no output for a)
        } else {
          result.push({ value: a.substring(ai), same: false }); // Rest of a is a diff
          ai = a.length;
          bi = b.length;
        }
      }
    }
    if (ai < a.length) {
      result.push({ value: a.substring(ai), same: false }); // Remaining chars in a
    }
    return result;
  }

  /**
   * Get the diff badge HTML for a given diff type
   */
  private getDiffBadge(diffType: DiffType): string {
    const badgeMap: Record<DiffType, string> = {
      [DiffType.ADDED]: `<span class="badge badge-added">+ ${t('Added')}</span>`,
      [DiffType.REMOVED]: `<span class="badge badge-removed">- ${t('Removed')}</span>`,
      [DiffType.MODIFIED]: `<span class="badge badge-modified">~ ${t('Modified')}</span>`
    };

    return badgeMap[diffType];
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
