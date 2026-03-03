/**
 * UiPath XAML Parser
 * Parses XAML files and converts them to structured data.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#xaml-parser
 */

import { DOMParser } from '@xmldom/xmldom'; // XML parser for Node.js environment

// Conditionally import fs/path because they do not exist in browser environments
let fs: any = null; // File system (Node.js only)
let path: any = null; // Path utilities (Node.js only)
try {
  fs = require('fs'); // Falls back to false via webpack fallback in browser
  path = require('path'); // Falls back to false via webpack fallback in browser
} catch {
  // Silently ignore: require() fails in browser environments
}

// UiPath-specific namespaces (defined for future extensibility)
// const UIPATH_NS = 'http://schemas.uipath.com/workflow/activities';
// const XAML_NS = 'http://schemas.microsoft.com/winfx/2006/xaml';
// const ACTIVITIES_NS = 'http://schemas.microsoft.com/netfx/2009/xaml/activities';

/**
 * Activity type definition
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#key-types
 */
export interface Activity {
  id: string;                                   // Unique ID
  type: string;                                 // Activity type (Sequence, Assign, etc.)
  displayName: string;                          // Display name
  namespace?: string;                           // Namespace prefix
  properties: Record<string, any>;              // Properties map
  children: Activity[];                         // Child activities
  annotations?: string;                         // Annotation text
  informativeScreenshot?: string;               // Screenshot filename
}

/**
 * Parse result type definition
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#key-types
 */
export interface ParsedXaml {
  rootActivity: Activity;                       // Root activity
  variables: Variable[];                        // Variable list
  arguments: Argument[];                        // Argument list
}

/**
 * Variable type definition
 */
export interface Variable {
  name: string;                                 // Variable name
  type: string;                                 // Type
  default?: string;                             // Default value
}

/**
 * Argument type definition
 */
export interface Argument {
  name: string;                                 // Argument name
  type: string;                                 // Direction (In/Out/InOut)
  dataType: string;                             // Data type
}

/**
 * XAML Parser class
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#xaml-parser
 */
export class XamlParser {
  private activityIdCounter: number = 0;        // Counter for generating unique activity IDs
  private enableLogging: boolean = true;        // Log output flag
  private logFilePath: string;                  // Log file path
  private logBuffer: string[] = [];             // Log buffer

  private canWriteFile: boolean = false; // Whether file writing is available

  constructor() {
    // Detect browser environment (check if fs/path/process are available)
    const isBrowser = typeof process === 'undefined'
      || !fs
      || typeof fs.existsSync !== 'function'
      || !path
      || typeof path.join !== 'function';

    if (isBrowser) {
      // Disable file logging in browser environments
      this.logFilePath = '';
      this.canWriteFile = false;
      this.log('Running in browser environment - file logging disabled');
      return;
    }

    // Enable file logging in Node.js environments
    this.canWriteFile = true;

    // Set log file path (~/.uipath-xaml-visualizer/logs)
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    const logDir = path.join(homeDir, '.uipath-xaml-visualizer', 'logs');

    // Create log directory if it does not exist
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }

    // Log filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.logFilePath = path.join(logDir, `xaml-parser-${timestamp}.log`);

