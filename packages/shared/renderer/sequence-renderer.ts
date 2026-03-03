import { Activity } from '../parser/xaml-parser';
import { ActivityLineIndex } from '../parser/line-mapper'; // Line number mapping type
import { buildActivityKey } from '../parser/diff-calculator'; // Activity key generation
import { translateActivityType, translatePropertyName, t } from '../i18n/i18n'; // i18n translation functions
import { getSubProperties, getActivityPropertyConfig, hasSubPanel, isDefinedActivity } from './property-config'; // Property classification config

/**
 * Renderer for Sequence-style workflows.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#sequence-renderer
 */
export type ScreenshotPathResolver = (filename: string) => string; // Screenshot path resolver function type

export class SequenceRenderer {
  private lineIndex: ActivityLineIndex | null = null; // Line number mapping
  private activityIndex: number = 0; // Activity index (for key generation)
  private screenshotPathResolver: ScreenshotPathResolver; // Screenshot path resolver

  constructor(screenshotPathResolver?: ScreenshotPathResolver) {
    this.screenshotPathResolver = screenshotPathResolver || ((f) => `.screenshots/${f}`); // Default: relative path
  }

  /**
   * Render an Activity tree as HTML into the given container.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#sequence-renderer
   */
  render(parsedData: any, container: HTMLElement, lineIndex?: ActivityLineIndex): void {
    container.innerHTML = '';                   // Clear container
    this.lineIndex = lineIndex || null;        // Store line number mapping
    this.activityIndex = 0;                    // Reset index

    // Start rendering from the root activity
    const rootElement = this.renderActivity(parsedData.rootActivity);
    container.appendChild(rootElement);
  }

