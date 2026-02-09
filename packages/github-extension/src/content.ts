import { parseXaml, renderSequence, renderTreeView } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ

/**
 * GitHub上のXAMLファイルを視覚化するコンテンツスクリプト
 */

// ページロード時の処理
function init() {
	console.log('UiPath XAML Visualizer for GitHub が読み込まれました'); // ログ出力

	// XAMLファイルかどうかを判定
	if (!isXamlFile()) {
		return; // XAMLファイルでなければ終了
	}

	// ビジュアライザーボタンを追加
	addVisualizerButton();
}

/**
 * XAMLファイルかどうかを判定
 */
function isXamlFile(): boolean {
	const url = window.location.href; // 現在のURL
	return url.includes('.xaml'); // .xamlを含むかチェック
}

/**
 * ビジュアライザーボタンを追加
 */
function addVisualizerButton() {
	// GitHub のファイルビューアーのツールバーを取得
	const toolbar = document.querySelector('.file-actions'); // ツールバー要素

	if (!toolbar) {
		console.log('ツールバーが見つかりません'); // ログ出力
		return;
	}

	// ボタンを作成
	const button = document.createElement('button'); // ボタン要素
	button.textContent = 'View as Workflow'; // ボタンテキスト
	button.className = 'btn btn-sm'; // GitHubのボタンスタイル
	button.style.marginLeft = '8px'; // 左マージン
	button.addEventListener('click', showVisualizer); // クリックイベント

	// ツールバーにボタンを追加
	toolbar.appendChild(button);
}

/**
 * ビジュアライザーを表示
 */
async function showVisualizer() {
	try {
		// XAMLファイルの内容を取得
		const xamlContent = await fetchXamlContent(); // XAML内容を取得

		// XAMLを解析
		const workflowData = parseXaml(xamlContent); // XAML解析

		// ビジュアライザーパネルを表示
		displayVisualizerPanel(workflowData); // パネル表示
	} catch (error) {
		console.error('ビジュアライザー表示エラー:', error); // エラーログ
		alert('XAMLファイルの解析に失敗しました'); // アラート表示
	}
}

/**
 * XAMLファイルの内容を取得
 */
async function fetchXamlContent(): Promise<string> {
	// GitHub の Raw ボタンのリンクを取得
	const rawButton = document.querySelector('a[data-testid="raw-button"]') as HTMLAnchorElement; // Raw ボタン

	if (!rawButton) {
		throw new Error('Rawボタンが見つかりません'); // エラー
	}

	const rawUrl = rawButton.href; // Raw URL

	// Rawファイルを取得
	const response = await fetch(rawUrl); // HTTP リクエスト
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`); // エラー
	}

	return await response.text(); // テキストとして返す
}

/**
 * ビジュアライザーパネルを表示
 */
function displayVisualizerPanel(workflowData: any) {
	// パネルを作成
	const panel = document.createElement('div'); // パネル要素
	panel.id = 'uipath-visualizer-panel'; // ID設定
	panel.style.position = 'fixed'; // 固定位置
	panel.style.top = '0'; // 上端
	panel.style.right = '0'; // 右端
	panel.style.width = '50%'; // 幅
	panel.style.height = '100%'; // 高さ
	panel.style.backgroundColor = 'white'; // 背景色
	panel.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)'; // 影
	panel.style.zIndex = '10000'; // 最前面
	panel.style.overflow = 'auto'; // スクロール
	panel.style.padding = '20px'; // パディング

	// 閉じるボタンを作成
	const closeButton = document.createElement('button'); // 閉じるボタン
	closeButton.textContent = '✕ 閉じる'; // テキスト
	closeButton.className = 'btn btn-sm'; // ボタンスタイル
	closeButton.style.marginBottom = '10px'; // 下マージン
	closeButton.addEventListener('click', () => {
		panel.remove(); // パネルを削除
	});

	// コンテンツを作成
	const content = document.createElement('pre'); // コンテンツ要素
	content.textContent = JSON.stringify(workflowData, null, 2); // ワークフローデータをJSON表示

	// パネルに追加
	panel.appendChild(closeButton);
	panel.appendChild(content);

	// ページに追加
	document.body.appendChild(panel);
}

// ページロード時に初期化
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init); // DOMロード後に初期化
} else {
	init(); // すでにロード済みなら即座に初期化
}

// GitHub の SPA ナビゲーションに対応
const observer = new MutationObserver(() => {
	if (isXamlFile()) {
		init(); // XAMLファイルなら初期化
	}
});

observer.observe(document.body, {
	childList: true, // 子要素の変更を監視
	subtree: true // サブツリーも監視
});
