/**
 * UiPath XAML パーサー
 * XAMLファイルをパースして構造化データに変換
 */

import { DOMParser } from '@xmldom/xmldom'; // Node.js環境用のXMLパーサー

// ブラウザ環境ではfs/pathが存在しないため、条件付きでインポート
let fs: any = null; // ファイルシステム（Node.js環境のみ）
let path: any = null; // パス操作（Node.js環境のみ）
try {
  fs = require('fs'); // ブラウザ環境ではwebpack fallbackでfalseになる
  path = require('path'); // ブラウザ環境ではwebpack fallbackでfalseになる
} catch {
  // ブラウザ環境ではrequireが失敗するため無視
}

// UiPath固有の名前空間（将来の拡張用に定義）
// const UIPATH_NS = 'http://schemas.uipath.com/workflow/activities';
// const XAML_NS = 'http://schemas.microsoft.com/winfx/2006/xaml';
// const ACTIVITIES_NS = 'http://schemas.microsoft.com/netfx/2009/xaml/activities';

/**
 * アクティビティの型定義
 */
export interface Activity {
  id: string;                                   // 一意のID
  type: string;                                 // アクティビティタイプ（Sequence, Assign等）
  displayName: string;                          // 表示名
  namespace?: string;                           // 名前空間プレフィックス
  properties: Record<string, any>;              // プロパティの連想配列
  children: Activity[];                         // 子アクティビティ
  annotations?: string;                         // アノテーション
  informativeScreenshot?: string;               // スクリーンショットファイル名
}

/**
 * パース結果の型定義
 */
export interface ParsedXaml {
  rootActivity: Activity;                       // ルートアクティビティ
  variables: Variable[];                        // 変数リスト
  arguments: Argument[];                        // 引数リスト
}

/**
 * 変数の型定義
 */
export interface Variable {
  name: string;                                 // 変数名
  type: string;                                 // 型
  default?: string;                             // デフォルト値
}

/**
 * 引数の型定義
 */
export interface Argument {
  name: string;                                 // 引数名
  type: string;                                 // 型（In/Out/InOut）
  dataType: string;                             // データ型
}

/**
 * XAMLパーサークラス
 */
export class XamlParser {
  private activityIdCounter: number = 0;        // アクティビティID生成用カウンター
  private enableLogging: boolean = true;        // ログ出力フラグ
  private logFilePath: string;                  // ログファイルパス
  private logBuffer: string[] = [];             // ログバッファ

  private canWriteFile: boolean = false; // ファイル書き込みが可能かどうか

  constructor() {
    // ブラウザ環境チェック（fs/path/processが利用可能か判定）
    const isBrowser = typeof process === 'undefined'
      || !fs
      || typeof fs.existsSync !== 'function'
      || !path
      || typeof path.join !== 'function'; // ブラウザ環境判定

    if (isBrowser) {
      // ブラウザ環境ではファイルログを無効化
      this.logFilePath = '';
      this.canWriteFile = false;
      this.log('ブラウザ環境で実行中 - ファイルログ無効');
      return;
    }

    // Node.js環境ではファイルログを有効化
    this.canWriteFile = true;

    // ログファイルパスを設定（ユーザーのホームディレクトリ/.uipath-xaml-visualizer/logs）
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    const logDir = path.join(homeDir, '.uipath-xaml-visualizer', 'logs');

    // ログディレクトリを作成
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('ログディレクトリの作成に失敗:', error);
    }

    // ログファイル名（日時付き）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.logFilePath = path.join(logDir, `xaml-parser-${timestamp}.log`);