  /**
   * Render a single Activity as an HTML card element.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#activity-card-structure
   */
  private renderActivity(activity: Activity): HTMLElement {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.dataset.id = activity.id;              // Store ID in data attribute
    card.dataset.type = activity.type;          // Store type in data attribute

    // For undefined activities whose entire child subtree is also undefined, suppress children.
    // If at least one defined descendant exists among the children, show all children.
    const childrenToRender = (
      !isDefinedActivity(activity.type) && // Self is undefined
      activity.children.length > 0 && // Has children
      !activity.children.some(child => this.hasDefinedDescendant(child)) // All children are undefined trees
    ) ? [] : activity.children;

    // Header
    const header = document.createElement('div');
    header.className = 'activity-header';

    // Collapse button (shown only when there are children to render)
    if (childrenToRender.length > 0) {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.textContent = '▼'; // Expanded icon
      collapseBtn.title = 'Collapse/Expand';
      header.appendChild(collapseBtn);
    }

    const title = document.createElement('span');
    title.className = 'activity-title';
    title.textContent = `${translateActivityType(activity.type)}: ${activity.displayName}`;

    header.appendChild(title);

    // Compute activity key and set as data attribute (for cursor sync)
    const activityKey = buildActivityKey(activity, this.activityIndex);
    this.activityIndex++;
    card.dataset.activityKey = activityKey;

    // Insert line number badge
    if (this.lineIndex) {
      const lineRange = this.lineIndex.keyToLines.get(activityKey);
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
          e.stopPropagation(); // Prevent card click (detail panel) from firing
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
    if (activity.annotations) {
      const annotationDiv = this.renderAnnotation(activity.annotations);
      card.appendChild(annotationDiv);
    }

    // Property display
    if (Object.keys(activity.properties).length > 0) {
      const propsDiv = this.renderProperties(activity.properties, activity.type);
      if (propsDiv) { // null check
        card.appendChild(propsDiv);
      }
    }

    // Sub-property panel (after main properties, before screenshot)
    if (isDefinedActivity(activity.type) && hasSubPanel(activity.type) && Object.keys(activity.properties).length > 0) {
      const subProps = getSubProperties(activity.properties, activity.type);

      // NApplicationCard: inject Selector and repo status from TargetApp into sub-properties
      if (activity.type === 'NApplicationCard' && activity.properties['TargetApp']) {
        const targetApp = activity.properties['TargetApp'];
        if (typeof targetApp === 'object' && targetApp !== null) {
          if (targetApp.Selector) subProps['Selector'] = targetApp.Selector;
          subProps['ObjectRepository'] = targetApp.Reference ? t('Linked') : t('Not linked');
        }
      }

      // NClick: inject selector and repo status from Target (TargetAnchorable) into sub-properties
      if (activity.type === 'NClick' && activity.properties['Target']) {
        const target = activity.properties['Target'];
        if (typeof target === 'object' && target !== null) {
          if (target.FullSelectorArgument) subProps['FullSelectorArgument'] = target.FullSelectorArgument;
          if (target.FuzzySelectorArgument) subProps['FuzzySelectorArgument'] = target.FuzzySelectorArgument;
          subProps['ObjectRepository'] = target.Reference ? t('Linked') : t('Not linked');
        }
      }

      if (Object.keys(subProps).length > 0) {
        const subPanel = this.renderSubPropertyPanel(subProps, activity.type);
        card.appendChild(subPanel.toggle); // Add toggle button
        card.appendChild(subPanel.panel); // Add panel body
      }
    }

    // InformativeScreenshot display
    if (activity.informativeScreenshot) {
      const screenshotDiv = this.renderScreenshot(activity.informativeScreenshot);
      card.appendChild(screenshotDiv);
    }

    // Recursively render children (filtered)
    if (childrenToRender.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'activity-children';

      childrenToRender.forEach(child => {
        const childElement = this.renderActivity(child);
        childrenContainer.appendChild(childElement);
      });

      card.appendChild(childrenContainer);

      // Collapse button click event
      const collapseBtn = header.querySelector('.collapse-btn');
      if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card click event
          const isCollapsed = card.classList.toggle('collapsed');
          collapseBtn.textContent = isCollapsed ? '▶' : '▼';
        });
      }
    }

    // Click event: open detail panel
    card.addEventListener('click', (e) => {
      e.stopPropagation();                      // Stop event propagation
      this.showDetailPanel(activity);
    });

    return card;
  }

  /**
   * Returns true if the given activity or any of its descendants is a defined activity.
   * Used to determine whether to show children of an undefined activity.
   */
  private hasDefinedDescendant(activity: Activity): boolean {
    if (isDefinedActivity(activity.type)) return true; // Self is defined
    return activity.children.some(child => this.hasDefinedDescendant(child)); // Recurse into children
  }

  /**
   * Render properties of an activity.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#rendering-by-activity-type
   */
  private renderProperties(properties: Record<string, any>, activityType?: string): HTMLElement | null {
    const propsDiv = document.createElement('div');
    propsDiv.className = 'activity-properties';

    // Assign: show To/Value in unified expression format
    if (activityType === 'Assign' && (properties['To'] || properties['Value'])) {
      const propItem = document.createElement('div');
      propItem.className = 'property-item';

      const propValue = document.createElement('span');
      propValue.className = 'assign-expression'; // White text, monospace font
      propValue.textContent = `${this.formatValue(properties['To'])} = ${this.formatValue(properties['Value'])}`;

      propItem.appendChild(propValue);
      propsDiv.appendChild(propItem);

      // Also show other important properties besides To/Value
      const otherImportantProps = ['Condition', 'Selector', 'Message'];
      Object.entries(properties).forEach(([key, value]) => {
        if (otherImportantProps.includes(key)) {
          const otherItem = document.createElement('div');
          otherItem.className = 'property-item';

          const otherKey = document.createElement('span');
          otherKey.className = 'property-key';
          otherKey.textContent = `${translatePropertyName(key)}:`;

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

    // MultipleAssign: show each expression in AssignOperations
    if (activityType === 'MultipleAssign' && properties['AssignOperations']) {
      const operations = properties['AssignOperations'] as Array<{ To: string; Value: string }>;
      operations.forEach(op => {
        const propItem = document.createElement('div');
        propItem.className = 'property-item';

        const propValue = document.createElement('span');
        propValue.className = 'assign-expression'; // Same style as Assign
        propValue.textContent = `${this.formatValue(op.To)} = ${this.formatValue(op.Value)}`;

        propItem.appendChild(propValue);
        propsDiv.appendChild(propItem);
      });

      return propsDiv;
    }

    // NApplicationCard: show URL from TargetApp
    if (activityType === 'NApplicationCard' && properties['TargetApp']) {
      const targetApp = properties['TargetApp'];

      if (typeof targetApp === 'object' && targetApp !== null && targetApp.Url) {
        const urlItem = document.createElement('div');
        urlItem.className = 'property-item';
        const urlKey = document.createElement('span');
        urlKey.className = 'property-key';
        urlKey.textContent = `${translatePropertyName('Url')}:`;
        const urlValue = document.createElement('span');
        urlValue.className = 'property-value';
        urlValue.textContent = targetApp.Url;
        urlItem.appendChild(urlKey);
        urlItem.appendChild(urlValue);
        propsDiv.appendChild(urlItem);
        return propsDiv;
      }

      return null;
    }

    // N-prefix activities (except NApplicationCard): show only main properties from config
    if (activityType && activityType.startsWith('N') && activityType !== 'NApplicationCard') {
      const config = getActivityPropertyConfig(activityType);
      let hasVisibleMainProps = false;

      for (const mainKey of config.mainProperties) {
        if (properties[mainKey] !== undefined) {
          const value = properties[mainKey];

          // Target as object is shown in the sub-panel, not the main area
          if (mainKey === 'Target' && typeof value === 'object' && value !== null) {
            continue; // Delegate to sub-properties
          }

          const propItem = document.createElement('div');
          propItem.className = 'property-item';

          const propKey = document.createElement('span');
          propKey.className = 'property-key';
          propKey.textContent = `${translatePropertyName(mainKey)}:`;

          const propValue = document.createElement('span');
          propValue.className = 'property-value';
          propValue.textContent = this.formatValue(value);

          propItem.appendChild(propKey);
          propItem.appendChild(propValue);
          propsDiv.appendChild(propItem);
          hasVisibleMainProps = true;
        }
      }

      return hasVisibleMainProps ? propsDiv : null;
    }

    // LogMessage: show Level and Message
    if (activityType === 'LogMessage') {
      let hasVisibleProps = false;

      // Level property
      if (properties['Level']) {
        const levelItem = document.createElement('div');
        levelItem.className = 'property-item';

        const levelKey = document.createElement('span');
        levelKey.className = 'property-key';
        levelKey.textContent = `${translatePropertyName('Level')}:`;

        const levelValue = document.createElement('span');
        levelValue.className = 'property-value';
        levelValue.textContent = this.formatValue(properties['Level']);

        levelItem.appendChild(levelKey);
        levelItem.appendChild(levelValue);
        propsDiv.appendChild(levelItem);
        hasVisibleProps = true;
      }

      // Message property
      if (properties['Message']) {
        const msgItem = document.createElement('div');
        msgItem.className = 'property-item';

        const msgKey = document.createElement('span');
        msgKey.className = 'property-key';
        msgKey.textContent = `${translatePropertyName('Message')}:`;

        const msgValue = document.createElement('span');
        msgValue.className = 'property-value';
        msgValue.textContent = this.formatValue(properties['Message']);

        msgItem.appendChild(msgKey);
        msgItem.appendChild(msgValue);
        propsDiv.appendChild(msgItem);
        hasVisibleProps = true;
      }

      return hasVisibleProps ? propsDiv : null;
    }

    // Undefined activities: hide all properties
    return null;
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

  /**
   * Render an InformativeScreenshot thumbnail
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#screenshot-path-resolution
   */
  private renderScreenshot(filename: string): HTMLElement {
    const screenshotDiv = document.createElement('div');
    screenshotDiv.className = 'informative-screenshot';

    const img = document.createElement('img');
    img.className = 'screenshot-thumbnail';
    img.src = this.resolveScreenshotPath(filename);
    img.alt = filename;
    img.loading = 'lazy';                       // Lazy loading

    // Handle image load error
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
   * Resolve the screenshot file path using the configured resolver
   */
  private resolveScreenshotPath(filename: string): string {
    return this.screenshotPathResolver(filename);
  }

  /**
   * Show the detail panel for the given activity
   */
  private showDetailPanel(activity: Activity): void {
    const detailPanel = document.getElementById('detail-panel');
    const detailContent = document.getElementById('detail-content');

    if (!detailPanel || !detailContent) return;

    // Render detail information
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

    detailPanel.style.display = 'block';        // Show panel
  }

  /**
   * Render all properties for the detail panel
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
   * Render a sub-property panel (toggle button + panel body).
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#activity-card-structure
   */
  private renderSubPropertyPanel(
    subProps: Record<string, any>,
    activityType: string
  ): { toggle: HTMLElement; panel: HTMLElement } {
    // Toggle button
    const toggle = document.createElement('button');
    toggle.className = 'property-sub-panel-toggle';
    toggle.textContent = `${t('Toggle property panel')} ▶`; // Collapsed state label

    // Panel body (initially hidden)
    const panel = document.createElement('div');
    panel.className = 'property-sub-panel';
    panel.style.display = 'none'; // Initially hidden

    // Get groups from activity configuration
    const config = getActivityPropertyConfig(activityType);

    if (config.subGroups.length > 0) {
      // Display by group
      const groupedKeys = new Set<string>(); // Keys already assigned to a group
      for (const group of config.subGroups) {
        const groupProps: Record<string, any> = {};
        for (const propName of group.properties) {
          if (subProps[propName] !== undefined) {
            groupProps[propName] = subProps[propName];
            groupedKeys.add(propName);
          }
        }
        if (Object.keys(groupProps).length > 0) {
          const groupDiv = this.renderPropertyGroup(group.label(), groupProps);
          panel.appendChild(groupDiv);
        }
      }

      // Show ungrouped properties under a "Common" group
      const ungrouped: Record<string, any> = {};
      for (const [key, value] of Object.entries(subProps)) {
        if (!groupedKeys.has(key)) {
          ungrouped[key] = value;
        }
      }
      if (Object.keys(ungrouped).length > 0) {
        const commonDiv = this.renderPropertyGroup(t('Common'), ungrouped);
        panel.appendChild(commonDiv);
      }
    } else {
      // No groups: display properties flat
      for (const [key, value] of Object.entries(subProps)) {
        const propItem = document.createElement('div');
        propItem.className = 'property-item';

        const propKey = document.createElement('span');
        propKey.className = 'property-key';
        propKey.textContent = `${translatePropertyName(key)}:`;

        const propValue = document.createElement('span');
        propValue.className = 'property-value';
        propValue.textContent = this.formatValue(value);

        propItem.appendChild(propKey);
        propItem.appendChild(propValue);
        panel.appendChild(propItem);
      }
    }

    // Toggle button click event
    toggle.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click event
      const isExpanded = panel.style.display !== 'none';
      panel.style.display = isExpanded ? 'none' : 'block';
      toggle.textContent = isExpanded
        ? `${t('Toggle property panel')} ▶` // Collapsed state
        : `${t('Toggle property panel')} ▼`; // Expanded state
    });

    return { toggle, panel };
  }

  /**
   * Render a property group (UiPath Studio-style category display)
   */
  private renderPropertyGroup(label: string, properties: Record<string, any>): HTMLElement {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'property-group';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'property-group-header';
    headerDiv.textContent = label;
    groupDiv.appendChild(headerDiv);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'property-group-body';

    for (const [key, value] of Object.entries(properties)) {
      const propItem = document.createElement('div');
      propItem.className = 'property-item';

      const propKey = document.createElement('span');
      propKey.className = 'property-key';
      propKey.textContent = `${translatePropertyName(key)}:`;

      const propValue = document.createElement('span');
      propValue.className = 'property-value';
      propValue.textContent = this.formatValue(value);

      propItem.appendChild(propKey);
      propItem.appendChild(propValue);
      bodyDiv.appendChild(propItem);
    }

    groupDiv.appendChild(bodyDiv);
    return groupDiv;
  }

  /**
   * Format a property value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);    // Stringify objects as JSON
    }

    return String(value);
  }
}