    this.log('Log file initialized', this.logFilePath);
  }

  /**
   * Log output method
   */
  private log(message: string, ...args: any[]): void {
    if (this.enableLogging) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [XamlParser] ${message}`;
      const fullMessage = args.length > 0
        ? `${logMessage} ${JSON.stringify(args)}`
        : logMessage;

      // Output to console
      console.log(fullMessage);

      // Add to buffer
      this.logBuffer.push(fullMessage);

      // Flush to file when buffer exceeds 100 lines
      if (this.logBuffer.length >= 100) {
        this.flushLog();
      }
    }
  }

  /**
   * Error log output method
   */
  private logError(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [XamlParser ERROR] ${message}`;
    const fullMessage = error
      ? `${errorMessage}\n${error.stack || error}`
      : errorMessage;

    // Output to console
    console.error(fullMessage);

    // Add to buffer
    this.logBuffer.push(fullMessage);

    // Flush immediately on error
    this.flushLog();
  }

  /**
   * Flush log buffer to file
   */
  private flushLog(): void {
    if (this.logBuffer.length === 0) return;

    // Skip file writing in browser environments
    if (!this.canWriteFile) {
      this.logBuffer = []; // Just clear the buffer
      return;
    }

    try {
      const logContent = this.logBuffer.join('\n') + '\n';
      fs.appendFileSync(this.logFilePath, logContent, 'utf8');
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Finalize: flush log on parse completion
   */
  private finalize(): void {
    this.flushLog();
    this.log('Parse complete - log file:', this.logFilePath);
    this.flushLog(); // Ensure the final message is written
  }

  /**
   * Parse XAML text into structured data.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#processing-flow
   */
  parse(xamlText: string): ParsedXaml {
    this.log('Parse started', `XAML length: ${xamlText.length} chars`);

    // Parse XML
    const parser = new DOMParser();
    this.log('DOMParser instance created');

    const xmlDoc = parser.parseFromString(xamlText, 'text/xml');
    this.log('XML parsed');

    // Check for parse errors via <parsererror>
    const parseErrors = xmlDoc.getElementsByTagName('parsererror');
    if (parseErrors.length > 0) {
      const errorMsg = 'XAML parse error: ' + parseErrors[0].textContent;
      this.logError(errorMsg);
      throw new Error(errorMsg);
    }

    // Get root element
    const root = xmlDoc.documentElement;
    this.log('Root element retrieved', `tag: ${root.tagName}`);

    // Extract variables and arguments
    this.log('Extracting variables');
    const variables = this.extractVariables(root);
    this.log('Variables extracted', `${variables.length} variables`);

    this.log('Extracting arguments');
    const argumentsData = this.extractArguments(root);
    this.log('Arguments extracted', `${argumentsData.length} arguments`);

    // Parse root activity
    this.log('Parsing root activity');
    const rootActivity = this.parseActivity(root);
    this.log('Root activity parsed', `ID: ${rootActivity.id}`);

    // Flush log
    this.finalize();

    return {
      rootActivity,
      variables,
      arguments: argumentsData
    };
  }

  /**
   * Parse an activity element.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#element-classification
   */
  private parseActivity(element: Element): Activity {
    const id = `activity-${this.activityIdCounter++}`;
    const type = element.localName;              // Element name (Sequence, Assign, etc.)
    const displayName = element.getAttribute('DisplayName') || type;
    const namespace = element.prefix || undefined;

    this.log(`Parsing activity: ${displayName} (type: ${type}, id: ${id})`);

    // Extract properties
    const properties = this.extractProperties(element);
    this.log(`  Properties count: ${Object.keys(properties).length}`);

    // Get InformativeScreenshot attribute (from element itself, then TargetApp/TargetAnchorable)
    const informativeScreenshot = element.getAttribute('InformativeScreenshot')
      || this.extractScreenshotFromTargetElements(element)  // Also search nested target elements
      || undefined;
    if (informativeScreenshot) {
      this.log(`  Screenshot: ${informativeScreenshot}`);
    }

    // Get annotation (attribute takes priority, then child element)
    const annotationAttr = element.getAttribute('sap2010:Annotation.AnnotationText');
    const annotationChild = this.extractAnnotations(element);
    const annotations = annotationAttr || annotationChild || undefined;
    if (annotations) {
      this.log(`  Annotation: ${annotations.substring(0, 50)}...`);
    }

    // Parse child activities
    const children = this.parseChildren(element);
    this.log(`  Children count: ${children.length}`);

    return {
      id,
      type,
      displayName,
      namespace,
      properties,
      children,
      annotations,
      informativeScreenshot
    };
  }

  /**
   * Extract InformativeScreenshot from TargetApp/TargetAnchorable/Target elements
   */
  private extractScreenshotFromTargetElements(element: Element): string | null {
    const targetElementNames = ['TargetApp', 'TargetAnchorable', 'Target']; // Elements that may carry screenshots

    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType !== 1) continue;

      const child = node as Element;
      const childName = child.localName;
      if (!childName) continue;

      // Search inside property elements (e.g., NApplicationCard.TargetApp)
      if (childName.includes('.')) {
        for (let j = 0; j < child.childNodes.length; j++) {
          const inner = child.childNodes[j];
          if (inner.nodeType !== 1) continue;

          const innerEl = inner as Element;
          if (targetElementNames.includes(innerEl.localName)) { // Found a target element
            const screenshot = innerEl.getAttribute('InformativeScreenshot');
            if (screenshot) {
              this.log(`  Screenshot found in target element: ${screenshot}`);
              return screenshot;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract properties from an element
   */
  private extractProperties(element: Element): Record<string, any> {
    const properties: Record<string, any> = {};

    this.log(`Extracting properties - element: ${element.localName}`);

    // Get properties from attributes
    if (element.attributes) {
      this.log(`  Attribute count: ${element.attributes.length}`);
      Array.from(element.attributes).forEach(attr => {
        if (attr.name !== 'DisplayName' && attr.name !== 'InformativeScreenshot'
            && attr.name !== 'sap2010:Annotation.AnnotationText') {
          properties[attr.name] = attr.value;
        }
      });
    } else {
      this.log(`  Warning: attributes is undefined`);
    }

    // Get properties from child elements (Assign.To, Assign.Value, etc.)
    if (element.childNodes) {
      let childElementCount = 0;
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType !== 1) continue; // Element nodes only
        childElementCount++;

        const childElem = child as Element;
        const childName = childElem.localName;

        // Property elements (TypeName.PropertyName format)
        if (childName && childName.includes('.')) {
          if (this.isMetadataElement(childElem)) continue; // Skip metadata elements
          const [, propName] = childName.split('.');
          // AssignOperations in MultipleAssign requires special array extraction
          if (propName === 'AssignOperations') {
            properties[propName] = this.extractAssignOperations(childElem);
          } else {
            properties[propName] = this.extractPropertyValue(childElem);
          }
        }
      }
      this.log(`  Child element count: ${childElementCount}`);
    } else {
      this.log(`  Warning: childNodes is undefined`);
    }

    return properties;
  }

  /**
   * Extract a property value from an element
   */
  private extractPropertyValue(element: Element): any {
    // Return text content if present
    if (element.textContent?.trim()) {
      return element.textContent.trim();
    }

    // Return structured data if child elements exist
    if (!element.childNodes) {
      return null;
    }

    // Get Element nodes only
    const children: Element[] = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        children.push(child as Element);
      }
    }

    if (children.length === 1) {
      const child = children[0];
      // For OutArgument, InArgument, etc., return the inner content
      if (child.localName && child.localName.includes('Argument')) {
        return child.textContent?.trim() || '';
      }
      // For complex structures like Selector
      return this.elementToObject(child);
    }

    return null;
  }

  /**
   * Extract AssignOperations from MultipleAssign as an array
   */
  private extractAssignOperations(element: Element): Array<{ To: string; Value: string }> {
    const operations: Array<{ To: string; Value: string }> = []; // List of assignment operations
    this.findAssignOperations(element, operations); // Recursively search for AssignOperation elements
    this.log(`  AssignOperations extracted: ${operations.length}`);
    return operations;
  }

  /**
   * Recursively search for AssignOperation elements (traverses wrappers like scg:List)
   */
  private findAssignOperations(element: Element, operations: Array<{ To: string; Value: string }>): void {
    if (!element.childNodes) return; // No children

    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType !== 1) continue; // Element nodes only

      const childElem = child as Element;
      const name = childElem.localName;

      if (name === 'AssignOperation') {
        // Extract To/Value properties from AssignOperation
        const props = this.extractProperties(childElem); // Reuse existing property extraction
        operations.push({
          To: props['To'] || '', // Left-hand side of assignment
          Value: props['Value'] || '' // Right-hand side of assignment
        });
      } else {
        // Recursively search through wrappers like scg:List
        this.findAssignOperations(childElem, operations);
      }
    }
  }

  /**
   * Convert an element to a plain object
   */
  private elementToObject(element: Element): any {
    const obj: any = {
      type: element.localName
    };

    // Add attributes
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        obj[attr.name] = attr.value;
      });
    }

    // Recursively process child elements
    if (!element.childNodes) {
      if (element.textContent?.trim()) {
        obj.value = element.textContent.trim();
      }
      return obj;
    }

    // Get Element nodes only
    const children: Element[] = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        children.push(child as Element);
      }
    }

    if (children.length > 0) {
      obj.children = children.map(child => this.elementToObject(child));
    } else if (element.textContent?.trim()) {
      obj.value = element.textContent.trim();
    }

    return obj;
  }

  /**
   * Parse child activities of an element
   */
  private parseChildren(element: Element): Activity[] {
    const children: Activity[] = [];

    if (!element.childNodes) {
      this.log(`No children (childNodes is undefined)`);
      return children;
    }

    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType !== 1) continue; // Element nodes only

      const child = node as Element;
      const childName = child.localName;

      if (!childName) continue;

      // Skip property elements (e.g., NApplicationCard.Body) but recurse into their contents
      if (childName.includes('.')) {
        const nestedActivities = this.parseChildren(child);
        children.push(...nestedActivities);
        continue;
      }

      // Wrapper elements (ActivityAction, etc.) are transparent: recurse into their contents
      if (this.isWrapperElement(child)) {
        const nestedActivities = this.parseChildren(child);
        children.push(...nestedActivities);
        continue;
      }

      // Skip metadata elements
      if (this.isMetadataElement(child)) {
        continue;
      }

      // Parse as an activity
      if (this.isActivity(child)) {
        children.push(this.parseActivity(child));
      }
    }

    return children;
  }

  /**
   * Determines if an element is a wrapper (not an activity, but its contents should be processed).
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#element-classification
   */
  private isWrapperElement(element: Element): boolean {
    const name = element.localName;
    const wrapperTypes = [
      'ActivityAction',
      'ActivityAction.Argument'
    ];
    return wrapperTypes.includes(name);
  }

  /**
   * Determines if an element is a metadata element (not an activity).
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#element-classification
   */
  private isMetadataElement(element: Element): boolean {
    const name = element.localName;

    // List of metadata element types
    const metadataTypes = [
      'WorkflowViewStateService.ViewState',
      'Dictionary',
      'Boolean',
      'String',
      'Property',
      'Variable',
      'InArgument',
      'OutArgument',
      'InOutArgument',
      'DelegateInArgument',
      'DelegateOutArgument',
      'AssignOperation', // Assignment operation inside MultipleAssign (already processed as property)
      'TargetApp',
      'TargetAnchorable',
      'Target',
      'VerifyExecutionOptions' // Verify options in NClick etc. (already processed as property)
    ];

    // Check by namespace prefix (sap:, scg:, x:, etc.)
    const prefix = element.prefix;
    if (prefix === 'sap' || prefix === 'sap2010' || prefix === 'scg' || prefix === 'sco' || prefix === 'x') {
      return true;
    }

    return metadataTypes.includes(name);
  }

  /**
   * Determines if an element is an activity element.
   * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/Parser#element-classification
   */
  private isActivity(element: Element): boolean {
    const name = element.localName;

    // Common activity types (basic)
    const activityTypes = [
      'Activity', 'Sequence', 'Flowchart', 'StateMachine', 'Assign', 'MultipleAssign',
      'If', 'While', 'ForEach', 'Switch', 'TryCatch', 'Click', 'TypeInto', 'GetText',
      'LogMessage', 'WriteLine', 'InvokeWorkflowFile', 'Delay',
      // UiPath UIAutomation Next activities
      'NApplicationCard', 'NClick', 'NTypeInto', 'NGetText', 'NHover',
      'NKeyboardShortcut', 'NDoubleClick', 'NRightClick', 'NCheck',
      'NSelect', 'NAttach', 'NWaitElement', 'NFindElement',
      // Other common UiPath activities
      'OpenBrowser', 'CloseBrowser', 'NavigateTo', 'AttachBrowser',
      'ReadRange', 'WriteRange', 'AddDataRow', 'BuildDataTable',
      'ForEachRow', 'ExcelApplicationScope', 'UseExcelFile'
    ];

    // Return true if in the known activity list
    if (activityTypes.includes(name)) {
      return true;
    }

    // Treat as activity if it is not a metadata element
    return !this.isMetadataElement(element);
  }

  /**
   * Extract variables from the root element
   */
  private extractVariables(root: Element): Variable[] {
    const variables: Variable[] = [];

    // Recursively search all elements for those with x:TypeArguments attribute
    this.findVariableElements(root, variables);

    return variables;
  }

  /**
   * Recursively search for variable elements
   */
  private findVariableElements(element: Element, variables: Variable[]): void {
    // Look for elements with x:TypeArguments attribute
    if (element.hasAttribute('x:TypeArguments')) {
      const name = element.getAttribute('Name');
      const type = element.getAttribute('x:TypeArguments');

      // Search for Default child element
      let defaultValue: string | undefined;
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === 1 && (child as Element).localName === 'Default') {
          defaultValue = child.textContent?.trim();
          break;
        }
      }

      if (name && type) {
        variables.push({
          name,
          type,
          default: defaultValue
        });
      }
    }

    // Recurse into child elements
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) { // Element node
        this.findVariableElements(child as Element, variables);
      }
    }
  }

  /**
   * Extract arguments from the root element
   */
  private extractArguments(root: Element): Argument[] {
    const argumentsData: Argument[] = [];

    // Recursively search for x:Property elements
    this.findPropertyElements(root, argumentsData);

    return argumentsData;
  }

  /**
   * Recursively search for x:Property elements
   */
  private findPropertyElements(element: Element, argumentsData: Argument[]): void {
    // Look for x:Property elements
    if (element.localName === 'Property' && element.namespaceURI?.includes('winfx/2006/xaml')) {
      const name = element.getAttribute('Name');
      const type = element.getAttribute('Type');

      if (name && type) {
        // Extract direction and data type from Type attribute (e.g., InArgument(x:String))
        const match = type.match(/(In|Out|InOut)Argument\((.+)\)/);
        if (match) {
          argumentsData.push({
            name,
            type: match[1],            // In/Out/InOut
            dataType: match[2]         // Data type
          });
        }
      }
    }

    // Recurse into child elements
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) { // Element node
        this.findPropertyElements(child as Element, argumentsData);
      }
    }
  }

  /**
   * Extract annotation text from an element
   */
  private extractAnnotations(element: Element): string | undefined {
    // Search for WorkflowViewStateService.ViewState
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        const childElem = child as Element;
        if (childElem.localName === 'WorkflowViewStateService.ViewState' ||
            childElem.localName === 'WorkflowViewStateService') {
          // Search for Dictionary
          for (let j = 0; j < childElem.childNodes.length; j++) {
            const dictChild = childElem.childNodes[j];
            if (dictChild.nodeType === 1) {
              const dictElem = dictChild as Element;
              if (dictElem.localName === 'Dictionary') {
                // Search for String element with x:Key="Annotation"
                for (let k = 0; k < dictElem.childNodes.length; k++) {
                  const strChild = dictElem.childNodes[k];
                  if (strChild.nodeType === 1) {
                    const strElem = strChild as Element;
                    if (strElem.localName === 'String' && strElem.getAttribute('x:Key') === 'Annotation') {
                      return strElem.textContent?.trim();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return undefined;
  }
}
