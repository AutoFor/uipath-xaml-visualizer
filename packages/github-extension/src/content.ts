import { XamlParser, DiffCalculator, DiffRenderer, SequenceRenderer, XamlLineMapper, buildActivityKey } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ
import type { ActivityLineIndex, CommentRenderOptions } from '@uipath-xaml-visualizer/shared'; // 型定義
import { fetchReviewComments, mapCommentsToActivities, postReviewComment } from './review-comments'; // レビューコメントモジュール
import type { ReviewComment } from './review-comments'; // レビューコメント型
import '../../shared/styles/github-panel.css'; // パネル用スコープ付きスタイル

/**
 * GitHub上のXAMLファイルを視覚化するコンテンツスクリプト
 * - blob-xaml: 個別ファイル表示ページ（既存機能）
 * - pr-diff: PR差分ページ（新機能）
 */

// ========== ビルド情報（webpackのDefinePluginで注入） ==========

declare const __BUILD_DATE__: string;  // ビルド日時
declare const __VERSION__: string;     // バージョン
declare const __BRANCH_NAME__: string; // ビルド時のブランチ名

// ========== 型定義 ==========

type PageType = 'blob-xaml' | 'pr-diff' | 'unknown'; // ページタイプ

interface PrInfo {
	owner: string;   // リポジトリオーナー
	repo: string;    // リポジトリ名
	prNumber: number; // PR番号
}

interface PrRefs {
	baseSha: string; // ベースブランチのSHA
	headSha: string; // ヘッドブランチのSHA
}

// ========== モジュールレベルのキャッシュ ==========

let cachedPrRefs: PrRefs | null = null; // PR refs キャッシュ（同一PR内で1回だけAPI呼び出し）
let lastUrl: string = ''; // 前回のURL（URL変更検出用）
let debounceTimer: ReturnType<typeof setTimeout> | null = null; // デバウンスタイマー

// ========== ビジュアライザーコンテキスト（コメント連携用） ==========

let currentContext: {
	pr: PrInfo;               // PR情報
	refs: PrRefs;             // base/head SHA
	filePath: string;         // ファイルパス
	headLineIndex: ActivityLineIndex | null; // head側の行マップ
} | null = null; // 現在のビジュアライザーコンテキスト

// ========== ページタイプ検出 ==========

/**
 * 現在のページタイプを検出
 */
function detectPageType(): PageType {
	const url = window.location.href; // 現在のURL

	if (url.includes('.xaml')) {
		return 'blob-xaml'; // 個別XAMLファイルページ
	}

	if (/\/pull\/\d+\/files/.test(url)) {
		return 'pr-diff'; // PR差分ページ
	}

	return 'unknown'; // その他のページ
}

// ========== デバッグ情報収集 ==========

/**
 * デバッグ情報を収集してログ配列として返す
 */
