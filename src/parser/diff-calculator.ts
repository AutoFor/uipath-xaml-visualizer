import { Activity } from './xaml-parser';

/**
 * 差分の種類
 */
export enum DiffType {
  ADDED = 'added',                              // 追加
  REMOVED = 'removed',                          // 削除
  MODIFIED = 'modified'                         // 変更
}

/**
 * プロパティ変更の詳細
 */
export interface PropertyChange {
  propertyName: string;                         // プロパティ名
  before: any;                                  // 変更前の値
  after: any;                                   // 変更後の値
}

/**
 * 差分アクティビティ
 */
export interface DiffActivity {
  diffType: DiffType;                           // 差分の種類
  activity: Activity;                           // アクティビティ本体
  beforeActivity?: Activity;                    // 変更前のアクティビティ（変更時のみ）
  changes?: PropertyChange[];                   // プロパティ変更リスト（変更時のみ）
}

/**
 * 差分計算結果
 */
export interface DiffResult {
  added: DiffActivity[];                        // 追加されたアクティビティ
  removed: DiffActivity[];                      // 削除されたアクティビティ
  modified: DiffActivity[];                     // 変更されたアクティビティ
}

/**
 * 差分計算クラス
 */
/** 差分表示から除外するプロパティのプレフィックス */
const IGNORED_PROPERTY_PREFIXES = [
  'sap:',          // UIレイアウトメタデータ（HintSize等）
];

export class DiffCalculator {
  /**
   * 2つのアクティビティツリーの差分を計算
   */
  calculate(beforeData: any, afterData: any): DiffResult {
    const result: DiffResult = {
      added: [],
      removed: [],
      modified: []
    };

    // ルートアクティビティから再帰的に比較
    this.compareActivities(
      beforeData.rootActivity,
      afterData.rootActivity,
      result
    );

    return result;
  }

  /**
   * アクティビティを再帰的に比較
   */
  private compareActivities(
    before: Activity,
    after: Activity,
    result: DiffResult
  ): void {
    // 子アクティビティをマップに変換（displayNameをキーとする）
    const beforeMap = this.buildActivityMap(before.children);
    const afterMap = this.buildActivityMap(after.children);

    // 追加されたアクティビティを検出
    afterMap.forEach((activity, key) => {
      if (!beforeMap.has(key)) {
        result.added.push({
          diffType: DiffType.ADDED,
          activity
        });
      }
    });

    // 削除されたアクティビティを検出
    beforeMap.forEach((activity, key) => {
      if (!afterMap.has(key)) {
        result.removed.push({
          diffType: DiffType.REMOVED,
          activity
        });
      }
    });

    // 変更されたアクティビティを検出
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

        // 子アクティビティも再帰的に比較
        this.compareActivities(beforeActivity, afterActivity, result);
      }
    });
  }

  /**
   * アクティビティリストをマップに変換
   */
  private buildActivityMap(activities: Activity[]): Map<string, Activity> {
    const map = new Map<string, Activity>();

    activities.forEach((activity, index) => {
      // displayName + index をキーとして使用（同名のアクティビティ対策）
      const key = `${activity.displayName}_${index}`;
      map.set(key, activity);
    });

    return map;
  }

  /**
   * プロパティの変更を検出
   */
  private detectPropertyChanges(
    before: Activity,
    after: Activity
  ): PropertyChange[] {
    const changes: PropertyChange[] = [];

    // すべてのプロパティ名を収集
    const allPropertyNames = new Set([
      ...Object.keys(before.properties),
      ...Object.keys(after.properties)
    ]);

    // 各プロパティを比較（除外プレフィックスに該当するものはスキップ）
    allPropertyNames.forEach(propName => {
      if (IGNORED_PROPERTY_PREFIXES.some(prefix => propName.startsWith(prefix))) return;
      const beforeValue = before.properties[propName];
      const afterValue = after.properties[propName];

      // 値が異なる場合は変更として記録
      if (!this.areValuesEqual(beforeValue, afterValue)) {
        changes.push({
          propertyName: propName,
          before: beforeValue,
          after: afterValue
        });
      }
    });

    // InformativeScreenshotの変更もチェック
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
   * 2つの値が等しいかを判定
   */
  private areValuesEqual(value1: any, value2: any): boolean {
    // undefinedとnullは等しいとみなす
    if ((value1 === undefined || value1 === null) &&
        (value2 === undefined || value2 === null)) {
      return true;
    }

    // プリミティブ型の比較
    if (typeof value1 !== 'object' && typeof value2 !== 'object') {
      return value1 === value2;
    }

    // オブジェクトの場合はJSON文字列で比較（簡易的な方法）
    try {
      return JSON.stringify(value1) === JSON.stringify(value2);
    } catch {
      return false;
    }
  }
}
