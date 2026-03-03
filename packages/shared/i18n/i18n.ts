// === Language type ===
export type Language = 'en' | 'ja'; // Supported languages

// === Language state (module-level singleton) ===
let currentLanguage: Language = 'en'; // Default: English

/**
 * Set the current language.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/i18n#setlanguage
 */
export function setLanguage(lang: Language): void {
	currentLanguage = lang;
}

/**
 * Get the current language.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/i18n#getlanguage
 */
export function getLanguage(): Language {
	return currentLanguage;
}

// === Japanese activity type map (English uses the XAML element name directly) ===
const activityTypeMap: Record<string, string> = {
	'Sequence': 'シーケンス',
	'Flowchart': 'フローチャート',
	'Assign': '代入',
	'MultipleAssign': '複数代入',
	'If': '条件分岐',
	'While': '繰り返し（While）',
	'DoWhile': '繰り返し（DoWhile）',
	'ForEach': '繰り返し（ForEach）',
	'Switch': 'スイッチ',
	'TryCatch': 'トライキャッチ',
	'Click': 'クリック',
	'TypeInto': '文字を入力',
	'GetText': 'テキストを取得',
	'LogMessage': 'メッセージをログ',
	'InvokeWorkflowFile': 'ワークフローを呼び出し',
	'Delay': '待機',
	'MessageBox': 'メッセージボックス',
	'InputDialog': '入力ダイアログ',
	'WriteLn': '行を書き込み',
	// Modern N-prefix activities
	'NApplicationCard': 'アプリケーションカード',
	'NClick': 'クリック（モダン）',
	'NTypeInto': '文字を入力（モダン）',
	'NGetText': 'テキストを取得（モダン）',
};

// === Japanese property name map ===
const propertyNameMap: Record<string, string> = {
	'To': '代入先',
	'Value': '値',
	'Condition': '条件',
	'Selector': 'セレクター',
	'Message': 'メッセージ',
	'Level': 'レベル',
	'DisplayName': '表示名',
	// N-prefix activity property names
	'AttachMode': 'アタッチモード',
	'HealingAgentBehavior': '修復エージェント',
	'ScopeGuid': 'スコープGUID',
	'Version': 'バージョン',
	'ClickType': 'クリック種別',
	'MouseButton': 'マウスボタン',
	'KeyModifiers': 'キー修飾子',
	'ActivateBefore': '事前アクティブ化',
	'InteractionMode': '操作モード',
	'TargetApp': 'ターゲットアプリ',
	'Target': 'ターゲット',
	'Url': 'URL',
	'ObjectRepository': 'オブジェクトリポジトリ',
	'Text': 'テキスト',
	'EmptyField': 'フィールドクリア',
	'DelayBetweenKeys': 'キー間遅延',
	'DelayBefore': '実行前遅延',
	'DelayAfter': '実行後遅延',
	'FullSelectorArgument': '厳密セレクター',
	'FuzzySelectorArgument': 'あいまいセレクター',
	'CursorMotionType': 'カーソル移動タイプ',
	'AlterDisabledElement': '無効な要素を変更',
};

// === UI strings translation map (both en and ja) ===
const uiStringsMap: Record<string, Record<Language, string>> = {
	'Added': { en: 'Added', ja: '追加' },
	'Removed': { en: 'Removed', ja: '削除' },
	'Modified': { en: 'Modified', ja: '変更' },
	'Properties': { en: 'Properties', ja: 'プロパティ' },
	'Annotations': { en: 'Annotations', ja: '注釈' },
	'Screenshot Changed:': { en: 'Screenshot Changed:', ja: 'スクリーンショット変更:' },
	'Before': { en: 'Before', ja: '変更前' },
	'After': { en: 'After', ja: '変更後' },
	'Changed': { en: 'Changed', ja: '変更' },
	'Unchanged': { en: 'Unchanged', ja: '未変更' },
	'New': { en: 'New', ja: '新規' },
	'Deleted': { en: 'Deleted', ja: '削除済' },
	'Deleted File': { en: 'Deleted File', ja: '削除済ファイル' },
	'New File': { en: 'New File', ja: '新規ファイル' },
	// Sub-property panel groups
	'Input': { en: 'Input', ja: '入力' },
	'Options': { en: 'Options', ja: 'オプション' },
	'Misc': { en: 'Misc', ja: 'その他' },
	'Common': { en: 'Common', ja: '共通' },
	'Target': { en: 'Target', ja: 'ターゲット' },
	'Toggle property panel': { en: 'Properties', ja: 'プロパティ' },
	// Object repository link status
	'Linked': { en: 'Linked', ja: 'リンク済み' },
	'Not linked': { en: 'Not linked', ja: '未リンク' },
};

// === Translation functions ===

/**
 * Translate an activity type name to the current language.
 * English returns the XAML element name as-is.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/i18n#translateactivitytype
 */
export function translateActivityType(type: string): string {
	if (currentLanguage === 'en') return type; // English: use XAML value as-is
	return activityTypeMap[type] || type; // Japanese: look up map, fall back to English
}

/**
 * Translate a property name to the current language.
 * English returns the name as-is.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/i18n#translatepropertyname
 */
export function translatePropertyName(name: string): string {
	if (currentLanguage === 'en') return name; // English: use as-is
	return propertyNameMap[name] || name; // Japanese: look up map, fall back to English
}

/**
 * Translate a UI string key to the current language.
 * Falls back to the key itself if not found in the map.
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/i18n#t
 */
export function t(key: string): string {
	const entry = uiStringsMap[key];
	return entry ? entry[currentLanguage] : key; // Return key as-is if not found
}