function collectDebugInfo(): string[] {
	const info: string[] = []; // デバッグ情報の配列

	// A. script[type="application/json"] タグの個数
	const jsonScripts = Array.from(document.querySelectorAll('script[type="application/json"]')); // JSON埋め込みスクリプト
	info.push(`[A] script[type="application/json"] タグ数: ${jsonScripts.length}`);

	// B. 各タグ内に 40文字16進数（SHA候補）が含まれるかチェック
	const shaPattern = /[a-f0-9]{40}/g; // 40文字の16進数パターン
	let totalShaCandidates = 0; // SHA候補の合計数
	jsonScripts.forEach((script, idx) => {
		const text = script.textContent || ''; // スクリプト内容
		const matches = text.match(shaPattern); // SHA候補を検索
		if (matches && matches.length > 0) {
			totalShaCandidates += matches.length; // 候補数を加算
			// 最初のSHA候補の前後30文字のコンテキストを記録
			const firstMatch = matches[0]; // 最初のSHA候補
			const pos = text.indexOf(firstMatch); // 位置
			const contextStart = Math.max(0, pos - 30); // コンテキスト開始位置
			const contextEnd = Math.min(text.length, pos + 40 + 30); // コンテキスト終了位置
			const context = text.substring(contextStart, contextEnd); // コンテキスト文字列
			info.push(`  [B] scriptタグ#${idx}: SHA候補 ${matches.length}個, コンテキスト: ...${context.replace(/</g, '&lt;').replace(/>/g, '&gt;')}...`);
		}
	});
	info.push(`[B] SHA候補合計: ${totalShaCandidates}個`);

	// C. インラインスクリプトで "Oid", "sha", "Sha" を含むものの個数
	const inlineScripts = Array.from(document.querySelectorAll('script:not([src]):not([type])')); // インラインスクリプト
	let oidCount = 0; // Oid含有数
	let shaKeyCount = 0; // sha含有数
	inlineScripts.forEach(script => {
		const text = script.textContent || ''; // スクリプト内容
		if (text.includes('Oid') || text.includes('sha') || text.includes('Sha')) {
			oidCount++; // カウント
		}
		if (text.includes('baseRefOid') || text.includes('headRefOid')) {
			shaKeyCount++; // SHA関連キー含有数
		}
	});
	info.push(`[C] インラインスクリプト合計: ${inlineScripts.length}個, Oid/sha/Sha含有: ${oidCount}個, baseRefOid/headRefOid含有: ${shaKeyCount}個`);

	// D. hidden input (comparison_start_oid, comparison_end_oid) の存在
	const startOid = document.querySelector('input[name="comparison_start_oid"]') as HTMLInputElement; // 比較開始OID
	const endOid = document.querySelector('input[name="comparison_end_oid"]') as HTMLInputElement; // 比較終了OID
	info.push(`[D] hidden input: comparison_start_oid=${startOid ? startOid.value : '(なし)'}, comparison_end_oid=${endOid ? endOid.value : '(なし)'}`);

	// E. blob リンク (a[href*="/blob/"]) の個数と最初の href
	const blobLinks = Array.from(document.querySelectorAll('a[href*="/blob/"]')); // blobリンク
	const firstBlobHref = blobLinks.length > 0 ? (blobLinks[0] as HTMLAnchorElement).href : '(なし)'; // 最初のhref
	info.push(`[E] blob リンク数: ${blobLinks.length}個, 最初: ${firstBlobHref}`);

	// blobリンクからSHA候補を抽出してみる
	if (blobLinks.length > 0) {
		const blobShaPattern = /\/blob\/([a-f0-9]{40})\//; // blobリンク内のSHAパターン
		const blobShaMatches = firstBlobHref.match(blobShaPattern); // SHA候補を検索
		info.push(`  [E] blob リンクからSHA抽出: ${blobShaMatches ? blobShaMatches[1] : '(パターン不一致)'}`);
	}

	// F. .commit-ref, [data-branch-name] 等のブランチ情報要素
	const commitRefs = document.querySelectorAll('.commit-ref'); // コミット参照要素
	const branchNames = document.querySelectorAll('[data-branch-name]'); // ブランチ名要素
	info.push(`[F] .commit-ref: ${commitRefs.length}個, [data-branch-name]: ${branchNames.length}個`);
	commitRefs.forEach((el, idx) => {
		info.push(`  [F] .commit-ref#${idx}: "${el.textContent?.trim()}"`); // 内容を記録
	});

	// G. ページURL情報
	info.push(`[G] URL: ${window.location.href}`);
	info.push(`[G] pathname: ${window.location.pathname}`);

	return info;
}

// ========== PR情報の取得 ==========

/**
 * URLからPR情報を抽出
 */
function parsePrUrl(): PrInfo | null {
	const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/); // URL解析
	if (!match) return null;

	return {
		owner: match[1],   // オーナー名
		repo: match[2],    // リポジトリ名
		prNumber: parseInt(match[3], 10) // PR番号
	};
}

/**
 * テキストからbase/head SHAのペアを抽出（複数パターン対応）
 */
