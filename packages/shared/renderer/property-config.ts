// === プロパティ分類設定モジュール ===
// アクティビティ別にメインプロパティ・サブプロパティ・非表示プロパティを定義

import { t } from '../i18n/i18n'; // UI文字列翻訳

// === 型定義 ===

/** プロパティグループ（UiPath Studio風のカテゴリ） */
export interface PropertyGroup { // プロパティグループの型
  label: () => string; // グループ名（翻訳対応のため関数）
  properties: string[]; // グループに属するプロパティ名一覧
}

/** アクティビティ別のプロパティ設定 */
export interface ActivityPropertyConfig { // アクティビティ別設定の型
  mainProperties: string[]; // メインエリアに表示するプロパティ
  subGroups: PropertyGroup[]; // サブパネル内のグループ一覧
}

// === 非表示プロパティ判定 ===

/** メタデータ系プレフィックス（表示不要なXAML属性） */
const HIDDEN_PREFIXES = [ // 非表示判定用のプレフィックス一覧
  'sap:', // System.Activities.Presentation名前空間
  'sap2010:', // System.Activities.Presentation 2010名前空間
  'xmlns', // XML名前空間宣言
  'mc:', // Markup Compatibility名前空間
  'mva:', // Microsoft.VisualBasic.Activities名前空間
];

/**
 * メタデータプロパティかどうかを判定
 * sap:*, sap2010:*, xmlns* 等のXAML内部属性を除外
 */
export function isHiddenProperty(name: string): boolean { // プロパティ名を受け取り非表示判定
  return HIDDEN_PREFIXES.some(prefix => name.startsWith(prefix)); // いずれかのプレフィックスで始まるか
}

// === アクティビティ別プロパティ設定 ===

/** メインエリアに表示するデフォルトの重要プロパティ */
const DEFAULT_MAIN_PROPERTIES = ['To', 'Value', 'Condition', 'Selector', 'Message']; // デフォルトのメインプロパティ一覧

/** アクティビティ別の設定マップ */
const ACTIVITY_CONFIGS: Record<string, ActivityPropertyConfig> = { // アクティビティタイプ → 設定
  'NApplicationCard': { // モダンアプリケーションカード
    mainProperties: ['TargetApp'], // メイン: アプリ名（特殊レンダリング）
    subGroups: [ // サブパネル内のグループ
      { label: () => t('Input'), properties: ['AttachMode'] }, // 入力グループ
      { label: () => t('Options'), properties: ['HealingAgentBehavior', 'Version'] }, // オプショングループ
      { label: () => t('Misc'), properties: ['ScopeGuid'] }, // その他グループ
    ],
  },
  'NClick': { // モダンクリック
    mainProperties: ['Target'], // メイン: ターゲット
    subGroups: [ // サブパネル内のグループ
      { label: () => t('Input'), properties: ['ClickType', 'MouseButton', 'KeyModifiers'] }, // 入力グループ
      { label: () => t('Options'), properties: ['ActivateBefore', 'InteractionMode'] }, // オプショングループ
    ],
  },
  'NTypeInto': { // モダン文字入力
    mainProperties: ['Target', 'Text'], // メイン: ターゲット・テキスト
    subGroups: [ // サブパネル内のグループ
      { label: () => t('Input'), properties: ['ClickType', 'MouseButton', 'KeyModifiers'] }, // 入力グループ
      { label: () => t('Options'), properties: ['ActivateBefore', 'InteractionMode', 'EmptyField', 'DelayBetweenKeys', 'DelayBefore', 'DelayAfter'] }, // オプショングループ
    ],
  },
  'NGetText': { // モダンテキスト取得
    mainProperties: ['Target', 'Value'], // メイン: ターゲット・値
    subGroups: [ // サブパネル内のグループ
      { label: () => t('Options'), properties: ['ActivateBefore', 'InteractionMode'] }, // オプショングループ
    ],
  },
};

/**
 * アクティビティタイプに応じたプロパティ設定を取得
 * 未登録のアクティビティはデフォルト設定（グループなし）を返す
 */
export function getActivityPropertyConfig(type: string): ActivityPropertyConfig { // アクティビティタイプから設定を取得
  return ACTIVITY_CONFIGS[type] || { // 登録済み設定があればそれを返す
    mainProperties: DEFAULT_MAIN_PROPERTIES, // デフォルトのメインプロパティ
    subGroups: [], // デフォルトはグループなし
  };
}

/**
 * サブプロパティを抽出
 * メインプロパティでもメタデータでもないプロパティを返す
 */
export function getSubProperties( // サブプロパティ抽出関数
  properties: Record<string, any>, // 全プロパティ
  activityType: string // アクティビティタイプ
): Record<string, any> { // サブプロパティの連想配列を返す
  const config = getActivityPropertyConfig(activityType); // 設定を取得
  const mainSet = new Set(config.mainProperties); // メインプロパティをSetに変換（高速検索）
  const result: Record<string, any> = {}; // 結果オブジェクト

  for (const [key, value] of Object.entries(properties)) { // 全プロパティをループ
    if (mainSet.has(key)) continue; // メインプロパティはスキップ
    if (isHiddenProperty(key)) continue; // メタデータはスキップ
    if (key === 'DisplayName') continue; // 表示名はヘッダーに表示済み
    if (key === 'AssignOperations') continue; // MultipleAssignの専用プロパティはスキップ
    result[key] = value; // サブプロパティとして追加
  }

  return result; // サブプロパティを返す
}

/**
 * アクティビティがサブパネルを持つべきか判定
 * 専用レンダリング（Assign, MultipleAssign）はサブパネル不要
 */
export function hasSubPanel(activityType: string): boolean { // サブパネル要否判定
  if (activityType === 'Assign') return false; // Assignは専用レンダリング
  if (activityType === 'MultipleAssign') return false; // MultipleAssignは専用レンダリング
  return true; // その他はサブパネル対象
}

/**
 * アクティビティがACTIVITY_CONFIGSまたは専用レンダリングに登録済みか判定
 * 未定義アクティビティのプロパティ・サブパネル非表示に使用
 */
export function isDefinedActivity(type: string): boolean { // 定義済みアクティビティ判定
  if (type === 'Assign') return true; // Assignは専用レンダリングあり
  if (type === 'MultipleAssign') return true; // MultipleAssignは専用レンダリングあり
  if (type === 'LogMessage') return true; // LogMessageは専用レンダリングあり
  if (type in ACTIVITY_CONFIGS) return true; // ACTIVITY_CONFIGSに登録済み
  if (type.startsWith('N')) return true; // Nプレフィックス（モダンアクティビティ）は専用レンダリングあり
  return false; // 上記以外は未定義
}
