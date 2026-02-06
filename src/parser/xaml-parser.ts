/**
 * UiPath XAML パーサー
 * XAMLファイルをパースして構造化データに変換
 */

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

  /**
   * XAMLテキストをパースして構造化データに変換
   */
  parse(xamlText: string): ParsedXaml {
    // XMLをパース
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xamlText, 'text/xml');

    // パースエラーチェック
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XAML解析エラー: ' + parseError.textContent);
    }

    // ルート要素を取得
    const root = xmlDoc.documentElement;

    // 変数と引数を抽出
    const variables = this.extractVariables(root);
    const argumentsData = this.extractArguments(root);

    // ルートアクティビティをパース
    const rootActivity = this.parseActivity(root);

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

    // プロパティを抽出
    const properties = this.extractProperties(element);

    // InformativeScreenshot属性を取得
    const informativeScreenshot = element.getAttribute('InformativeScreenshot') || undefined;

    // アノテーションを取得
    const annotations = this.extractAnnotations(element);

    // 子アクティビティをパース
    const children = this.parseChildren(element);

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
   * プロパティを抽出
   */
  private extractProperties(element: Element): Record<string, any> {
    const properties: Record<string, any> = {};

    // 属性からプロパティを取得
    Array.from(element.attributes).forEach(attr => {
      if (attr.name !== 'DisplayName' && attr.name !== 'InformativeScreenshot') {
        properties[attr.name] = attr.value;
      }
    });

    // 子要素からプロパティを取得（Assign.To, Assign.Value等）
    Array.from(element.children).forEach(child => {
      const childName = child.localName;

      // プロパティ要素（タイプ名.プロパティ名形式）
      if (childName.includes('.')) {
        const [, propName] = childName.split('.');
        properties[propName] = this.extractPropertyValue(child);
      }
    });

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
    const children = Array.from(element.children);
    if (children.length === 1) {
      const child = children[0];
      // OutArgument, InArgument等の場合は中身を返す
      if (child.localName.includes('Argument')) {
        return child.textContent?.trim() || '';
      }
      // Selector等の複雑な構造の場合
      return this.elementToObject(child);
    }

    return null;
  }

  /**
   * 要素をオブジェクトに変換
   */
  private elementToObject(element: Element): any {
    const obj: any = {
      type: element.localName
    };

    // 属性を追加
    Array.from(element.attributes).forEach(attr => {
      obj[attr.name] = attr.value;
    });

    // 子要素を再帰的に処理
    const children = Array.from(element.children);
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

    Array.from(element.children).forEach(child => {
      const childName = child.localName;

      // プロパティ要素は除外（例: NApplicationCard.Body）
      if (childName.includes('.')) {
        // ただし、プロパティ要素の中身は再帰的に処理
        const nestedActivities = this.parseChildren(child);
        children.push(...nestedActivities);
        return;
      }

      // メタデータ要素を除外
      if (this.isMetadataElement(child)) {
        return;
      }

      // アクティビティとして解析
      if (this.isActivity(child)) {
        children.push(this.parseActivity(child));
      }
    });

    return children;
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
      'ActivityAction',
      'DelegateInArgument',
      'DelegateOutArgument',
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
      'Sequence', 'Flowchart', 'StateMachine', 'Assign', 'If', 'While',
      'ForEach', 'Switch', 'TryCatch', 'Click', 'TypeInto', 'GetText',
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

    // <Sequence.Variables> 等を探索
    const variableElements = root.querySelectorAll('[x\\:TypeArguments]');

    variableElements.forEach(elem => {
      const name = elem.getAttribute('Name');
      const type = elem.getAttribute('x:TypeArguments');
      const defaultValue = elem.querySelector('Default')?.textContent?.trim();

      if (name && type) {
        variables.push({
          name,
          type,
          default: defaultValue
        });
      }
    });

    return variables;
  }

  /**
   * 引数を抽出
   */
  private extractArguments(root: Element): Argument[] {
    const argumentsData: Argument[] = [];

    // <x:Property> 要素を探索
    const propertyElements = root.querySelectorAll('x\\:Property');

    propertyElements.forEach(elem => {
      const name = elem.getAttribute('Name');
      const type = elem.getAttribute('Type');

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
    });

    return argumentsData;
  }

  /**
   * アノテーションを抽出
   */
  private extractAnnotations(element: Element): string | undefined {
    const annotationElem = element.querySelector('sap\\:WorkflowViewStateService\\.ViewState > scg\\:Dictionary > x\\:String[x\\:Key="Annotation"]');
    return annotationElem?.textContent?.trim();
  }
}
