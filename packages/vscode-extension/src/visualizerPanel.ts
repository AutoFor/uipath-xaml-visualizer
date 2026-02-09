import * as vscode from 'vscode'; // VSCode API
import * as path from 'path'; // パス操作
import * as fs from 'fs'; // ファイルシステム
import { XamlParser, SequenceRenderer, TreeViewRenderer } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ

/**
 * XAMLビジュアライザーパネルを管理するクラス
 */
export class VisualizerPanel {
	public static currentPanel: VisualizerPanel | undefined; // 現在のパネルインスタンス
	private readonly _panel: vscode.WebviewPanel; // Webviewパネル
	private readonly _extensionUri: vscode.Uri; // 拡張機能のURI
	private _disposables: vscode.Disposable[] = []; // リソース解放用
	private static logFilePath: string; // ログファイルパス
	private static logBuffer: string[] = []; // ログバッファ

	/**
	 * ログファイルを初期化
	 */
	private static initializeLog(): void {
		if (this.logFilePath) return; // 既に初期化済み

		const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
		const logDir = path.join(homeDir, '.uipath-xaml-visualizer', 'logs');

		try {
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true });
			}
		} catch (error) {
			console.error('ログディレクトリの作成に失敗:', error);
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		this.logFilePath = path.join(logDir, `visualizer-panel-${timestamp}.log`);

		this.log('VisualizerPanel ログファイル初期化', this.logFilePath);
	}

	/**
	 * ログ出力メソッド
	 */
	private static log(message: string, ...args: any[]): void {
		this.initializeLog();

		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [VisualizerPanel] ${message}`;
		const fullMessage = args.length > 0
			? `${logMessage} ${JSON.stringify(args)}`
			: logMessage;

		// コンソールに出力
		console.log(fullMessage);

		// バッファに追加
		this.logBuffer.push(fullMessage);

		// バッファが50行を超えたらファイルに書き込み
		if (this.logBuffer.length >= 50) {
			this.flushLog();
		}
	}

	/**
	 * エラーログ出力メソッド
	 */
	private static logError(message: string, error?: any): void {
		this.initializeLog();

		const timestamp = new Date().toISOString();
		const errorMessage = `[${timestamp}] [VisualizerPanel ERROR] ${message}`;
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
	private static flushLog(): void {
		if (this.logBuffer.length === 0 || !this.logFilePath) return;

		try {
			const logContent = this.logBuffer.join('\n') + '\n';
			fs.appendFileSync(this.logFilePath, logContent, 'utf8');
			this.logBuffer = [];
		} catch (error) {
			console.error('ログファイルへの書き込みに失敗:', error);
		}
	}

	/**
	 * パネルを作成または既存のパネルを表示
	 */
	public static createOrShow(extensionUri: vscode.Uri, document: vscode.TextDocument) {
		VisualizerPanel.log('createOrShow 呼び出し', `ファイル: ${document.fileName}`);

		const column = vscode.ViewColumn.Beside; // エディタの横に表示

		// 既存のパネルがあれば表示
		if (VisualizerPanel.currentPanel) {
			VisualizerPanel.log('既存のパネルを表示');
			VisualizerPanel.currentPanel._panel.reveal(column);
			VisualizerPanel.currentPanel._update(document);
			VisualizerPanel.flushLog();
			return;
		}

		// 新しいパネルを作成
		VisualizerPanel.log('新しいパネルを作成');
		const panel = vscode.window.createWebviewPanel(
			'uipathXamlVisualizer', // パネルID
			'UiPath XAML Visualizer', // パネルタイトル
			column, // 表示位置
			{
				enableScripts: true, // JavaScriptを有効化
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')] // リソースルート
			}
		);

		VisualizerPanel.currentPanel = new VisualizerPanel(panel, extensionUri, document);
		VisualizerPanel.flushLog();
	}

	/**
	 * コンストラクタ（プライベート）
	 */
	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document: vscode.TextDocument) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// 初期コンテンツを設定
		this._update(document);

		// パネルが閉じられたときの処理
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// ドキュメントが変更されたときの処理
		vscode.workspace.onDidChangeTextDocument(
			(e) => {
				if (e.document === document) {
					this._update(document); // コンテンツを更新
				}
			},
			null,
			this._disposables
		);
	}

	/**
	 * リソースを解放
	 */
	public dispose() {
		VisualizerPanel.currentPanel = undefined;

		this._panel.dispose(); // パネルを破棄

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose(); // リソースを解放
			}
		}
	}

	/**
	 * パネルのコンテンツを更新
	 */
	private _update(document: vscode.TextDocument) {
		VisualizerPanel.log('_update 呼び出し', `ファイル: ${document.fileName}`);

		const webview = this._panel.webview;

		try {
			// XAMLを解析
			const xamlContent = document.getText(); // ドキュメントの内容を取得
			VisualizerPanel.log('XAML コンテンツ取得完了', `長さ: ${xamlContent.length}文字`);

			const parser = new XamlParser();
			VisualizerPanel.log('XamlParser インスタンス作成');

			const workflowData = parser.parse(xamlContent); // XAML解析
			VisualizerPanel.log('XAML 解析完了', {
				variables: workflowData.variables.length,
				arguments: workflowData.arguments.length,
				rootActivity: workflowData.rootActivity.type
			});

			// HTMLを生成
			this._panel.webview.html = this._getHtmlForWebview(webview, workflowData);
			VisualizerPanel.log('HTML 生成完了');
			VisualizerPanel.flushLog();
		} catch (error) {
			// エラーが発生した場合
			const errorMessage = error instanceof Error ? error.message : String(error);
			VisualizerPanel.logError('XAML 解析エラー', error);
			this._panel.webview.html = this._getErrorHtml(errorMessage);
			VisualizerPanel.flushLog();
		}
	}

	/**
	 * Webview用のHTMLを生成
	 */
	private _getHtmlForWebview(webview: vscode.Webview, workflowData: any): string {
		const activityHtml = this._renderActivity(workflowData.rootActivity, 0);

		return `<!DOCTYPE html>
		<html lang="ja">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>UiPath XAML Visualizer</title>
			<style>
				body {
					font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
					padding: 20px;
					background-color: #f5f5f5;
					margin: 0;
				}
				.workflow-container {
					max-width: 1200px;
					margin: 0 auto;
				}
				.activity {
					background-color: white;
					border: 2px solid #0078d4;
					border-radius: 4px;
					padding: 12px 16px;
					margin: 8px 0;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
					transition: box-shadow 0.2s;
				}
				.activity:hover {
					box-shadow: 0 4px 8px rgba(0,0,0,0.15);
				}
				.activity-header {
					display: flex;
					align-items: center;
					gap: 10px;
				}
				.activity-icon {
					width: 24px;
					height: 24px;
					background-color: #0078d4;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
					color: white;
					font-weight: bold;
					font-size: 12px;
					flex-shrink: 0;
				}
				.activity-title {
					font-weight: 600;
					color: #333;
					font-size: 14px;
					flex-grow: 1;
				}
				.activity-type {
					font-size: 11px;
					color: #666;
					background-color: #f0f0f0;
					padding: 2px 8px;
					border-radius: 3px;
				}
				.activity-children {
					margin-left: 34px;
					margin-top: 8px;
					border-left: 2px solid #e0e0e0;
					padding-left: 16px;
				}
				.activity-properties {
					margin-top: 8px;
					font-size: 12px;
					color: #666;
					display: none;
				}
				.activity:hover .activity-properties {
					display: block;
				}
				.property-item {
					margin: 4px 0;
					padding-left: 34px;
				}
				.property-key {
					color: #0078d4;
					font-weight: 500;
				}
				.sequence { border-color: #0078d4; }
				.napplicationcard { border-color: #00a4ef; }
				.nclick { border-color: #ffb900; }
				.assign { border-color: #7fba00; }

				h1 {
					color: #333;
					font-size: 24px;
					margin-bottom: 20px;
				}
				.metadata {
					background-color: white;
					padding: 12px 16px;
					border-radius: 4px;
					margin-bottom: 20px;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
				}
				.metadata-item {
					font-size: 13px;
					color: #666;
					margin: 4px 0;
				}
			</style>
		</head>
		<body>
			<div class="workflow-container">
				<h1>📊 UiPath XAML Visualizer</h1>
				<div class="metadata">
					<div class="metadata-item">📋 <strong>Workflow:</strong> ${workflowData.rootActivity.properties['x:Class'] || 'Unknown'}</div>
					<div class="metadata-item">🔢 <strong>Variables:</strong> ${workflowData.variables.length}</div>
					<div class="metadata-item">⚙️ <strong>Arguments:</strong> ${workflowData.arguments.length}</div>
				</div>
				<div id="workflow">
					${activityHtml}
				</div>
			</div>
		</body>
		</html>`;
	}

	/**
	 * アクティビティをHTML要素としてレンダリング
	 */
	private _renderActivity(activity: any, depth: number): string {
		const typeClass = activity.type.toLowerCase();
		const icon = this._getActivityIcon(activity.type);

		let childrenHtml = '';
		if (activity.children && activity.children.length > 0) {
			childrenHtml = '<div class="activity-children">';
			for (const child of activity.children) {
				childrenHtml += this._renderActivity(child, depth + 1);
			}
			childrenHtml += '</div>';
		}

		// 重要なプロパティのみ表示
		let propertiesHtml = '';
		const importantProps = ['Target', 'ClickType', 'Value', 'To'];
		for (const key of importantProps) {
			if (activity.properties[key]) {
				const value = typeof activity.properties[key] === 'object'
					? JSON.stringify(activity.properties[key]).substring(0, 50) + '...'
					: activity.properties[key];
				propertiesHtml += `<div class="property-item"><span class="property-key">${key}:</span> ${value}</div>`;
			}
		}

		return `
			<div class="activity ${typeClass}">
				<div class="activity-header">
					<div class="activity-icon">${icon}</div>
					<div class="activity-title">${activity.displayName}</div>
					<div class="activity-type">${activity.type}</div>
				</div>
				${propertiesHtml ? `<div class="activity-properties">${propertiesHtml}</div>` : ''}
				${childrenHtml}
			</div>
		`;
	}

	/**
	 * アクティビティタイプに応じたアイコンを取得
	 */
	private _getActivityIcon(type: string): string {
		const icons: Record<string, string> = {
			'Sequence': '▶',
			'NApplicationCard': '🖥',
			'NClick': '👆',
			'NTypeInto': '⌨',
			'Assign': '=',
			'If': '?',
			'While': '↻',
			'ForEach': '⟳',
			'LogMessage': '📝',
			'WriteLine': '✍',
		};
		return icons[type] || '●';
	}

	/**
	 * エラー表示用のHTMLを生成
	 */
	private _getErrorHtml(errorMessage: string): string {
		return `<!DOCTYPE html>
		<html lang="ja">
		<head>
			<meta charset="UTF-8">
			<title>Error</title>
		</head>
		<body>
			<h1>エラーが発生しました</h1>
			<pre>${errorMessage}</pre>
		</body>
		</html>`;
	}
}
