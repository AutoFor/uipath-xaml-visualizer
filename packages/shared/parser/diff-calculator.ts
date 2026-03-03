import { Activity } from './xaml-parser';

/**
 * Generate a stable unique key for an activity (shared by diff calculation and line mapping).
 * Uses IdRef (stable identifier) when available, falls back to a positional key otherwise.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#activity-key
 */
export function buildActivityKey(activity: Activity, index: number): string {
  const idRef = activity.properties['sap2010:WorkflowViewState.IdRef']; // IdRef attribute
  return idRef || `${activity.type}_${activity.displayName}_${index}`; // Fallback key
}

/**
 * Diff type enum
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#diff-types
 */
export enum DiffType {
  ADDED = 'added',                              // Added
  REMOVED = 'removed',                          // Removed
  MODIFIED = 'modified'                         // Modified
}

/**
 * Details of a property change
 */
export interface PropertyChange {
  propertyName: string;                         // Property name
  before: any;                                  // Value before change
  after: any;                                   // Value after change
}

/**
 * A diff entry for a single activity
 */
export interface DiffActivity {
  diffType: DiffType;                           // Type of diff
  activity: Activity;                           // The activity (after state)
  beforeActivity?: Activity;                    // Activity before change (for MODIFIED only)
  changes?: PropertyChange[];                   // List of property changes (for MODIFIED only)
}

/**
 * Result of a diff calculation
 */
export interface DiffResult {
  added: DiffActivity[];                        // Added activities
  removed: DiffActivity[];                      // Removed activities
  modified: DiffActivity[];                     // Modified activities
}

/**
 * Property prefixes excluded from diff calculation (UI layout metadata)
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#ignored-properties
 */
const IGNORED_PROPERTY_PREFIXES = [
  'sap:',          // UI layout metadata (HintSize, etc.)
  'sap2010:',      // ViewState-related metadata (WorkflowViewState.IdRef, etc.)
];

/**
 * Diff calculator class
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#diff-calculator
 */
export class DiffCalculator {
  /**
   * Calculate the diff between two Activity trees.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#diff-calculator
   */
  calculate(beforeData: any, afterData: any): DiffResult {
    const result: DiffResult = {
      added: [],
      removed: [],
      modified: []
    };

    // Recursively compare starting from the root activity
    this.compareActivities(
      beforeData.rootActivity,
      afterData.rootActivity,
      result
    );

    return result;
  }

  /**
   * Recursively compare two activities
   */
  private compareActivities(
    before: Activity,
    after: Activity,
    result: DiffResult
  ): void {
    // Convert child activities to maps (keyed by activity key)
    const beforeMap = this.buildActivityMap(before.children);
    const afterMap = this.buildActivityMap(after.children);

    // Detect added activities
    afterMap.forEach((activity, key) => {
      if (!beforeMap.has(key)) {
        result.added.push({
          diffType: DiffType.ADDED,
          activity
        });
      }
    });

    // Detect removed activities
    beforeMap.forEach((activity, key) => {
      if (!afterMap.has(key)) {
        result.removed.push({
          diffType: DiffType.REMOVED,
          activity
        });
      }
    });

    // Detect modified activities
    beforeMap.forEach((beforeActivity, key) => {
      const afterActivity = afterMap.get(key);
      if (afterActivity) {
        const changes = this.detectPropertyChanges(beforeActivity, afterActivity);

        if (changes.length > 0) {
          result.modified.push({
            diffType: DiffType.MODIFIED,
            activity: afterActivity,
            beforeActivity,
            changes
          });
        }

        // Recursively compare children
        this.compareActivities(beforeActivity, afterActivity, result);
      }
    });
  }

  /**
   * Convert an activity list to a map keyed by activity key
   */
  private buildActivityMap(activities: Activity[]): Map<string, Activity> {
    const map = new Map<string, Activity>();

    activities.forEach((activity, index) => {
      const key = buildActivityKey(activity, index);
      map.set(key, activity);
    });

    return map;
  }

  /**
   * Detect property changes between two activity versions
   */
  private detectPropertyChanges(
    before: Activity,
    after: Activity
  ): PropertyChange[] {
    const changes: PropertyChange[] = [];

    // Collect all property names from both versions
    const allPropertyNames = new Set([
      ...Object.keys(before.properties),
      ...Object.keys(after.properties)
    ]);

    // Compare each property (skip ignored prefixes)
    allPropertyNames.forEach(propName => {
      if (IGNORED_PROPERTY_PREFIXES.some(prefix => propName.startsWith(prefix))) return;
      const beforeValue = before.properties[propName];
      const afterValue = after.properties[propName];

      // Record as changed if values differ
      if (!this.areValuesEqual(beforeValue, afterValue)) {
        changes.push({
          propertyName: propName,
          before: beforeValue,
          after: afterValue
        });
      }
    });

    // Check DisplayName changes
    if (before.displayName !== after.displayName) {
      changes.push({
        propertyName: 'DisplayName',
        before: before.displayName,
        after: after.displayName
      });
    }

    // Check annotation changes
    if (before.annotations !== after.annotations) {
      changes.push({
        propertyName: 'Annotation',
        before: before.annotations,
        after: after.annotations
      });
    }

    // Check InformativeScreenshot changes
    if (before.informativeScreenshot !== after.informativeScreenshot) {
      changes.push({
        propertyName: 'InformativeScreenshot',
        before: before.informativeScreenshot,
        after: after.informativeScreenshot
      });
    }

    return changes;
  }

  /**
   * Determine if two values are equal
   */
  private areValuesEqual(value1: any, value2: any): boolean {
    // Treat undefined and null as equal
    if ((value1 === undefined || value1 === null) &&
        (value2 === undefined || value2 === null)) {
      return true;
    }

    // Compare primitive types directly
    if (typeof value1 !== 'object' && typeof value2 !== 'object') {
      return value1 === value2;
    }

    // For objects, compare as JSON strings (simple approach)
    try {
      return JSON.stringify(value1) === JSON.stringify(value2);
    } catch {
      return false;
    }
  }
}
