/**
 * XAML Line Mapper
 * Scans XAML text line by line and identifies the start/end line of each activity.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#line-mapper
 */


/**
 * Line range of an activity
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#index-structure
 */
export interface ActivityLineRange {
  activityKey: string;   // Unique key for the activity
  displayName: string;   // Display name
  type: string;          // Activity type
  startLine: number;     // Start line (1-based)
  endLine: number;       // End line (1-based)
}

/**
 * Bidirectional line index
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#index-structure
 */
export interface ActivityLineIndex {
  keyToLines: Map<string, ActivityLineRange>;  // Activity key -> line range
  lineToKey: Map<number, string>;              // Line number -> activity key
}

/**
 * Internal XML tag info parsed from a single line
 */
interface TagInfo {
  line: number;         // Line number where the tag appears (1-based)
  tagName: string;      // Tag name without namespace prefix
  fullTagName: string;  // Full tag name including prefix
  isClose: boolean;     // Whether this is a closing tag
  isSelfClose: boolean; // Whether this is a self-closing tag
  attributes: Map<string, string>; // Attribute name -> value map
}

/**
 * XAML Line Mapper class
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#line-mapper
 */
export class XamlLineMapper {
  /**
   * Build a line number index from XAML text.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#algorithm
   */
  static buildLineMap(xamlText: string): ActivityLineIndex {
    const keyToLines = new Map<string, ActivityLineRange>(); // Key -> line range map
    const lineToKey = new Map<number, string>(); // Line -> key map

    if (!xamlText) {
      return { keyToLines, lineToKey }; // Return empty maps for empty text
    }

    const lines = xamlText.split('\n'); // Split into lines
    const tagStack: { tagName: string; startLine: number; attributes: Map<string, string> }[] = []; // Open tag stack
    const activityCounters = new Map<string, number>(); // Occurrence count per activity type

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1; // 1-based line number
      const line = lines[i]; // Current line

      const tags = XamlLineMapper.extractTags(line, lineNum); // Extract tags from this line

      for (const tag of tags) {
        if (tag.isSelfClose) {
          // Self-closing tag: activity contained in a single line
          XamlLineMapper.registerActivity(
            tag, lineNum, lineNum,
            activityCounters, keyToLines, lineToKey
          );
        } else if (tag.isClose) {
          // Closing tag: find the matching open tag in the stack
          for (let j = tagStack.length - 1; j >= 0; j--) {
            if (tagStack[j].tagName === tag.tagName) {
              const openTag = tagStack.splice(j, 1)[0]; // Pop from stack
              XamlLineMapper.registerActivityFromStack(
                openTag, lineNum,
                activityCounters, keyToLines, lineToKey
              );
              break;
            }
          }
        } else {
          // Opening tag: push to stack
          tagStack.push({
            tagName: tag.tagName,
            startLine: lineNum,
            attributes: tag.attributes
          });
        }
      }
    }

    return { keyToLines, lineToKey }; // Return the built index
  }

  /**
   * Extract XML tags from a single line
   */
  private static extractTags(line: string, lineNum: number): TagInfo[] {
    const tags: TagInfo[] = [];

    // Regex to detect XML tags (open, close, self-closing)
    const tagPattern = /<(\/?)([a-zA-Z0-9_:.]+)((?:\s+[^>]*?)?)(\/?)\s*>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(line)) !== null) {
      const isClose = match[1] === '/'; // Is closing tag
      const fullTagName = match[2]; // Full tag name
      const attrStr = match[3]; // Attribute string
      const isSelfClose = match[4] === '/'; // Is self-closing tag

      // Strip namespace prefix from tag name
      const tagName = fullTagName.includes(':')
        ? fullTagName.split(':').pop()! // Take the part after the colon
        : fullTagName;

      // Parse attributes
      const attributes = new Map<string, string>();
      if (attrStr) {
        const attrPattern = /([a-zA-Z0-9_:.]+)\s*=\s*"([^"]*)"/g; // Attribute pattern
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrPattern.exec(attrStr)) !== null) {
          attributes.set(attrMatch[1], attrMatch[2]);
        }
      }

      tags.push({
        line: lineNum,
        tagName,
        fullTagName,
        isClose,
        isSelfClose,
        attributes
      });
    }

    return tags;
  }

  /**
   * Register an activity from a self-closing tag
   */
  private static registerActivity(
    tag: TagInfo,
    startLine: number,
    endLine: number,
    counters: Map<string, number>,
    keyToLines: Map<string, ActivityLineRange>,
    lineToKey: Map<number, string>
  ): void {
    const idRef = tag.attributes.get('sap2010:WorkflowViewState.IdRef'); // IdRef attribute
    const displayName = tag.attributes.get('DisplayName') || tag.tagName; // Display name
    const type = tag.tagName; // Activity type

    // Count occurrences (same fallback logic as buildActivityKey)
    const counterKey = `${type}_${displayName}`;
    const index = counters.get(counterKey) || 0;
    counters.set(counterKey, index + 1);

    // Generate activity key (same logic as buildActivityKey)
    const activityKey = idRef || `${type}_${displayName}_${index}`;

    const range: ActivityLineRange = { activityKey, displayName, type, startLine, endLine };
    keyToLines.set(activityKey, range); // Register key -> line range

    // Register line number -> key mapping
    for (let line = startLine; line <= endLine; line++) {
      lineToKey.set(line, activityKey);
    }
  }

  /**
   * Register an activity using an open tag popped from the stack
   */
  private static registerActivityFromStack(
    openTag: { tagName: string; startLine: number; attributes: Map<string, string> },
    endLine: number,
    counters: Map<string, number>,
    keyToLines: Map<string, ActivityLineRange>,
    lineToKey: Map<number, string>
  ): void {
    const idRef = openTag.attributes.get('sap2010:WorkflowViewState.IdRef'); // IdRef attribute
    const displayName = openTag.attributes.get('DisplayName') || openTag.tagName; // Display name
    const type = openTag.tagName; // Activity type

    // Count occurrences
    const counterKey = `${type}_${displayName}`;
    const index = counters.get(counterKey) || 0;
    counters.set(counterKey, index + 1);

    // Generate activity key
    const activityKey = idRef || `${type}_${displayName}_${index}`;

    const range: ActivityLineRange = {
      activityKey,
      displayName,
      type,
      startLine: openTag.startLine,
      endLine
    };
    keyToLines.set(activityKey, range); // Register key -> line range

    // Register line number -> key mapping
    for (let line = openTag.startLine; line <= endLine; line++) {
      lineToKey.set(line, activityKey);
    }
  }
}
