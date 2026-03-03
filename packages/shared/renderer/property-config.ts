// === Property Configuration Module ===
// Defines main properties, sub-properties, and hidden properties per activity type.
// @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#property-config

import { t } from '../i18n/i18n'; // UI string translation

// === Type Definitions ===

/** Property group (UiPath Studio-style category) */
export interface PropertyGroup {
  label: () => string; // Group label (function for i18n support)
  properties: string[]; // Property names belonging to this group
}

/** Per-activity property configuration */
export interface ActivityPropertyConfig {
  mainProperties: string[]; // Properties shown in the main card area
  subGroups: PropertyGroup[]; // Groups inside the sub-panel
}

// === Hidden Property Detection ===

/** Metadata prefixes (XAML attributes that should not be displayed) */
const HIDDEN_PREFIXES = [
  'sap:', // System.Activities.Presentation namespace
  'sap2010:', // System.Activities.Presentation 2010 namespace
  'xmlns', // XML namespace declarations
  'mc:', // Markup Compatibility namespace
  'mva:', // Microsoft.VisualBasic.Activities namespace
];

/**
 * Determines if a property is a metadata property that should be hidden.
 * Returns true for sap:*, sap2010:*, xmlns*, etc.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function isHiddenProperty(name: string): boolean {
  return HIDDEN_PREFIXES.some(prefix => name.startsWith(prefix));
}

// === Per-Activity Property Configuration ===

/** Default important properties shown in the main area */
const DEFAULT_MAIN_PROPERTIES = ['To', 'Value', 'Condition', 'Selector', 'Message'];

/** Per-activity configuration map */
const ACTIVITY_CONFIGS: Record<string, ActivityPropertyConfig> = {
  'NApplicationCard': { // Modern application card
    mainProperties: ['TargetApp'], // Main: URL (special rendering)
    subGroups: [
      { label: () => t('Target'), properties: ['Selector', 'ObjectRepository'] }, // Target group: selector, repo status
      { label: () => t('Input'), properties: ['AttachMode'] }, // Input group
      { label: () => t('Options'), properties: ['InteractionMode', 'HealingAgentBehavior'] }, // Options group
    ],
  },
  'NClick': { // Modern click
    mainProperties: ['Target'], // Main: target
    subGroups: [ // Groups following UiPath Studio's property panel layout
      { label: () => t('Target'), properties: ['FullSelectorArgument', 'FuzzySelectorArgument', 'ObjectRepository'] },
      { label: () => t('Input'), properties: ['ClickType', 'CursorMotionType', 'MouseButton'] },
      { label: () => t('Options'), properties: ['ActivateBefore', 'AlterDisabledElement', 'InteractionMode', 'KeyModifiers'] },
    ],
  },
  'NTypeInto': { // Modern type into
    mainProperties: ['Target', 'Text'], // Main: target, text
    subGroups: [
      { label: () => t('Input'), properties: ['ClickType', 'MouseButton', 'KeyModifiers'] },
      { label: () => t('Options'), properties: ['ActivateBefore', 'InteractionMode', 'EmptyField', 'DelayBetweenKeys', 'DelayBefore', 'DelayAfter'] },
    ],
  },
  'NGetText': { // Modern get text
    mainProperties: ['Target', 'Value'], // Main: target, value
    subGroups: [
      { label: () => t('Options'), properties: ['ActivateBefore', 'InteractionMode'] },
    ],
  },
};

/**
 * Returns the property configuration for the given activity type.
 * Returns the default configuration (no groups) for unregistered activities.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function getActivityPropertyConfig(type: string): ActivityPropertyConfig {
  return ACTIVITY_CONFIGS[type] || {
    mainProperties: DEFAULT_MAIN_PROPERTIES,
    subGroups: [],
  };
}

/**
 * Extracts sub-panel properties.
 * Returns properties that are neither main properties nor hidden metadata.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function getSubProperties(
  properties: Record<string, any>,
  activityType: string
): Record<string, any> {
  const config = getActivityPropertyConfig(activityType);
  const mainSet = new Set(config.mainProperties); // Fast lookup set for main properties
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (mainSet.has(key)) continue; // Skip main properties
    if (isHiddenProperty(key)) continue; // Skip metadata
    if (key === 'DisplayName') continue; // Already shown in the card header
    if (key === 'AssignOperations') continue; // Handled by MultipleAssign dedicated rendering
    if (key === 'ScopeGuid' || key === 'ScopeIdentifier') continue; // Internal IDs (not useful to display)
    if (key === 'Version') continue; // Internal version (not useful to display)
    if (key === 'Body') continue; // Activity container (rendered as child elements)
    if (key === 'VerifyOptions') continue; // Composite object (verbose when expanded)
    result[key] = value;
  }

  return result;
}

/**
 * Determines if an activity should have a sub-panel.
 * Assign and MultipleAssign use dedicated rendering and do not need a sub-panel.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function hasSubPanel(activityType: string): boolean {
  if (activityType === 'Assign') return false; // Dedicated rendering
  if (activityType === 'MultipleAssign') return false; // Dedicated rendering
  return true;
}

/**
 * Determines if an activity has defined rendering (registered in ACTIVITY_CONFIGS or has dedicated rendering).
 * Undefined activities have their properties and sub-panel completely hidden.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function isDefinedActivity(type: string): boolean {
  if (type === 'Assign') return true; // Has dedicated rendering
  if (type === 'MultipleAssign') return true; // Has dedicated rendering
  if (type === 'LogMessage') return true; // Has dedicated rendering
  if (type in ACTIVITY_CONFIGS) return true; // Registered in ACTIVITY_CONFIGS
  if (type.startsWith('N')) return true; // N-prefix modern activities have dedicated rendering
  return false;
}

/**
 * Categorizes diff changes into main and sub for the diff renderer.
 * Only applies categorization to activities registered in ACTIVITY_CONFIGS.
 * Unregistered activities keep all changes in main (legacy behavior).
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Renderer#key-functions
 */
export function categorizeDiffChanges<T extends { propertyName: string; before?: any; after?: any }>(
  changes: T[],
  activityType: string
): { main: T[]; sub: T[] } {
  if (!(activityType in ACTIVITY_CONFIGS)) {
    return { main: changes, sub: [] }; // All to main for unregistered activities
  }
  const config = ACTIVITY_CONFIGS[activityType];
  const mainSet = new Set(config.mainProperties);
  const main: T[] = [];
  const sub: T[] = [];
  for (const change of changes) {
    if (!mainSet.has(change.propertyName)) {
      sub.push(change); // Non-main properties go to sub
      continue;
    }
    // Object-typed main properties are moved to sub to avoid excessive noise when expanded
    const b = change.before;
    const a = change.after;
    if (typeof b === 'object' && b !== null && typeof a === 'object' && a !== null
      && !Array.isArray(b) && !Array.isArray(a)) {
      sub.push(change); // Move object-typed changes to sub
    } else {
      main.push(change); // Flat changes stay in main
    }
  }
  return { main, sub };
}