function extractShasFromText(text: string): PrRefs | null {
	// パターン1: baseRefOid / headRefOid（GitHub React埋め込みデータ）
	let base = text.match(/"baseRefOid"\s*:\s*"([a-f0-9]{40})"/);
	let head = text.match(/"headRefOid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// パターン2: baseSha / headSha
	base = text.match(/"baseSha"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"headSha"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// パターン3: "base":{"sha":"..."} / "head":{"sha":"..."}（REST API形式）
	base = text.match(/"base"\s*:\s*\{[^}]*"sha"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"head"\s*:\s*\{[^}]*"sha"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// パターン4: comparison_start_oid / comparison_end_oid（GitHub diff hidden input）
	base = text.match(/"comparison_start_oid"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"comparison_end_oid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// パターン5: oid フィールド（GitHub GraphQL形式）
	base = text.match(/"baseOid"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"headOid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	return null;
}

/**
 * 現在のページのDOMからbase/head SHAを抽出
 */
function extractShasFromDom(): PrRefs | null {
	// 方法A: <script type="application/json"> タグ（GitHub React埋め込みデータ）
	const jsonScripts = Array.from(document.querySelectorAll('script[type="application/json"]')); // JSON埋め込みスクリプト
	console.log(`UiPath Visualizer: DOM抽出: JSON scriptタグ ${jsonScripts.length}個検出`);
	let shaCount = 0; // SHA候補カウンタ
	for (let i = 0; i < jsonScripts.length; i++) {
		const text = jsonScripts[i].textContent || '';
		const refs = extractShasFromText(text);
		if (refs) {
			console.log('UiPath Visualizer: JSON scriptタグからSHA取得成功');
			return refs;
		}
		// SHA候補があるか確認（デバッグ用）
		const shaMatches = text.match(/[a-f0-9]{40}/g); // 40文字16進数を検索
		if (shaMatches) shaCount += shaMatches.length; // 候補をカウント
	}
	console.log(`UiPath Visualizer: DOM抽出: JSON scriptタグ ${jsonScripts.length}個検出, SHA候補 ${shaCount}個`);

	// 方法B: インラインスクリプト（src属性なし、type属性なし）
	const inlineScripts = Array.from(document.querySelectorAll('script:not([src]):not([type])')); // インラインスクリプト
	for (let i = 0; i < inlineScripts.length; i++) {
		const text = inlineScripts[i].textContent || '';
		if (text.length > 100 && (text.includes('Oid') || text.includes('sha') || text.includes('Sha'))) {
			const refs = extractShasFromText(text);
			if (refs) {
				console.log('UiPath Visualizer: インラインscriptタグからSHA取得成功');
				return refs;
			}
		}
	}

	// 方法C: hidden input要素
	const startOid = document.querySelector('input[name="comparison_start_oid"]') as HTMLInputElement; // 比較開始OID
	const endOid = document.querySelector('input[name="comparison_end_oid"]') as HTMLInputElement; // 比較終了OID
	if (startOid?.value && endOid?.value) {
		console.log('UiPath Visualizer: hidden inputからSHA取得成功');
		return { baseSha: startOid.value, headSha: endOid.value };
	}

	// 方法D: blob リンクから head SHA を抽出
	const blobLinks = Array.from(document.querySelectorAll('a[href*="/blob/"]')); // blobリンク
	if (blobLinks.length > 0) {
		const blobShaPattern = /\/blob\/([a-f0-9]{40})\//; // blobリンク内のSHAパターン
		for (const link of blobLinks) {
			const href = (link as HTMLAnchorElement).href; // リンクURL
			const match = href.match(blobShaPattern); // SHA候補を検索
			if (match) {
				console.log(`UiPath Visualizer: blobリンクからhead SHA候補取得: ${match[1]}`);
				// blobリンクからはheadSHAのみ取得可能 → baseSHAは別途必要なので単独では使えない
				// ただし、後でbaseSHA取得と組み合わせるために記録しておく
				break;
			}
		}
	}

	// 方法E: ページ全体のHTMLからSHAペアを検索（最終手段）
	const fullHtml = document.documentElement.innerHTML; // ページ全体のHTML
	// まずキーワードの存在を確認してから正規表現を適用（パフォーマンス対策）
	if (fullHtml.indexOf('baseRefOid') !== -1 || fullHtml.indexOf('headRefOid') !== -1 ||
		fullHtml.indexOf('baseSha') !== -1 || fullHtml.indexOf('headSha') !== -1 ||
		fullHtml.indexOf('baseOid') !== -1 || fullHtml.indexOf('headOid') !== -1 ||
		fullHtml.indexOf('comparison_start_oid') !== -1) {
		console.log('UiPath Visualizer: ページ全体HTMLからSHAキーワード検出、正規表現で検索中...');
		const refs = extractShasFromText(fullHtml); // ページ全体から抽出
		if (refs) {
			console.log('UiPath Visualizer: ページ全体HTMLからSHA取得成功');
			return refs;
		}
		console.log('UiPath Visualizer: ページ全体HTMLにSHAキーワードあるがペア抽出失敗');
	}

	return null;
}

/**
 * PRのbase/head SHAを取得（DOM抽出 → 同一オリジンfetch → API フォールバック）
 */
async function fetchPrRefs(pr: PrInfo): Promise<PrRefs> {
	// キャッシュがあればそれを返す
	if (cachedPrRefs) {
		return cachedPrRefs;
	}

	// 方法1: 現在のページのDOMから直接SHA抽出（最速・最も信頼性が高い）
	const domRefs = extractShasFromDom();
	if (domRefs) {
		cachedPrRefs = domRefs;
		return cachedPrRefs;
	}
	console.log('UiPath Visualizer: DOMからSHA取得できず、fetch にフォールバック');

	// 方法2: PRページをHTMLとして取得してSHA抽出（同一オリジン → Cookie送信）
	const prPageUrl = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.prNumber}`; // PRページURL

	// 2a: credentials: 'same-origin' で試行
	try {
		console.log(`UiPath Visualizer: HTML fetch (same-origin) 開始: ${prPageUrl}`);
		const response = await fetch(prPageUrl, { credentials: 'same-origin' }); // 同一オリジンCookie送信
		console.log(`UiPath Visualizer: HTML fetch: status=${response.status}`);
		if (response.ok) {
			const html = await response.text(); // HTMLテキスト
			console.log(`UiPath Visualizer: HTML fetch: length=${html.length}, SHA候補あり=${html.indexOf('baseRefOid') !== -1 || html.indexOf('baseSha') !== -1}`);
			const refs = extractShasFromText(html);
			if (refs) {
				console.log('UiPath Visualizer: fetch HTML (same-origin) からSHA取得成功');
				cachedPrRefs = refs;
				return cachedPrRefs;
			}
			console.warn('UiPath Visualizer: HTMLにSHAパターンが見つかりません (HTML length:', html.length, ')');
		} else {
			console.warn('UiPath Visualizer: PRページ取得失敗 (same-origin):', response.status);
		}
	} catch (e) {
		console.warn('UiPath Visualizer: PRページfetchエラー (same-origin):', e);
	}

	// 2b: credentials: 'include' で再試行（Chrome拡張でのCookie送信挙動の違いに対応）
	try {
		console.log(`UiPath Visualizer: HTML fetch (include) 開始: ${prPageUrl}`);
		const response = await fetch(prPageUrl, { credentials: 'include' }); // Cookie含むリクエスト
		console.log(`UiPath Visualizer: HTML fetch (include): status=${response.status}`);
		if (response.ok) {
			const html = await response.text(); // HTMLテキスト
			console.log(`UiPath Visualizer: HTML fetch (include): length=${html.length}`);
			const refs = extractShasFromText(html);
			if (refs) {
				console.log('UiPath Visualizer: fetch HTML (include) からSHA取得成功');
				cachedPrRefs = refs;
				return cachedPrRefs;
			}
		}
	} catch (e) {
		console.warn('UiPath Visualizer: PRページfetchエラー (include):', e);
	}

	// 方法3: GitHub REST API（パブリックリポジトリ用フォールバック）
	try {
		const apiUrl = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}`; // API URL
		console.log(`UiPath Visualizer: API fetch 開始: ${apiUrl}`);
		const apiResponse = await fetch(apiUrl, {
			headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
		});
		console.log(`UiPath Visualizer: API fetch: status=${apiResponse.status}`);
		if (apiResponse.ok) {
			const data = await apiResponse.json(); // レスポンスをパース
			cachedPrRefs = { baseSha: data.base.sha, headSha: data.head.sha };
			console.log('UiPath Visualizer: GitHub APIからSHA取得成功');
			return cachedPrRefs;
		}
	} catch (e) {
		console.warn('UiPath Visualizer: GitHub APIフォールバック失敗:', e);
	}

	throw new Error('PR の base/head SHA を取得できません。コンソールログを確認してください。'); // エラー
}

/**
 * ファイル内容を取得（同一オリジン経由でプライベートリポジトリにも対応）
 */
async function fetchRawContent(owner: string, repo: string, sha: string, filePath: string): Promise<string> {
	// 方法1: github.com の同一オリジンから取得（セッションCookieが送信される → プライベートリポジトリ対応）
	const sameOriginUrl = `https://github.com/${owner}/${repo}/raw/${sha}/${filePath}`; // 同一オリジンURL
	const response = await fetch(sameOriginUrl, { credentials: 'same-origin' }); // Cookie付きリクエスト

	if (response.status === 404) {
		return ''; // ファイルが存在しない場合は空文字（新規追加/削除ファイル対応）
	}

	if (response.ok) {
		return await response.text(); // テキストとして返す
	}

	// 方法2: raw.githubusercontent.com にフォールバック（パブリックリポジトリ用）
	const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${filePath}`; // Raw URL
	const fallbackResponse = await fetch(rawUrl); // HTTP リクエスト

	if (fallbackResponse.status === 404) {
		return ''; // ファイルが存在しない場合は空文字
	}

	if (!fallbackResponse.ok) {
		throw new Error(`Raw content 取得エラー: ${fallbackResponse.status}`); // エラー
	}

	return await fallbackResponse.text(); // テキストとして返す
}

// ========== PR diff ページのDOM操作 ==========

/**
 * PR diff ページをスキャンしてXAMLファイルにボタンを注入
 */
function scanAndInjectDiffButtons(): void {
	// GitHub PRのdiffページで各ファイルのdivを取得
	const fileContainers = document.querySelectorAll('div.file[data-tagsearch-path]'); // ファイルコンテナ

	fileContainers.forEach(container => {
		const filePath = container.getAttribute('data-tagsearch-path'); // ファイルパス
		if (!filePath || !filePath.endsWith('.xaml')) return; // XAMLファイルのみ処理

		// 既にボタンが追加済みかチェック
		if (container.querySelector('.uipath-visualizer-btn')) return; // 重複防止

		// ツールバーを探す（ファイルヘッダーのアクションエリア）
		const toolbar = container.querySelector('.file-actions, .js-file-header-dropdown'); // ツールバー

		if (!toolbar) return; // ツールバーが見つからない場合はスキップ

		// 「View as Workflow」ボタンを作成
		const button = document.createElement('button'); // ボタン要素
		button.textContent = 'View as Workflow'; // ボタンテキスト
		button.className = 'btn btn-sm uipath-visualizer-btn'; // GitHubスタイル + 識別クラス
		button.style.marginLeft = '8px'; // 左マージン
		button.addEventListener('click', (e) => {
			e.preventDefault(); // デフォルト動作を防止
			e.stopPropagation(); // イベント伝播を停止
			showDiffVisualizer(filePath); // 差分ビジュアライザーを表示
		});

		toolbar.appendChild(button); // ツールバーにボタンを追加
	});
}

// ========== 差分ビジュアライゼーション ==========

/**
 * 差分ビジュアライザーを表示
 */
async function showDiffVisualizer(filePath: string): Promise<void> {
	// 既存パネルを削除
	const existingPanel = document.getElementById('uipath-visualizer-panel'); // 既存パネル
	if (existingPanel) existingPanel.remove();

	// ローディングパネルを表示
	const panel = createPanel(); // パネル作成
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // コンテンツエリア
	contentArea.innerHTML = '<div class="status-message">読み込み中...</div>'; // ローディング表示
	document.body.appendChild(panel); // ページに追加

	try {
		const pr = parsePrUrl(); // PR情報を取得
		if (!pr) throw new Error('PR情報を取得できません');

		const refs = await fetchPrRefs(pr); // base/head SHAを取得

		// before/afterのXAMLを並列で取得
		const [beforeXaml, afterXaml] = await Promise.all([
			fetchRawContent(pr.owner, pr.repo, refs.baseSha, filePath), // ベース版
			fetchRawContent(pr.owner, pr.repo, refs.headSha, filePath)  // ヘッド版
		]);

		const parser = new XamlParser(); // パーサーを初期化

		if (beforeXaml && afterXaml) {
			// 変更ファイル: 差分表示
			const beforeData = parser.parse(beforeXaml); // ベース版をパース
			const afterData = parser.parse(afterXaml);   // ヘッド版をパース

			const diffCalc = new DiffCalculator(); // 差分計算
			const diffResult = diffCalc.calculate(beforeData, afterData); // 差分を計算

			// 行番号マッピングを構築
			const baseLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // base側の行マップ
			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // head側の行マップ

			// コンテキストを保存（コメント投稿時に使用）
			currentContext = { pr, refs, filePath, headLineIndex };

			// レビューコメントを取得してマッピング（非同期・失敗時は空マップ）
			let commentsMap = new Map<string, ReviewComment[]>();
			try {
				const comments = await fetchReviewComments(pr, filePath); // コメント取得
				commentsMap = mapCommentsToActivities(comments, headLineIndex, baseLineIndex); // マッピング
			} catch (e) {
				console.warn('UiPath Visualizer: レビューコメント取得失敗（差分表示は続行）:', e);
			}

			// コメントレンダリングオプションを構築
			const commentOptions: CommentRenderOptions = {
				commentsMap,
				onPostComment: async (activityKey: string, body: string) => {
					await handlePostComment(activityKey, body); // コメント投稿ハンドラ
				},
				getActivityKey: (activity, index) => buildActivityKey(activity, index) // キー生成関数
			};

			// サマリーを表示
			const summaryHtml = createDiffSummary(diffResult); // サマリーHTML
			contentArea.innerHTML = ''; // クリア
			contentArea.appendChild(summaryHtml); // サマリーを追加

			// 差分詳細を表示（コメントオプション付き）
			const diffContainer = document.createElement('div'); // 差分コンテナ
			diffContainer.className = 'diff-content'; // クラス設定
			const diffRenderer = new DiffRenderer(); // 差分レンダラー
			diffRenderer.render(diffResult, diffContainer, commentOptions, headLineIndex, baseLineIndex); // コメント・行番号付きで差分をレンダリング
			contentArea.appendChild(diffContainer); // コンテンツに追加

		} else if (afterXaml) {
			// 新規ファイル: after のみ表示
			const afterData = parser.parse(afterXaml); // パース
			const afterLineIndex = XamlLineMapper.buildLineMap(afterXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-new-file">新規ファイル</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, afterLineIndex); // 行番号付きでレンダリング
			contentArea.appendChild(seqContainer); // 追加

		} else if (beforeXaml) {
			// 削除ファイル: before のみ表示
			const beforeData = parser.parse(beforeXaml); // パース
			const beforeLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-deleted-file">削除されたファイル</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(beforeData, seqContainer, beforeLineIndex); // 行番号付きでレンダリング
			contentArea.appendChild(seqContainer); // 追加

		} else {
			contentArea.innerHTML = '<div class="status-message">XAMLコンテンツが見つかりません</div>'; // エラー表示
		}

	} catch (error) {
		console.error('差分ビジュアライザーエラー:', error); // エラーログ

		// デバッグ情報を収集してパネルに表示
		const debugInfo = collectDebugInfo(); // デバッグ情報収集
		contentArea.innerHTML = `
			<div class="error-message">
				<div class="error-title">
					エラー: ${(error as Error).message}
				</div>
				<div class="debug-info">${debugInfo.join('\n')}</div>
			</div>`; // エラーとデバッグ情報を表示
	}
}

/**
 * コメント投稿ハンドラ（ビジュアライザーからのコメント投稿を処理）
 */
async function handlePostComment(activityKey: string, body: string): Promise<void> {
	if (!currentContext) throw new Error('ビジュアライザーコンテキストが未設定');

	const { pr, refs, filePath, headLineIndex } = currentContext; // コンテキスト取得

	// アクティビティキーから行範囲を取得
	const lineRange = headLineIndex?.keyToLines.get(activityKey); // 行範囲
	const line = lineRange?.endLine || 1; // コメント対象行（endLine）
	const startLine = lineRange?.startLine; // 複数行コメントの開始行

	const result = await postReviewComment(pr, {
		body,
		commitId: refs.headSha, // headのコミットSHA
		path: filePath,
		line,
		startLine: startLine !== line ? startLine : undefined, // 1行の場合はstart_lineを省略
		side: 'RIGHT' // head側にコメント
	});

	if (!result) {
		throw new Error('コメント投稿に失敗しました');
	}
}

/**
 * 差分サマリーを作成
 */
function createDiffSummary(diffResult: any): HTMLElement {
	const summary = document.createElement('div'); // サマリー要素
	summary.className = 'diff-summary'; // クラス設定

	// 追加カード
	const addedCard = document.createElement('div'); // 追加カード
	addedCard.className = 'summary-card';
	addedCard.innerHTML = `
		<span class="summary-label">追加</span>
		<span class="count added">${diffResult.added.length}</span>
	`;

	// 削除カード
	const removedCard = document.createElement('div'); // 削除カード
	removedCard.className = 'summary-card';
	removedCard.innerHTML = `
		<span class="summary-label">削除</span>
		<span class="count removed">${diffResult.removed.length}</span>
	`;

	// 変更カード
	const modifiedCard = document.createElement('div'); // 変更カード
	modifiedCard.className = 'summary-card';
	modifiedCard.innerHTML = `
		<span class="summary-label">変更</span>
		<span class="count modified">${diffResult.modified.length}</span>
	`;

	summary.appendChild(addedCard);
	summary.appendChild(removedCard);
	summary.appendChild(modifiedCard);

	return summary;
}

// ========== パネルUI ==========

/**
 * ビジュアライザーパネルを作成
 */
function createPanel(): HTMLElement {
	const panel = document.createElement('div'); // パネル要素
	panel.id = 'uipath-visualizer-panel'; // ID設定（レイアウト・色はCSSで定義）

	// ヘッダー部分
	const header = document.createElement('div'); // ヘッダー
	header.className = 'panel-header'; // CSSクラスでスタイル適用

	const titleArea = document.createElement('div'); // タイトルエリア

	const title = document.createElement('span'); // タイトル
	title.textContent = 'UiPath Workflow Visualizer'; // タイトルテキスト
	title.className = 'panel-title'; // CSSクラスでスタイル適用

	const buildInfo = document.createElement('div'); // ビルド情報
	const buildDate = new Date(__BUILD_DATE__); // ビルド日時をDateに変換
	const formattedDate = buildDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }); // 日本時間でフォーマット
	buildInfo.textContent = `v${__VERSION__} | ${__BRANCH_NAME__} | Build: ${formattedDate}`; // バージョン、ブランチ名、ビルド日時
	buildInfo.className = 'panel-build-info'; // CSSクラスでスタイル適用

	titleArea.appendChild(title);
	titleArea.appendChild(buildInfo);

	const closeButton = document.createElement('button'); // 閉じるボタン
	closeButton.textContent = '✕'; // テキスト
	closeButton.className = 'btn btn-sm'; // ボタンスタイル
	closeButton.addEventListener('click', () => panel.remove()); // クリックで閉じる

	// Copy HTMLボタン（デバッグ用）
	const copyHtmlButton = document.createElement('button'); // コピーボタン
	copyHtmlButton.textContent = 'Copy HTML'; // ボタンテキスト
	copyHtmlButton.className = 'btn btn-sm panel-copy-btn'; // スタイル適用
	copyHtmlButton.addEventListener('click', () => { // クリックイベント
		const originalText = copyHtmlButton.textContent; // 元のテキストを保存
		navigator.clipboard.writeText(content.innerHTML) // コンテンツのHTMLをクリップボードにコピー
			.then(() => {
				copyHtmlButton.textContent = 'Copied!'; // 成功表示
				copyHtmlButton.classList.add('panel-copy-btn-success'); // 成功スタイル
			})
			.catch(() => {
				copyHtmlButton.textContent = 'Failed'; // 失敗表示
				copyHtmlButton.classList.add('panel-copy-btn-error'); // 失敗スタイル
			})
			.finally(() => {
				setTimeout(() => { // 1.5秒後に元に戻す
					copyHtmlButton.textContent = originalText; // テキスト復元
					copyHtmlButton.classList.remove('panel-copy-btn-success', 'panel-copy-btn-error'); // スタイル復元
				}, 1500);
			});
	});

	// ヘッダーボタングループ
	const headerButtons = document.createElement('div'); // ボタンコンテナ
	headerButtons.className = 'panel-header-buttons'; // スタイル適用
	headerButtons.appendChild(copyHtmlButton); // コピーボタン追加
	headerButtons.appendChild(closeButton); // 閉じるボタン追加

	header.appendChild(titleArea);
	header.appendChild(headerButtons);

	// コンテンツ部分
	const content = document.createElement('div'); // コンテンツ
	content.className = 'panel-content'; // CSSクラスでスタイル適用

	panel.appendChild(header);
	panel.appendChild(content);

	return panel;
}

// ========== 既存機能: 個別XAMLファイルページ ==========

/**
 * 個別XAMLファイルページにビジュアライザーボタンを追加
 */
function addVisualizerButton(): void {
	const toolbar = document.querySelector('.file-actions'); // ツールバー要素

	if (!toolbar) {
		console.log('ツールバーが見つかりません'); // ログ出力
		return;
	}

	// 重複防止
	if (toolbar.querySelector('.uipath-visualizer-btn')) return;

	const button = document.createElement('button'); // ボタン要素
	button.textContent = 'View as Workflow'; // ボタンテキスト
	button.className = 'btn btn-sm uipath-visualizer-btn'; // GitHubのボタンスタイル + 識別クラス
	button.style.marginLeft = '8px'; // 左マージン
	button.addEventListener('click', showBlobVisualizer); // クリックイベント

	toolbar.appendChild(button); // ツールバーにボタンを追加
}

/**
 * 個別ファイルのビジュアライザーを表示
 */
async function showBlobVisualizer(): Promise<void> {
	try {
		const xamlContent = await fetchXamlContent(); // XAML内容を取得
		const parser = new XamlParser(); // パーサー初期化
		const workflowData = parser.parse(xamlContent); // XAML解析
		const lineIndex = XamlLineMapper.buildLineMap(xamlContent); // 行マップ構築

		displayBlobVisualizerPanel(workflowData, lineIndex); // パネル表示（行番号付き）
	} catch (error) {
		console.error('ビジュアライザー表示エラー:', error); // エラーログ
		alert('XAMLファイルの解析に失敗しました'); // アラート表示
	}
}

/**
 * XAMLファイルの内容を取得（Rawボタン経由）
 */
async function fetchXamlContent(): Promise<string> {
	const rawButton = document.querySelector('a[data-testid="raw-button"]') as HTMLAnchorElement; // Raw ボタン

	if (!rawButton) {
		throw new Error('Rawボタンが見つかりません'); // エラー
	}

	const rawUrl = rawButton.href; // Raw URL
	const response = await fetch(rawUrl); // HTTP リクエスト
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`); // エラー
	}

	return await response.text(); // テキストとして返す
}

/**
 * 個別ファイル用ビジュアライザーパネルを表示
 */
function displayBlobVisualizerPanel(workflowData: any, lineIndex?: ActivityLineIndex): void {
	// 既存パネルを削除
	const existingPanel = document.getElementById('uipath-visualizer-panel');
	if (existingPanel) existingPanel.remove();

	const panel = createPanel(); // パネル作成
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // コンテンツエリア

	// SequenceRendererでレンダリング
	const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
	seqRenderer.render(workflowData, contentArea, lineIndex); // 行番号付きでレンダリング

	document.body.appendChild(panel); // ページに追加
}

// ========== 初期化とMutationObserver ==========

/**
 * メイン初期化関数
 */
function init(): void {
	console.log('UiPath XAML Visualizer for GitHub が読み込まれました'); // ログ出力

	const pageType = detectPageType(); // ページタイプを検出

	switch (pageType) {
		case 'blob-xaml':
			addVisualizerButton(); // 個別ファイルページにボタン追加
			break;
		case 'pr-diff':
			scanAndInjectDiffButtons(); // PR diff ページにボタン注入
			break;
		default:
			break; // その他のページでは何もしない
	}
}

// ページロード時に初期化
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init); // DOMロード後に初期化
} else {
	init(); // すでにロード済みなら即座に初期化
}

// 現在のURLを記録
lastUrl = window.location.href;

// GitHub の SPA ナビゲーションに対応（デバウンス付きMutationObserver）
const observer = new MutationObserver(() => {
	// デバウンス: 300ms以内の連続変更をまとめる
	if (debounceTimer) clearTimeout(debounceTimer);

	debounceTimer = setTimeout(() => {
		const currentUrl = window.location.href; // 現在のURL

		if (currentUrl !== lastUrl) {
			// URL変更 → キャッシュクリアして再初期化
			cachedPrRefs = null; // PRキャッシュをクリア
			currentContext = null; // ビジュアライザーコンテキストをクリア
			lastUrl = currentUrl; // URLを更新
			init(); // 再初期化
		} else if (detectPageType() === 'pr-diff') {
			// 同一URLでDOM変更 → lazy-loaded diffsに対応してボタンを再スキャン
			scanAndInjectDiffButtons();
		}
	}, 300); // 300msデバウンス
});

observer.observe(document.body, {
	childList: true, // 子要素の変更を監視
	subtree: true    // サブツリーも監視
});