    this.log('ログファイル初期化', this.logFilePath);
  }

  /**
   * ログ出力メソッド
   */
  private log(message: string, ...args: any[]): void {
    if (this.enableLogging) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [XamlParser] ${message}`;
      const fullMessage = args.length > 0
        ? `${logMessage} ${JSON.stringify(args)}`
        : logMessage;

      // コンソールに出力
      console.log(fullMessage);

      // バッファに追加
      this.logBuffer.push(fullMessage);

      // バッファが100行を超えたらファイルに書き込み
      if (this.logBuffer.length >= 100) {
        this.flushLog();
      }
    }
  }

  /**
   * エラーログ出力メソッド
   */
  private logError(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [XamlParser ERROR] ${message}`;
    const fullMessage = error
      ? `${errorMessage}\n${error.stack || error}`
      : errorMessage;

    // コンソールに出力
    console.error(fullMessage);

    // バッファに追加
    this.logBuffer.push(fullMessage);

    // エラーは即座にファイルに書き込み
    this.flushLog();
  }

  /**
   * ログバッファをファイルに書き込み
   */
  private flushLog(): void {
    if (this.logBuffer.length === 0) return;

    // ブラウザ環境ではファイル書き込みをスキップ
    if (!this.canWriteFile) {
      this.logBuffer = []; // バッファをクリアするだけ
      return;
    }

    try {
      const logContent = this.logBuffer.join('\n') + '\n';
      fs.appendFileSync(this.logFilePath, logContent, 'utf8');
      this.logBuffer = [];
    } catch (error) {
      console.error('ログファイルへの書き込みに失敗:', error);
    }
  }

  /**
   * パース完了時にログをフラッシュ
   */
  private finalize(): void {
    this.flushLog();
    this.log('パース完了 - ログファイル:', this.logFilePath);
    this.flushLog(); // 最後のメッセージも確実に書き込み
  }

  /**
   * XAMLテキストをパースして構造化データに変換
   */
  parse(xamlText: string): ParsedXaml {
    this.log('パース開始', `XAML長: ${xamlText.length}文字`);

    // XMLをパース
    const parser = new DOMParser();
    this.log('DOMParser インスタンス作成完了');

    const xmlDoc = parser.parseFromString(xamlText, 'text/xml');
    this.log('XML パース完了');

    // パースエラーチェック（getElementsByTagNameを使用）
    const parseErrors = xmlDoc.getElementsByTagName('parsererror');
    if (parseErrors.length > 0) {
      const errorMsg = 'XAML解析エラー: ' + parseErrors[0].textContent;
      this.logError(errorMsg);
      throw new Error(errorMsg);
    }

    // ルート要素を取得
    const root = xmlDoc.documentElement;
    this.log('ルート要素取得', `タグ名: ${root.tagName}`);

    // 変数と引数を抽出
    this.log('変数抽出開始');
    const variables = this.extractVariables(root);
    this.log('変数抽出完了', `${variables.length}個の変数`);

    this.log('引数抽出開始');
    const argumentsData = this.extractArguments(root);
    this.log('引数抽出完了', `${argumentsData.length}個の引数`);

    // ルートアクティビティをパース
    this.log('ルートアクティビティのパース開始');
    const rootActivity = this.parseActivity(root);
    this.log('ルートアクティビティのパース完了', `ID: ${rootActivity.id}`);

    // ログをフラッシュ
    this.finalize();

    return {
      rootActivity,
      variables,
      arguments: argumentsData
    };
  }

  /**
   * アクティビティ要素をパース
   */
  private parseActivity(element: Element): Activity {
    const id = `activity-${this.activityIdCounter++}`;
    const type = element.localName;              // 要素名（Sequence, Assign等）
    const displayName = element.getAttribute('DisplayName') || type;
    const namespace = element.prefix || undefined;

    this.log(`アクティビティをパース: ${displayName} (type: ${type}, id: ${id})`);

    // プロパティを抽出
    const properties = this.extractProperties(element);
    this.log(`  プロパティ数: ${Object.keys(properties).length}`);

    // InformativeScreenshot属性を取得（要素自体 → TargetApp/TargetAnchorable の順で探索）
    const informativeScreenshot = element.getAttribute('InformativeScreenshot')
      || this.extractScreenshotFromTargetElements(element)  // ネストされたターゲット要素からも取得
      || undefined;
    if (informativeScreenshot) {
      this.log(`  スクリーンショット: ${informativeScreenshot}`);
    }

    // アノテーションを取得（属性からの取得を優先、なければ子要素から取得）
    const annotationAttr = element.getAttribute('sap2010:Annotation.AnnotationText');
    const annotationChild = this.extractAnnotations(element);
    const annotations = annotationAttr || annotationChild || undefined;
    if (annotations) {
      this.log(`  アノテーション: ${annotations.substring(0, 50)}...`);
    }

    // 子アクティビティをパース
    const children = this.parseChildren(element);
    this.log(`  子アクティビティ数: ${children.length}`);

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
   * TargetApp/TargetAnchorable要素からInformativeScreenshotを抽出
   */
  private extractScreenshotFromTargetElements(element: Element): string | null {
    const targetElementNames = ['TargetApp', 'TargetAnchorable', 'Target']; // スクリーンショットを持ちうる要素

    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType !== 1) continue;

      const child = node as Element;
      const childName = child.localName;
      if (!childName) continue;

      // プロパティ要素（例: NApplicationCard.TargetApp）の中を探索
      if (childName.includes('.')) {
        for (let j = 0; j < child.childNodes.length; j++) {
          const inner = child.childNodes[j];
          if (inner.nodeType !== 1) continue;

          const innerEl = inner as Element;
          if (targetElementNames.includes(innerEl.localName)) { // ターゲット要素を検出
            const screenshot = innerEl.getAttribute('InformativeScreenshot'); // スクリーンショット属性を取得
            if (screenshot) {
              this.log(`  ターゲット要素からスクリーンショット検出: ${screenshot}`);
              return screenshot;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * プロパティを抽出
   */
  private extractProperties(element: Element): Record<string, any> {
    const properties: Record<string, any> = {};

    this.log(`プロパティ抽出開始 - 要素: ${element.localName}`);

    // 属性からプロパティを取得
    if (element.attributes) {
      this.log(`  属性数: ${element.attributes.length}`);
      Array.from(element.attributes).forEach(attr => {
        if (attr.name !== 'DisplayName' && attr.name !== 'InformativeScreenshot'
            && attr.name !== 'sap2010:Annotation.AnnotationText') {
          properties[attr.name] = attr.value;
        }
      });
    } else {
      this.log(`  警告: attributes が undefined`);
    }

    // 子要素からプロパティを取得（Assign.To, Assign.Value等）
    if (element.childNodes) {
      let childElementCount = 0;
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType !== 1) continue; // Element nodeのみ処理
        childElementCount++;

        const childElem = child as Element;
        const childName = childElem.localName;

        // プロパティ要素（タイプ名.プロパティ名形式）
        if (childName && childName.includes('.')) {
          if (this.isMetadataElement(childElem)) continue; // メタデータ要素は除外
          const [, propName] = childName.split('.');
          // MultipleAssignのAssignOperationsは特殊処理（配列形式で抽出）
          if (propName === 'AssignOperations') {
            properties[propName] = this.extractAssignOperations(childElem);
          } else {
            properties[propName] = this.extractPropertyValue(childElem);
          }
        }
      }
      this.log(`  子要素数: ${childElementCount}`);
    } else {
      this.log(`  警告: childNodes が undefined`);
    }

    return properties;
  }

  /**
   * プロパティ値を抽出
   */
  private extractPropertyValue(element: Element): any {
    // テキストコンテンツがあればそれを返す
    if (element.textContent?.trim()) {
      return element.textContent.trim();
    }

    // 子要素があれば構造化して返す
    if (!element.childNodes) {
      return null;
    }

    // Element nodeのみ取得
    const children: Element[] = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        children.push(child as Element);
      }
    }

    if (children.length === 1) {
      const child = children[0];
      // OutArgument, InArgument等の場合は中身を返す
      if (child.localName && child.localName.includes('Argument')) {
        return child.textContent?.trim() || '';
      }
      // Selector等の複雑な構造の場合
      return this.elementToObject(child);
    }

    return null;
  }

  /**
   * MultipleAssignのAssignOperationsを抽出（配列形式）
   */
  private extractAssignOperations(element: Element): Array<{ To: string; Value: string }> {
    const operations: Array<{ To: string; Value: string }> = []; // 代入操作のリスト
    this.findAssignOperations(element, operations); // 再帰的にAssignOperation要素を探索
    this.log(`  AssignOperations抽出: ${operations.length}個`);
    return operations;
  }

  /**
   * AssignOperation要素を再帰的に探索（scg:List等のラッパーを貫通）
   */
  private findAssignOperations(element: Element, operations: Array<{ To: string; Value: string }>): void {
    if (!element.childNodes) return; // 子要素がなければ終了

    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType !== 1) continue; // Element nodeのみ処理

      const childElem = child as Element;
      const name = childElem.localName;

      if (name === 'AssignOperation') {
        // AssignOperationのTo/Valueプロパティを抽出
        const props = this.extractProperties(childElem); // 既存のプロパティ抽出を再利用
        operations.push({
          To: props['To'] || '', // 代入先（左辺）
          Value: props['Value'] || '' // 代入値（右辺）
        });
      } else {
        // scg:List等のラッパーは再帰的に探索
        this.findAssignOperations(childElem, operations);
      }
    }
  }

  /**
   * 要素をオブジェクトに変換
   */
  private elementToObject(element: Element): any {
    const obj: any = {
      type: element.localName
    };

    // 属性を追加
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        obj[attr.name] = attr.value;
      });
    }

    // 子要素を再帰的に処理
    if (!element.childNodes) {
      if (element.textContent?.trim()) {
        obj.value = element.textContent.trim();
      }
      return obj;
    }

    // Element nodeのみ取得
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
   * 子アクティビティをパース
   */
  private parseChildren(element: Element): Activity[] {
    const children: Activity[] = [];

    if (!element.childNodes) {
      this.log(`子要素なし（childNodes が undefined）`);
      return children;
    }

    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType !== 1) continue; // Element nodeのみ処理

      const child = node as Element;
      const childName = child.localName;

      if (!childName) continue;

      // プロパティ要素は除外（例: NApplicationCard.Body）
      if (childName.includes('.')) {
        // ただし、プロパティ要素の中身は再帰的に処理
        const nestedActivities = this.parseChildren(child);
        children.push(...nestedActivities);
        continue;
      }

      // ActivityActionなどのラッパー要素は、中身を再帰的に処理
      if (this.isWrapperElement(child)) {
        const nestedActivities = this.parseChildren(child);
        children.push(...nestedActivities);
        continue;
      }

      // メタデータ要素を除外
      if (this.isMetadataElement(child)) {
        continue;
      }

      // アクティビティとして解析
      if (this.isActivity(child)) {
        children.push(this.parseActivity(child));
      }
    }

    return children;
  }

  /**
   * ラッパー要素かどうかを判定（アクティビティではないが、中身を処理する必要がある要素）
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
   * メタデータ要素かどうかを判定（アクティビティではない要素）
   */
  private isMetadataElement(element: Element): boolean {
    const name = element.localName;

    // メタデータ要素のリスト
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
      'AssignOperation', // MultipleAssign内の代入操作（プロパティとして処理済み）
      'TargetApp',
      'TargetAnchorable',
      'Target'
    ];

    // プレフィックスでチェック（sap:, scg:, x: など）
    const prefix = element.prefix;
    if (prefix === 'sap' || prefix === 'sap2010' || prefix === 'scg' || prefix === 'sco' || prefix === 'x') {
      return true;
    }

    return metadataTypes.includes(name);
  }

  /**
   * アクティビティ要素かどうかを判定
   */
  private isActivity(element: Element): boolean {
    const name = element.localName;

    // よくあるアクティビティタイプ（基本）
    const activityTypes = [
      'Activity', 'Sequence', 'Flowchart', 'StateMachine', 'Assign', 'MultipleAssign',
      'If', 'While', 'ForEach', 'Switch', 'TryCatch', 'Click', 'TypeInto', 'GetText',
      'LogMessage', 'WriteLine', 'InvokeWorkflowFile', 'Delay',
      // UiPath UIAutomation Next アクティビティ
      'NApplicationCard', 'NClick', 'NTypeInto', 'NGetText', 'NHover',
      'NKeyboardShortcut', 'NDoubleClick', 'NRightClick', 'NCheck',
      'NSelect', 'NAttach', 'NWaitElement', 'NFindElement',
      // その他のよくあるUiPathアクティビティ
      'OpenBrowser', 'CloseBrowser', 'NavigateTo', 'AttachBrowser',
      'ReadRange', 'WriteRange', 'AddDataRow', 'BuildDataTable',
      'ForEachRow', 'ExcelApplicationScope', 'UseExcelFile'
    ];

    // リストにあればアクティビティ
    if (activityTypes.includes(name)) {
      return true;
    }

    // メタデータ要素でなければアクティビティとして扱う
    return !this.isMetadataElement(element);
  }

  /**
   * 変数を抽出
   */
  private extractVariables(root: Element): Variable[] {
    const variables: Variable[] = [];

    // 全要素を再帰的に探索してx:TypeArguments属性を持つ要素を探す
    this.findVariableElements(root, variables);

    return variables;
  }

  /**
   * 変数要素を再帰的に探索
   */
  private findVariableElements(element: Element, variables: Variable[]): void {
    // x:TypeArguments属性を持つ要素を探す
    if (element.hasAttribute('x:TypeArguments')) {
      const name = element.getAttribute('Name');
      const type = element.getAttribute('x:TypeArguments');

      // Default子要素を探す
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

    // 子要素を再帰的に探索
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) { // Element node
        this.findVariableElements(child as Element, variables);
      }
    }
  }

  /**
   * 引数を抽出
   */
  private extractArguments(root: Element): Argument[] {
    const argumentsData: Argument[] = [];

    // x:Property要素を再帰的に探索
    this.findPropertyElements(root, argumentsData);

    return argumentsData;
  }

  /**
   * x:Property要素を再帰的に探索
   */
  private findPropertyElements(element: Element, argumentsData: Argument[]): void {
    // x:Property要素を探す
    if (element.localName === 'Property' && element.namespaceURI?.includes('winfx/2006/xaml')) {
      const name = element.getAttribute('Name');
      const type = element.getAttribute('Type');

      if (name && type) {
        // Type属性から方向とデータ型を抽出（例: InArgument(x:String)）
        const match = type.match(/(In|Out|InOut)Argument\((.+)\)/);
        if (match) {
          argumentsData.push({
            name,
            type: match[1],            // In/Out/InOut
            dataType: match[2]         // データ型
          });
        }
      }
    }

    // 子要素を再帰的に探索
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) { // Element node
        this.findPropertyElements(child as Element, argumentsData);
      }
    }
  }

  /**
   * アノテーションを抽出
   */
  private extractAnnotations(element: Element): string | undefined {
    // WorkflowViewStateService.ViewState を探す
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        const childElem = child as Element;
        if (childElem.localName === 'WorkflowViewStateService.ViewState' ||
            childElem.localName === 'WorkflowViewStateService') {
          // Dictionary を探す
          for (let j = 0; j < childElem.childNodes.length; j++) {
            const dictChild = childElem.childNodes[j];
            if (dictChild.nodeType === 1) {
              const dictElem = dictChild as Element;
              if (dictElem.localName === 'Dictionary') {
                // x:Key="Annotation" を持つString要素を探す
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
