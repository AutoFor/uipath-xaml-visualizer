// === 言語型定義 ===
export type Language = 'en' | 'ja'; // 対応言語

// === 言語状態管理（モジュールレベルシングルトン） ===
let currentLanguage: Language = 'en'; // デフォルトは英語

export function setLanguage(lang: Language): void { // 言語を設定
	currentLanguage = lang;
}

export function getLanguage(): Language { // 現在の言語を取得
	return currentLanguage;
}

// === アクティビティタイプの日本語マップ（英語はXAMLの値をそのまま使用） ===
const activityTypeMap: Record<string, string> = {
	'Sequence': 'シーケンス', // シーケンスアクティビティ
	'Flowchart': 'フローチャート', // フローチャートアクティビティ
	'Assign': '代入', // 代入アクティビティ
	'MultipleAssign': '複数代入', // 複数代入アクティビティ
	'If': '条件分岐', // 条件分岐アクティビティ
	'While': '繰り返し（While）', // Whileループ
	'DoWhile': '繰り返し（DoWhile）', // DoWhileループ
	'ForEach': '繰り返し（ForEach）', // ForEachループ
	'Switch': 'スイッチ', // スイッチアクティビティ
	'TryCatch': 'トライキャッチ', // 例外処理アクティビティ
	'Click': 'クリック', // クリックアクティビティ
	'TypeInto': '文字を入力', // 文字入力アクティビティ
	'GetText': 'テキストを取得', // テキスト取得アクティビティ
	'LogMessage': 'メッセージをログ', // ログメッセージアクティビティ
	'InvokeWorkflowFile': 'ワークフローを呼び出し', // ワークフロー呼び出し
	'Delay': '待機', // 待機アクティビティ
	'MessageBox': 'メッセージボックス', // メッセージボックスアクティビティ
	'InputDialog': '入力ダイアログ', // 入力ダイアログアクティビティ
	'WriteLn': '行を書き込み', // 行書き込みアクティビティ
	// N系アクティビティ（モダンデザイン）
	'NApplicationCard': 'アプリケーションカード', // モダンアプリケーションカード
	'NClick': 'クリック（モダン）', // モダンクリック
	'NTypeInto': '文字を入力（モダン）', // モダン文字入力
	'NGetText': 'テキストを取得（モダン）', // モダンテキスト取得
};

// === プロパティ名の日本語マップ ===
const propertyNameMap: Record<string, string> = {
	'To': '代入先', // 代入先プロパティ
	'Value': '値', // 値プロパティ
	'Condition': '条件', // 条件プロパティ
	'Selector': 'セレクター', // セレクタープロパティ
	'Message': 'メッセージ', // メッセージプロパティ
	'Level': 'レベル', // ログレベルプロパティ
	'DisplayName': '表示名', // 表示名プロパティ
};

// === UI文字列の翻訳マップ（en/ja両方持つ） ===
const uiStringsMap: Record<string, Record<Language, string>> = {
	'Added': { en: 'Added', ja: '追加' }, // 差分バッジ: 追加
	'Removed': { en: 'Removed', ja: '削除' }, // 差分バッジ: 削除
	'Modified': { en: 'Modified', ja: '変更' }, // 差分バッジ: 変更
	'Properties': { en: 'Properties', ja: 'プロパティ' }, // 詳細パネル: プロパティ
	'Annotations': { en: 'Annotations', ja: '注釈' }, // 詳細パネル: 注釈
	'Screenshot Changed:': { en: 'Screenshot Changed:', ja: 'スクリーンショット変更:' }, // スクリーンショット変更ラベル
	'Before': { en: 'Before', ja: '変更前' }, // Before ラベル
	'After': { en: 'After', ja: '変更後' }, // After ラベル
	'Changed': { en: 'Changed', ja: '変更' }, // バッジ: Changed
	'Unchanged': { en: 'Unchanged', ja: '未変更' }, // バッジ: Unchanged
	'New': { en: 'New', ja: '新規' }, // バッジ: New
	'Deleted': { en: 'Deleted', ja: '削除済' }, // バッジ: Deleted
	'Deleted File': { en: 'Deleted File', ja: '削除済ファイル' }, // 削除ファイルラベル
	'New File': { en: 'New File', ja: '新規ファイル' }, // 新規ファイルラベル
};

// === 翻訳関数 ===

export function translateActivityType(type: string): string { // アクティビティタイプを翻訳
	if (currentLanguage === 'en') return type; // 英語はXAMLの値をそのまま
	return activityTypeMap[type] || type; // 日本語訳がなければ英語のまま
}

export function translatePropertyName(name: string): string { // プロパティ名を翻訳
	if (currentLanguage === 'en') return name; // 英語はそのまま
	return propertyNameMap[name] || name; // 日本語訳がなければ英語のまま
}

export function t(key: string): string { // UI文字列を翻訳
	const entry = uiStringsMap[key]; // 翻訳マップを検索
	return entry ? entry[currentLanguage] : key; // 見つからなければキーをそのまま返す
}
