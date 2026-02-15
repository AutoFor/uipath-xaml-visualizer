import { XamlParser, DiffCalculator, SequenceRenderer, XamlLineMapper, buildActivityKey } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ
import type { ActivityLineIndex } from '@uipath-xaml-visualizer/shared'; // 型定義
import '../../shared/styles/github-panel.css'; // パネル用スコープ付きスタイル

/**
 * GitHub上のXAMLファイルを視覚化するコンテンツスクリプト
 * - blob-xaml: 個別ファイル表示ページ
 * - pr-diff: PR差分ページ
 * - commit-diff: コミット差分ページ・Compareページ
 */

// ========== ビルド情報（webpackのDefinePluginで注入） ==========

declare const __BUILD_DATE__: string;  // ビルド日時
declare const __VERSION__: string;     // バージョン
declare const __BRANCH_NAME__: string; // ビルド時のブランチ名

// ========== 型定義 ==========

type PageType = 'blob-xaml' | 'pr-diff' | 'commit-diff' | 'unknown'; // ページタイプ

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
let syncAbortController: AbortController | null = null; // カーソル同期イベントリスナーの管理用
let searchMatches: HTMLElement[] = []; // 検索一致カードのリスト
let searchCurrentIndex: number = -1; // 現在フォーカス中の一致インデックス
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null; // 検索デバウンスタイマー

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

	if (/\/commit\/[a-f0-9]{7,40}/.test(url)) {
		return 'commit-diff'; // コミット差分ページ
	}

	if (/\/compare\//.test(url)) {
		return 'commit-diff'; // Compareページ（コミット差分と同じ扱い）
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
 * URLからリポジトリ情報を汎用的に抽出（PR以外のページでも使用可能）
 */
function parseRepoInfo(): { owner: string; repo: string } | null {
	const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/); // URLからowner/repoを抽出
	if (!match) return null;
	return { owner: match[1], repo: match[2] }; // リポジトリ情報を返す
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
 * コミットページ用のbase/head SHA取得（DOM抽出 → API フォールバック）
 */
async function fetchCommitRefs(owner: string, repo: string): Promise<PrRefs> {
	// 方法1: DOMからSHA抽出（hidden input等）
	const domRefs = extractShasFromDom(); // DOMから直接抽出
	if (domRefs) {
		console.log('UiPath Visualizer: コミットページ - DOMからSHA取得成功');
		return domRefs;
	}

	// 方法2: URLからコミットSHAを取得してGitHub APIで親コミットを取得
	const commitMatch = window.location.pathname.match(/\/commit\/([a-f0-9]{7,40})/); // URLからSHA抽出
	if (commitMatch) {
		const headSha = commitMatch[1]; // コミットSHA
		try {
			const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}`; // Commits API
			console.log(`UiPath Visualizer: コミットAPI fetch: ${apiUrl}`);
			const response = await fetch(apiUrl, {
				headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
			});
			if (response.ok) {
				const data = await response.json(); // レスポンスをパース
				if (data.parents && data.parents.length > 0) {
					const baseSha = data.parents[0].sha; // 親コミットSHA
					console.log(`UiPath Visualizer: コミットAPI - base=${baseSha}, head=${data.sha}`);
					return { baseSha, headSha: data.sha }; // フルSHAを使用
				}
			}
		} catch (e) {
			console.warn('UiPath Visualizer: コミットAPI失敗:', e);
		}
	}

	// 方法3: Compareページの場合、URLからブランチ/SHA情報を使用
	const compareMatch = window.location.pathname.match(/\/compare\/([^.]+)\.{2,3}(.+)/); // compare URLパターン
	if (compareMatch) {
		const baseRef = compareMatch[1]; // ベース参照
		const headRef = compareMatch[2]; // ヘッド参照
		console.log(`UiPath Visualizer: Compareページ - base=${baseRef}, head=${headRef}`);
		// refがSHAでない場合（ブランチ名の場合）APIで解決
		try {
			const [baseResponse, headResponse] = await Promise.all([
				fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${baseRef}`, {
					headers: { 'Accept': 'application/vnd.github.v3+json' }
				}),
				fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${headRef}`, {
					headers: { 'Accept': 'application/vnd.github.v3+json' }
				})
			]); // 両方のrefを解決
			if (baseResponse.ok && headResponse.ok) {
				const baseData = await baseResponse.json(); // ベースコミット
				const headData = await headResponse.json(); // ヘッドコミット
				console.log(`UiPath Visualizer: Compare API - base=${baseData.sha}, head=${headData.sha}`);
				return { baseSha: baseData.sha, headSha: headData.sha };
			}
		} catch (e) {
			console.warn('UiPath Visualizer: Compare API失敗:', e);
		}
	}

	throw new Error('コミットの base/head SHA を取得できません。コンソールログを確認してください。'); // エラー
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

// ========== 差分ページのDOM操作 ==========

/**
 * 差分ページをスキャンしてXAMLファイルにボタンを注入（PR・コミット・Compare共通）
 */
function scanAndInjectDiffButtons(onClick?: (filePath: string) => void): void {
	// GitHub差分ページで各ファイルのdivを取得
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
			(onClick || showDiffVisualizer)(filePath); // コールバックまたはデフォルトのPR用ビジュアライザーを呼び出し
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
			// 変更ファイル: フルワークフロー表示 + 差分ハイライト
			const beforeData = parser.parse(beforeXaml); // ベース版をパース
			const afterData = parser.parse(afterXaml);   // ヘッド版をパース

			const diffCalc = new DiffCalculator(); // 差分計算
			const diffResult = diffCalc.calculate(beforeData, afterData); // 差分を計算

			// 行番号マッピングを構築
			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // head側の行マップ

			// サマリーを表示
			const summaryHtml = createDiffSummary(diffResult); // サマリーHTML
			contentArea.innerHTML = ''; // クリア
			contentArea.appendChild(summaryHtml); // サマリーを追加

			// フルワークフローをレンダリング（head版）
			const seqContainer = document.createElement('div'); // シーケンスコンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, headLineIndex); // 全アクティビティをレンダリング
			contentArea.appendChild(seqContainer); // コンテンツに追加

			// 差分ハイライトをオーバーレイ適用
			applyDiffHighlights(seqContainer, diffResult); // 変更・追加・削除をハイライト

			// カーソル同期をセットアップ（Diff view）
			setupCursorSync(panel, headLineIndex, 'diff', filePath);

		} else if (afterXaml) {
			// 新規ファイル: after のみ表示
			const afterData = parser.parse(afterXaml); // パース
			const afterLineIndex = XamlLineMapper.buildLineMap(afterXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-new-file">新規ファイル</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, afterLineIndex); // 行番号付きでレンダリング
			contentArea.appendChild(seqContainer); // 追加

			// カーソル同期をセットアップ（新規ファイル → Blob view扱い）
			setupCursorSync(panel, afterLineIndex, 'blob');

		} else if (beforeXaml) {
			// 削除ファイル: before のみ表示
			const beforeData = parser.parse(beforeXaml); // パース
			const beforeLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-deleted-file">Deleted File</div>'; // ラベル
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
 * コミット差分ビジュアライザーを表示（コメント機能なし）
 */
async function showCommitDiffVisualizer(filePath: string): Promise<void> {
	// 既存パネルを削除
	const existingPanel = document.getElementById('uipath-visualizer-panel'); // 既存パネル
	if (existingPanel) existingPanel.remove();

	// ローディングパネルを表示
	const panel = createPanel(); // パネル作成
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // コンテンツエリア
	contentArea.innerHTML = '<div class="status-message">読み込み中...</div>'; // ローディング表示
	document.body.appendChild(panel); // ページに追加

	try {
		const repoInfo = parseRepoInfo(); // リポジトリ情報を取得
		if (!repoInfo) throw new Error('リポジトリ情報を取得できません');

		const refs = await fetchCommitRefs(repoInfo.owner, repoInfo.repo); // base/head SHAを取得

		// before/afterのXAMLを並列で取得
		const [beforeXaml, afterXaml] = await Promise.all([
			fetchRawContent(repoInfo.owner, repoInfo.repo, refs.baseSha, filePath), // ベース版
			fetchRawContent(repoInfo.owner, repoInfo.repo, refs.headSha, filePath)  // ヘッド版
		]);

		const parser = new XamlParser(); // パーサーを初期化

		if (beforeXaml && afterXaml) {
			// 変更ファイル: フルワークフロー表示 + 差分ハイライト
			const beforeData = parser.parse(beforeXaml); // ベース版をパース
			const afterData = parser.parse(afterXaml);   // ヘッド版をパース

			const diffCalc = new DiffCalculator(); // 差分計算
			const diffResult = diffCalc.calculate(beforeData, afterData); // 差分を計算

			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // head側の行マップ

			// サマリーを表示
			const summaryHtml = createDiffSummary(diffResult); // サマリーHTML
			contentArea.innerHTML = ''; // クリア
			contentArea.appendChild(summaryHtml); // サマリーを追加

			// フルワークフローをレンダリング（head版）
			const seqContainer = document.createElement('div'); // シーケンスコンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, headLineIndex); // 全アクティビティをレンダリング
			contentArea.appendChild(seqContainer); // コンテンツに追加

			// 差分ハイライトをオーバーレイ適用
			applyDiffHighlights(seqContainer, diffResult); // 変更・追加・削除をハイライト

			// カーソル同期をセットアップ（Diff view）
			setupCursorSync(panel, headLineIndex, 'diff', filePath);

		} else if (afterXaml) {
			// 新規ファイル: after のみ表示
			const afterData = parser.parse(afterXaml); // パース
			const afterLineIndex = XamlLineMapper.buildLineMap(afterXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-new-file">新規ファイル</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, afterLineIndex); // 行番号付きでレンダリング
			contentArea.appendChild(seqContainer); // 追加

			// カーソル同期をセットアップ（新規ファイル → Blob view扱い）
			setupCursorSync(panel, afterLineIndex, 'blob');

		} else if (beforeXaml) {
			// 削除ファイル: before のみ表示
			const beforeData = parser.parse(beforeXaml); // パース
			const beforeLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // 行マップ構築
			contentArea.innerHTML = '<div class="status-deleted-file">Deleted File</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(beforeData, seqContainer, beforeLineIndex); // 行番号付きでレンダリング
			contentArea.appendChild(seqContainer); // 追加

		} else {
			contentArea.innerHTML = '<div class="status-message">XAMLコンテンツが見つかりません</div>'; // エラー表示
		}

	} catch (error) {
		console.error('コミット差分ビジュアライザーエラー:', error); // エラーログ

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
 * 差分サマリーを作成
 */
function createDiffSummary(diffResult: any): HTMLElement {
	const summary = document.createElement('div'); // サマリー要素
	summary.className = 'diff-summary'; // クラス設定

	// 追加カード
	const addedCard = document.createElement('div'); // 追加カード
	addedCard.className = 'summary-card';
	addedCard.innerHTML = `
		<span class="summary-label">Added</span>
		<span class="count added">${diffResult.added.length}</span>
	`;

	// 削除カード
	const removedCard = document.createElement('div'); // 削除カード
	removedCard.className = 'summary-card';
	removedCard.innerHTML = `
		<span class="summary-label">Removed</span>
		<span class="count removed">${diffResult.removed.length}</span>
	`;

	// 変更カード
	const modifiedCard = document.createElement('div'); // 変更カード
	modifiedCard.className = 'summary-card';
	modifiedCard.innerHTML = `
		<span class="summary-label">Modified</span>
		<span class="count modified">${diffResult.modified.length}</span>
	`;

	summary.appendChild(addedCard);
	summary.appendChild(removedCard);
	summary.appendChild(modifiedCard);

	return summary;
}

// ========== カーソル同期（Visualizer ↔ GitHub） ==========

/**
 * GitHub側のハイライトスタイルをページに注入
 */
function injectSyncHighlightStyles(): void {
	if (document.getElementById('xaml-sync-styles')) return; // 既に注入済みならスキップ
	const style = document.createElement('style'); // スタイル要素
	style.id = 'xaml-sync-styles'; // 重複防止用ID
	style.textContent = `
		.xaml-sync-highlight {
			background-color: rgba(255, 165, 0, 0.25) !important;
			transition: background-color 0.5s ease-out;
		}
	`; // GitHub側コード行のハイライトスタイル
	document.head.appendChild(style); // ページに注入
}

/**
 * GitHub側の同期ハイライトを全除去
 */
function clearGithubHighlights(): void {
	document.querySelectorAll('.xaml-sync-highlight').forEach(el => {
		el.classList.remove('xaml-sync-highlight'); // ハイライトクラスを除去
	});
}

/**
 * Visualizer内カードのハイライトを全除去
 */
function clearVisualizerHighlights(panel: HTMLElement): void {
	panel.querySelectorAll('.activity-card.sync-highlighted').forEach(el => {
		el.classList.remove('sync-highlighted'); // ハイライトクラスを除去
	});
}

/**
 * Visualizer内のカードをハイライト＋スクロール（3秒後自動消去）
 */
function highlightVisualizerCard(panel: HTMLElement, activityKey: string): void {
	clearVisualizerHighlights(panel); // 前のハイライトを消去
	const card = panel.querySelector(`.activity-card[data-activity-key="${activityKey}"]`) as HTMLElement; // 対象カードを検索
	if (!card) return; // 見つからなければ何もしない
	card.classList.add('sync-highlighted'); // ハイライトクラスを追加
	card.scrollIntoView({ behavior: 'smooth', block: 'center' }); // カードにスクロール
	setTimeout(() => card.classList.remove('sync-highlighted'), 3000); // 3秒後にハイライト除去
}

/**
 * GitHub側の行をハイライト＋スクロール（2秒後自動消去）
 */
function highlightGithubLines(startLine: number, endLine: number, filePath?: string): void {
	clearGithubHighlights(); // 前のハイライトを消去

	if (filePath) {
		// Diff view: ファイルコンテナ内のtd.blob-numから該当行を検索
		const fileContainer = document.querySelector(`div.file[data-tagsearch-path="${filePath}"]`); // ファイルコンテナ
		if (!fileContainer) return;
		for (let line = startLine; line <= endLine; line++) {
			// diff viewの行番号セルを検索（data-line-number属性で特定）
			const lineNumCells = fileContainer.querySelectorAll(`td.blob-num[data-line-number="${line}"]`); // 行番号セル
			lineNumCells.forEach(cell => {
				const row = cell.closest('tr'); // 行要素を取得
				if (row) row.classList.add('xaml-sync-highlight'); // 行をハイライト
			});
		}
		// 最初のハイライト行にスクロール
		const firstHighlighted = fileContainer.querySelector('.xaml-sync-highlight') as HTMLElement;
		if (firstHighlighted) firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
	} else {
		// Blob view: document.getElementById('LC${lineNum}') で行要素を取得
		for (let line = startLine; line <= endLine; line++) {
			const lineEl = document.getElementById(`LC${line}`); // コード行要素
			if (lineEl) lineEl.classList.add('xaml-sync-highlight'); // ハイライト
		}
		// 中央の行にスクロール
		const midLine = Math.floor((startLine + endLine) / 2); // 中央行番号
		const scrollTarget = document.getElementById(`LC${midLine}`); // スクロール先
		if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// 2秒後にハイライト自動消去
	setTimeout(clearGithubHighlights, 2000);
}

/**
 * カーソル同期をセットアップ（双方向: Visualizer ↔ GitHub）
 */
function setupCursorSync(
	panel: HTMLElement,
	lineIndex: ActivityLineIndex,
	viewMode: 'blob' | 'diff',
	filePath?: string
): void {
	// 前のリスナーを全解除
	if (syncAbortController) syncAbortController.abort();
	syncAbortController = new AbortController(); // 新規AbortController
	const signal = syncAbortController.signal; // シグナル

	// === Direction 1: Visualizer → GitHub（行番号バッジクリック） ===
	panel.addEventListener('visualizer-line-click', ((e: CustomEvent) => {
		const { startLine, endLine } = e.detail; // クリックされた行範囲
		highlightGithubLines(startLine, endLine, viewMode === 'diff' ? filePath : undefined); // GitHub側をハイライト
	}) as EventListener, { signal }); // AbortControllerで管理

	// === Direction 2: GitHub → Visualizer（行番号クリック） ===
	if (viewMode === 'blob') {
		// Blob view: コードテーブルの行番号セルのクリックを監視（イベント委譲）
		const codeTable = document.querySelector('table.highlight') // コードテーブルを検索
			|| document.querySelector('.blob-code-content table') // フォールバック
			|| document.querySelector('.js-file-line-container'); // さらにフォールバック
		if (codeTable) {
			codeTable.addEventListener('click', (e: Event) => {
				const target = e.target as HTMLElement; // クリック対象
				const lineCell = target.closest('td[id]') as HTMLElement; // 行番号セルを検索
				if (!lineCell) return;
				const match = lineCell.id.match(/^L(\d+)$/); // id="L123" パターンにマッチ
				if (!match) return;
				const lineNum = parseInt(match[1], 10); // 行番号を取得
				const activityKey = lineIndex.lineToKey.get(lineNum); // 行番号からアクティビティキーを検索
				if (!activityKey) return; // マッピングなければ無視
				highlightVisualizerCard(panel, activityKey); // Visualizer側カードをハイライト
			}, { signal }); // AbortControllerで管理
		}
	} else {
		// Diff view: ファイルコンテナ内の行番号セルのクリックを監視
		const fileContainer = filePath
			? document.querySelector(`div.file[data-tagsearch-path="${filePath}"]`)
			: null; // ファイルコンテナ
		if (fileContainer) {
			fileContainer.addEventListener('click', (e: Event) => {
				const target = e.target as HTMLElement; // クリック対象
				const blobNumCell = target.closest('td.blob-num[data-line-number]') as HTMLElement; // 行番号セルを検索
				if (!blobNumCell) return;
				const lineNum = parseInt(blobNumCell.getAttribute('data-line-number') || '0', 10); // 行番号を取得
				if (!lineNum) return;
				const activityKey = lineIndex.lineToKey.get(lineNum); // 行番号からアクティビティキーを検索
				if (!activityKey) return; // マッピングなければ無視
				highlightVisualizerCard(panel, activityKey); // Visualizer側カードをハイライト
			}, { signal }); // AbortControllerで管理
		}
	}
}

// ========== 検索機能 ==========

/**
 * テキストノード内の一致部分を <mark> で囲んでハイライト
 */
function highlightTextInElement(el: HTMLElement, query: string): void {
	const lowerQuery = query.toLowerCase(); // 小文字化したクエリ
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); // テキストノードを走査
	const textNodes: Text[] = []; // テキストノードリスト
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text); // テキストノードを収集
	}
	for (const node of textNodes) {
		const text = node.textContent || ''; // テキスト内容
		const lowerText = text.toLowerCase(); // 小文字化
		const idx = lowerText.indexOf(lowerQuery); // 一致位置
		if (idx === -1) continue; // 一致なしならスキップ

		const before = text.substring(0, idx); // 一致前のテキスト
		const match = text.substring(idx, idx + query.length); // 一致テキスト
		const after = text.substring(idx + query.length); // 一致後のテキスト

		const mark = document.createElement('mark'); // <mark> 要素
		mark.className = 'search-highlight'; // ハイライトクラス
		mark.textContent = match; // 一致テキストを設定

		const parent = node.parentNode; // 親ノード
		if (!parent) continue;
		if (before) parent.insertBefore(document.createTextNode(before), node); // 一致前テキスト
		parent.insertBefore(mark, node); // <mark> 要素を挿入
		if (after) parent.insertBefore(document.createTextNode(after), node); // 一致後テキスト
		parent.removeChild(node); // 元のテキストノードを削除
	}
}

/**
 * 検索ハイライト（<mark>）をテキストノードに戻して結合
 */
function clearSearchHighlights(): void {
	const panel = document.getElementById('uipath-visualizer-panel'); // パネル取得
	if (!panel) return;

	// <mark> 要素をテキストノードに戻す
	panel.querySelectorAll('mark.search-highlight, mark.search-highlight-current').forEach(mark => {
		const parent = mark.parentNode; // 親ノード
		if (!parent) return;
		const textNode = document.createTextNode(mark.textContent || ''); // テキストノードに変換
		parent.replaceChild(textNode, mark); // 置換
		parent.normalize(); // 隣接テキストノードを結合
	});

	// 検索関連クラスを全除去
	panel.querySelectorAll('.activity-card.search-match, .activity-card.search-current, .activity-card.search-dimmed').forEach(el => {
		el.classList.remove('search-match', 'search-current', 'search-dimmed'); // クラス除去
	});
}

/**
 * 検索状態を完全にクリア
 */
function clearSearch(input: HTMLInputElement, countSpan: HTMLElement, prevBtn: HTMLButtonElement, nextBtn: HTMLButtonElement): void {
	clearSearchHighlights(); // ハイライトを除去
	searchMatches = []; // 一致リストをクリア
	searchCurrentIndex = -1; // インデックスをリセット
	input.value = ''; // 入力をクリア
	countSpan.textContent = ''; // カウント表示をクリア
	prevBtn.disabled = true; // ナビボタンを無効化
	nextBtn.disabled = true; // ナビボタンを無効化
}

/**
 * 現在の一致にフォーカスを更新（スクロール + カウント表示）
 */
function updateSearchFocus(countSpan: HTMLElement): void {
	// 前の search-current を解除
	const panel = document.getElementById('uipath-visualizer-panel'); // パネル取得
	if (panel) {
		panel.querySelectorAll('.activity-card.search-current').forEach(el => {
			el.classList.remove('search-current'); // 前のフォーカスを解除
		});
		panel.querySelectorAll('mark.search-highlight-current').forEach(mark => {
			mark.className = 'search-highlight'; // テキストハイライトも通常に戻す
		});
	}

	if (searchMatches.length === 0 || searchCurrentIndex < 0) {
		countSpan.textContent = ''; // カウント表示をクリア
		return;
	}

	const current = searchMatches[searchCurrentIndex]; // 現在の一致カード
	current.classList.add('search-current'); // フォーカスクラスを追加
	current.scrollIntoView({ behavior: 'smooth', block: 'center' }); // スクロール

	// 現在カード内の <mark> を強調
	const mark = current.querySelector('.activity-title mark.search-highlight'); // タイトル内のmark
	if (mark) mark.className = 'search-highlight-current'; // 強調クラスに変更

	countSpan.textContent = `${searchCurrentIndex + 1}/${searchMatches.length} 件`; // カウント表示を更新
}

/**
 * 一致リスト内を前/次に移動（循環）
 */
function navigateSearch(direction: 'prev' | 'next', countSpan: HTMLElement): void {
	if (searchMatches.length === 0) return; // 一致なしなら何もしない
	if (direction === 'next') {
		searchCurrentIndex = (searchCurrentIndex + 1) % searchMatches.length; // 次へ（循環）
	} else {
		searchCurrentIndex = (searchCurrentIndex - 1 + searchMatches.length) % searchMatches.length; // 前へ（循環）
	}
	updateSearchFocus(countSpan); // フォーカスを更新
}

/**
 * 検索を実行（パネル内の全 .activity-card を走査）
 */
function performSearch(query: string, countSpan: HTMLElement, prevBtn: HTMLButtonElement, nextBtn: HTMLButtonElement): void {
	clearSearchHighlights(); // 前の検索結果をクリア
	searchMatches = []; // 一致リストをリセット
	searchCurrentIndex = -1; // インデックスをリセット

	if (!query.trim()) {
		countSpan.textContent = ''; // カウント表示をクリア
		prevBtn.disabled = true; // ナビボタンを無効化
		nextBtn.disabled = true; // ナビボタンを無効化
		return;
	}

	const panel = document.getElementById('uipath-visualizer-panel'); // パネル取得
	if (!panel) return;

	const lowerQuery = query.toLowerCase(); // 小文字化したクエリ
	const allCards = Array.from(panel.querySelectorAll('.activity-card')) as HTMLElement[]; // 全カード

	// 各カードの一致/非一致を判定
	const matchedCards = new Set<HTMLElement>(); // 一致カードセット
	for (const card of allCards) {
		const titleEl = card.querySelector(':scope > .activity-header > .activity-title') as HTMLElement; // タイトル要素（直接の子のみ）
		if (!titleEl) continue;
		const titleText = titleEl.textContent || ''; // タイトルテキスト
		if (titleText.toLowerCase().includes(lowerQuery)) {
			matchedCards.add(card); // 一致カードに追加
		}
	}

	// 一致カードの祖先カードもディム解除対象に追加
	const undimmedCards = new Set<HTMLElement>(matchedCards); // ディム解除カードセット
	for (const card of matchedCards) {
		let parent = card.parentElement; // 親要素を取得
		while (parent) {
			const ancestorCard = parent.closest('.activity-card') as HTMLElement; // 祖先カードを検索
			if (ancestorCard && ancestorCard !== card) {
				undimmedCards.add(ancestorCard); // 祖先カードをディム解除
				parent = ancestorCard.parentElement; // さらに上の祖先を検索
			} else {
				break; // パネル外に出たら終了
			}
		}
	}

	// クラスを付与
	for (const card of allCards) {
		if (matchedCards.has(card)) {
			card.classList.add('search-match'); // 一致カード
			searchMatches.push(card); // 一致リストに追加
			// タイトル内のテキストをハイライト
			const titleEl = card.querySelector(':scope > .activity-header > .activity-title') as HTMLElement;
			if (titleEl) highlightTextInElement(titleEl, query); // テキストハイライト
		} else if (!undimmedCards.has(card)) {
			card.classList.add('search-dimmed'); // 非一致かつ祖先でもないカード
		}
	}

	// ナビボタンの有効/無効
	const hasMatches = searchMatches.length > 0; // 一致があるか
	prevBtn.disabled = !hasMatches; // 前ボタン
	nextBtn.disabled = !hasMatches; // 次ボタン

	if (hasMatches) {
		searchCurrentIndex = 0; // 最初の一致にフォーカス
		updateSearchFocus(countSpan); // フォーカスを更新
	} else {
		countSpan.textContent = '0 件'; // 一致なし表示
	}
}

/**
 * 検索バーを作成
 */
function createSearchBar(): HTMLElement {
	const bar = document.createElement('div'); // 検索バーコンテナ
	bar.className = 'panel-search-bar'; // CSSクラス

	const input = document.createElement('input'); // 検索入力フィールド
	input.type = 'text'; // テキスト入力
	input.className = 'panel-search-input'; // CSSクラス
	input.placeholder = 'DisplayName で検索...'; // プレースホルダー

	const countSpan = document.createElement('span'); // 一致件数表示
	countSpan.className = 'panel-search-count'; // CSSクラス

	const prevBtn = document.createElement('button'); // 前ボタン
	prevBtn.className = 'panel-search-nav-btn'; // CSSクラス
	prevBtn.textContent = '\u25B2'; // ▲
	prevBtn.title = '前の一致 (Shift+Enter)'; // ツールチップ
	prevBtn.disabled = true; // 初期状態は無効

	const nextBtn = document.createElement('button'); // 次ボタン
	nextBtn.className = 'panel-search-nav-btn'; // CSSクラス
	nextBtn.textContent = '\u25BC'; // ▼
	nextBtn.title = '次の一致 (Enter)'; // ツールチップ
	nextBtn.disabled = true; // 初期状態は無効

	const clearBtn = document.createElement('button'); // クリアボタン
	clearBtn.className = 'panel-search-clear-btn'; // CSSクラス
	clearBtn.textContent = '\u2715'; // ✕
	clearBtn.title = 'クリア (Escape)'; // ツールチップ

	// 入力イベント: 250ms デバウンスで検索実行
	input.addEventListener('input', () => {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer); // 前のタイマーをクリア
		searchDebounceTimer = setTimeout(() => {
			performSearch(input.value, countSpan, prevBtn, nextBtn); // 検索実行
		}, 250); // 250msデバウンス
	});

	// キーボードイベント: Enter/Shift+Enter で前/次ナビゲーション、Escape でクリア
	input.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault(); // デフォルト動作を防止
			if (e.shiftKey) {
				navigateSearch('prev', countSpan); // Shift+Enter: 前へ
			} else {
				navigateSearch('next', countSpan); // Enter: 次へ
			}
		} else if (e.key === 'Escape') {
			clearSearch(input, countSpan, prevBtn, nextBtn); // Escape: クリア
			input.blur(); // フォーカスを外す
		}
	});

	// ナビボタンクリック
	prevBtn.addEventListener('click', () => navigateSearch('prev', countSpan)); // 前へ
	nextBtn.addEventListener('click', () => navigateSearch('next', countSpan)); // 次へ

	// クリアボタンクリック
	clearBtn.addEventListener('click', () => clearSearch(input, countSpan, prevBtn, nextBtn)); // クリア

	bar.appendChild(input); // 入力フィールド追加
	bar.appendChild(countSpan); // カウント表示追加
	bar.appendChild(prevBtn); // 前ボタン追加
	bar.appendChild(nextBtn); // 次ボタン追加
	bar.appendChild(clearBtn); // クリアボタン追加

	return bar;
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
	closeButton.addEventListener('click', () => {
		clearGithubHighlights(); // GitHub側ハイライトをクリア
		syncAbortController?.abort(); // カーソル同期リスナーを全解除
		syncAbortController = null; // 参照をクリア
		searchMatches = []; // 検索一致リストをクリア
		searchCurrentIndex = -1; // 検索インデックスをリセット
		panel.remove(); // パネルを削除
	});

	/**
	 * パネル関連のCSSルールを抽出し、CSS変数を実値に解決して返す
	 */
	function extractPanelCss(): string {
		const rules: string[] = []; // 収集したCSSルール
		const panel = document.getElementById('uipath-visualizer-panel'); // CSS変数解決用のパネル要素
		const computedStyle = panel ? getComputedStyle(panel) : null; // パネルの計算済みスタイル

		for (const sheet of Array.from(document.styleSheets)) { // 全スタイルシートを走査
			let cssRules: CSSRuleList;
			try {
				cssRules = sheet.cssRules; // ルール一覧を取得
			} catch {
				continue; // クロスオリジンのスタイルシートはスキップ
			}
			for (const rule of Array.from(cssRules)) { // 各ルールを走査
				if (rule.cssText.includes('uipath-visualizer-panel')) { // パネル関連のルールのみ収集
					let text = rule.cssText; // ルールテキスト
					if (computedStyle) { // CSS変数を実値に解決
						text = text.replace(/var\(--([^)]+)\)/g, (_match, varName) => {
							return computedStyle.getPropertyValue(`--${varName}`).trim() || _match; // 変数値を取得、なければ元のまま
						});
					}
					rules.push(text); // 解決済みルールを追加
				}
			}
		}
		return rules.join('\n'); // 改行区切りで結合
	}

	// Copy HTMLボタン（デバッグ用）
	const copyHtmlButton = document.createElement('button'); // コピーボタン
	copyHtmlButton.textContent = 'Copy HTML'; // ボタンテキスト
	copyHtmlButton.className = 'btn btn-sm panel-copy-btn'; // スタイル適用
	copyHtmlButton.addEventListener('click', () => { // クリックイベント
		const originalText = copyHtmlButton.textContent; // 元のテキストを保存
		const css = extractPanelCss(); // パネル関連CSSを抽出
		const fullHtml = `<style>\n${css}\n</style>\n<div id="uipath-visualizer-panel"><div class="panel-content">\n${content.innerHTML}\n</div></div>`; // CSSとパネル構造を含む完全なHTML
		navigator.clipboard.writeText(fullHtml) // CSS付きHTMLをクリップボードにコピー
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
	const searchBar = createSearchBar(); // 検索バーを作成
	panel.appendChild(searchBar); // 検索バーを追加
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

	// カーソル同期をセットアップ（Blob view）
	if (lineIndex) {
		setupCursorSync(panel, lineIndex, 'blob'); // 双方向同期を有効化
	}
}

// ========== 全XAMLファイルビジュアライゼーション ==========

/**
 * リポジトリ内の全XAMLファイル一覧を取得
 */
async function fetchAllXamlFiles(owner: string, repo: string, sha: string): Promise<string[]> {
	// 方法1: GitHub同一オリジンのtree-list API（プライベートリポジトリ対応）
	try {
		const treeListUrl = `https://github.com/${owner}/${repo}/tree-list/${sha}`; // ツリーリストURL
		const response = await fetch(treeListUrl, { credentials: 'same-origin' }); // Cookie付きリクエスト
		if (response.ok) {
			const text = await response.text(); // レスポンステキスト
			const paths = text.split('\n').filter(p => p.endsWith('.xaml')); // .xamlファイルのみフィルタ
			if (paths.length > 0) {
				console.log(`UiPath Visualizer: tree-list APIから${paths.length}個のXAMLファイルを取得`);
				return paths;
			}
		}
	} catch (e) {
		console.warn('UiPath Visualizer: tree-list API失敗、Trees APIにフォールバック:', e);
	}

	// 方法2: GitHub REST API Trees（パブリックリポジトリ用フォールバック）
	try {
		const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`; // Trees API URL
		const response = await fetch(apiUrl, {
			headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
		});
		if (response.ok) {
			const data = await response.json(); // レスポンスをパース
			const paths = (data.tree as Array<{ path: string; type: string }>)
				.filter(item => item.type === 'blob' && item.path.endsWith('.xaml')) // .xamlファイルのみ
				.map(item => item.path); // パスのみ抽出
			console.log(`UiPath Visualizer: Trees APIから${paths.length}個のXAMLファイルを取得`);
			return paths;
		}
	} catch (e) {
		console.warn('UiPath Visualizer: Trees API失敗:', e);
	}

	return []; // 取得失敗時は空配列
}

/**
 * PR差分ページのDOMから変更されたXAMLファイル一覧を取得
 */
function getChangedXamlFiles(): Set<string> {
	const changedFiles = new Set<string>(); // 変更ファイルセット
	const fileContainers = document.querySelectorAll('div.file[data-tagsearch-path]'); // ファイルコンテナ
	fileContainers.forEach(container => {
		const filePath = container.getAttribute('data-tagsearch-path'); // ファイルパス
		if (filePath && filePath.endsWith('.xaml')) {
			changedFiles.add(filePath); // XAMLファイルをセットに追加
		}
	});
	return changedFiles;
}

/**
 * PR diff ページに「View All Workflows」ボタンを注入
 */
function injectAllWorkflowsButton(): void {
	// 既にボタンが追加済みかチェック
	if (document.querySelector('.uipath-all-workflows-btn')) return; // 重複防止

	// PR diff ページのツールバーを探す
	const toolbar = document.querySelector('.pr-review-tools, .diffbar, .js-diff-progressive-container')?.closest('.pr-review-tools')
		|| document.querySelector('#files_bucket .pr-toolbar')
		|| document.querySelector('.diffbar-item.d-flex'); // ツールバー候補

	// ツールバーが見つからない場合はファイルバケットの先頭に追加
	const insertTarget = toolbar || document.querySelector('#files_bucket'); // 挿入先

	if (!insertTarget) return; // 挿入先が見つからない場合はスキップ

	const button = document.createElement('button'); // ボタン要素
	button.textContent = 'View All Workflows'; // ボタンテキスト
	button.className = 'btn btn-sm uipath-all-workflows-btn'; // GitHubスタイル + 識別クラス
	button.addEventListener('click', (e) => {
		e.preventDefault(); // デフォルト動作を防止
		e.stopPropagation(); // イベント伝播を停止
		showAllWorkflowsVisualizer(); // 全ワークフロービジュアライザーを表示
	});

	if (toolbar) {
		toolbar.appendChild(button); // ツールバーにボタンを追加
	} else {
		insertTarget.insertBefore(button, insertTarget.firstChild); // ファイルバケットの先頭に追加
	}
}

/**
 * 全ワークフロービジュアライザーのメインオーケストレーター
 */
async function showAllWorkflowsVisualizer(): Promise<void> {
	// 既存パネルを削除
	const existingPanel = document.getElementById('uipath-visualizer-panel'); // 既存パネル
	if (existingPanel) existingPanel.remove();

	// ローディングパネルを表示
	const panel = createPanel(); // パネル作成
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // コンテンツエリア
	contentArea.innerHTML = '<div class="status-message">全XAMLファイルを読み込み中...</div>'; // ローディング表示
	document.body.appendChild(panel); // ページに追加

	try {
		const pr = parsePrUrl(); // PR情報を取得
		if (!pr) throw new Error('PR情報を取得できません');

		// base/head SHAを取得
		const refs = await fetchPrRefs(pr); // base/head SHAを取得

		// 全XAMLファイルリストと変更ファイルリストを並行取得
		const [allFiles, changedFiles] = await Promise.all([
			fetchAllXamlFiles(pr.owner, pr.repo, refs.headSha), // head SHA のツリーから全ファイル取得
			Promise.resolve(getChangedXamlFiles()) // DOMから変更ファイル取得
		]);

		if (allFiles.length === 0) {
			contentArea.innerHTML = '<div class="status-message">XAMLファイルが見つかりません</div>'; // ファイルなし表示
			return;
		}

		// base側にも存在するがhead側に存在しない（削除された）ファイルを検出
		const baseFiles = await fetchAllXamlFiles(pr.owner, pr.repo, refs.baseSha); // base側の全ファイル
		const headFileSet = new Set(allFiles); // head側ファイルセット
		const deletedFiles = baseFiles.filter(f => !headFileSet.has(f)); // 削除ファイル

		// 全ファイル = head側の全ファイル + 削除ファイル
		const combinedFiles = [...allFiles, ...deletedFiles]; // 全ファイルリスト

		// ファイルを分類してソート（変更ファイル先頭、次に未変更）
		const sortedFiles = combinedFiles.sort((a, b) => {
			const aChanged = changedFiles.has(a); // aが変更ファイルか
			const bChanged = changedFiles.has(b); // bが変更ファイルか
			if (aChanged !== bChanged) return aChanged ? -1 : 1; // 変更ファイルを先頭に
			return a.localeCompare(b); // アルファベット順
		});

		// サマリーを表示
		const changedCount = changedFiles.size; // 変更ファイル数
		const unchangedCount = combinedFiles.length - changedCount; // 未変更ファイル数
		contentArea.innerHTML = ''; // クリア

		const summary = document.createElement('div'); // サマリー要素
		summary.className = 'all-workflows-summary'; // CSSクラス
		summary.innerHTML = `
			<span>XAML Files: <strong>${combinedFiles.length}</strong></span>
			<span>Changed: <strong>${changedCount}</strong></span>
			<span>Unchanged: <strong>${unchangedCount}</strong></span>
		`; // サマリーHTML
		contentArea.appendChild(summary); // サマリーを追加

		// 各ファイルのアコーディオンセクションを作成
		for (const filePath of sortedFiles) {
			const isChanged = changedFiles.has(filePath); // 変更ファイルか
			const isDeleted = deletedFiles.includes(filePath); // 削除ファイルか
			const isNew = isChanged && !baseFiles.includes(filePath); // 新規ファイルか（変更かつbase側に存在しない）
			const section = createFileAccordionSection(filePath, isChanged, isNew, isDeleted, pr, refs); // アコーディオン作成
			contentArea.appendChild(section); // コンテンツに追加
		}

	} catch (error) {
		console.error('全ワークフロービジュアライザーエラー:', error); // エラーログ
		contentArea.innerHTML = `
			<div class="error-message">
				<div class="error-title">エラー: ${(error as Error).message}</div>
			</div>`; // エラー表示
	}
}

/**
 * ファイル用アコーディオンセクションを作成（遅延読み込み対応）
 */
function createFileAccordionSection(
	filePath: string,
	isChanged: boolean,
	isNew: boolean,
	isDeleted: boolean,
	pr: PrInfo,
	refs: PrRefs
): HTMLElement {
	const section = document.createElement('div'); // セクション要素
	// ファイル状態に応じたCSSクラスを設定
	let statusClass = 'file-unchanged'; // デフォルトは未変更
	let badgeClass = 'badge-unchanged'; // デフォルトバッジ
	let badgeText = 'Unchanged'; // デフォルトバッジテキスト
	if (isNew) {
		statusClass = 'file-new'; // 新規ファイル
		badgeClass = 'badge-new';
		badgeText = 'New';
	} else if (isDeleted) {
		statusClass = 'file-deleted'; // 削除ファイル
		badgeClass = 'badge-deleted';
		badgeText = 'Deleted';
	} else if (isChanged) {
		statusClass = 'file-changed'; // 変更ファイル
		badgeClass = 'badge-modified';
		badgeText = 'Changed';
	}
	section.className = `file-accordion-section ${statusClass}`; // CSSクラス

	// ヘッダー部分
	const header = document.createElement('div'); // ヘッダー要素
	header.className = 'file-accordion-header'; // CSSクラス

	const icon = document.createElement('span'); // 開閉アイコン
	icon.className = 'accordion-icon'; // CSSクラス
	icon.textContent = '\u25B6'; // ▶（閉じた状態）

	const pathSpan = document.createElement('span'); // ファイルパス表示
	pathSpan.className = 'file-path'; // CSSクラス
	pathSpan.textContent = filePath; // ファイルパス
	pathSpan.title = filePath; // ツールチップ（省略時に全パス表示）

	const badge = document.createElement('span'); // ステータスバッジ
	badge.className = `badge-file-status ${badgeClass}`; // CSSクラス
	badge.textContent = badgeText; // バッジテキスト

	header.appendChild(icon);
	header.appendChild(pathSpan);
	header.appendChild(badge);

	// コンテンツ部分
	const content = document.createElement('div'); // コンテンツ要素
	content.className = 'file-accordion-content'; // CSSクラス

	let loaded = false; // 読み込み済みフラグ

	// ヘッダークリックで開閉
	header.addEventListener('click', () => {
		const isExpanded = section.classList.toggle('expanded'); // 開閉トグル
		if (isExpanded && !loaded) {
			loaded = true; // 読み込み済みに設定
			loadFileContent(content, filePath, isChanged, isNew, isDeleted, pr, refs); // コンテンツを遅延読み込み
		}
	});

	section.appendChild(header);
	section.appendChild(content);

	return section;
}

/**
 * アコーディオンセクション内にファイル内容を読み込んでレンダリング
 */
async function loadFileContent(
	container: HTMLElement,
	filePath: string,
	isChanged: boolean,
	isNew: boolean,
	isDeleted: boolean,
	pr: PrInfo,
	refs: PrRefs
): Promise<void> {
	container.innerHTML = '<div class="accordion-loading">読み込み中...</div>'; // ローディング表示

	try {
		const parser = new XamlParser(); // パーサーを初期化

		if (isDeleted) {
			// 削除ファイル: before のみ表示
			const beforeXaml = await fetchRawContent(pr.owner, pr.repo, refs.baseSha, filePath); // ベース版取得
			if (!beforeXaml) {
				container.innerHTML = '<div class="accordion-error">ファイル内容を取得できません</div>'; // エラー表示
				return;
			}
			const beforeData = parser.parse(beforeXaml); // パース
			const lineIndex = XamlLineMapper.buildLineMap(beforeXaml); // 行マップ構築
			container.innerHTML = '<div class="status-deleted-file">Deleted File</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(beforeData, seqContainer, lineIndex); // レンダリング
			container.appendChild(seqContainer); // 追加

		} else if (isNew) {
			// 新規ファイル: after のみ表示
			const afterXaml = await fetchRawContent(pr.owner, pr.repo, refs.headSha, filePath); // ヘッド版取得
			if (!afterXaml) {
				container.innerHTML = '<div class="accordion-error">ファイル内容を取得できません</div>'; // エラー表示
				return;
			}
			const afterData = parser.parse(afterXaml); // パース
			const lineIndex = XamlLineMapper.buildLineMap(afterXaml); // 行マップ構築
			container.innerHTML = '<div class="status-new-file">New File</div>'; // ラベル
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, lineIndex); // レンダリング
			container.appendChild(seqContainer); // 追加

		} else if (isChanged) {
			// 変更ファイル: フルワークフロー表示 + 差分ハイライト
			const [beforeXaml, afterXaml] = await Promise.all([
				fetchRawContent(pr.owner, pr.repo, refs.baseSha, filePath), // ベース版
				fetchRawContent(pr.owner, pr.repo, refs.headSha, filePath)  // ヘッド版
			]);

			const beforeData = parser.parse(beforeXaml); // ベース版をパース
			const afterData = parser.parse(afterXaml);   // ヘッド版をパース

			const diffCalc = new DiffCalculator(); // 差分計算
			const diffResult = diffCalc.calculate(beforeData, afterData); // 差分を計算

			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // head側の行マップ

			// サマリーを表示
			const summaryHtml = createDiffSummary(diffResult); // サマリーHTML
			container.innerHTML = ''; // クリア
			container.appendChild(summaryHtml); // サマリーを追加

			// フルワークフローをレンダリング（head版）
			const seqContainer = document.createElement('div'); // シーケンスコンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, headLineIndex); // 全アクティビティをレンダリング
			container.appendChild(seqContainer); // コンテンツに追加

			// 差分ハイライトをオーバーレイ適用
			applyDiffHighlights(seqContainer, diffResult); // 変更・追加・削除をハイライト

		} else {
			// 未変更ファイル: head のコンテンツを表示
			const afterXaml = await fetchRawContent(pr.owner, pr.repo, refs.headSha, filePath); // ヘッド版取得
			if (!afterXaml) {
				container.innerHTML = '<div class="accordion-error">ファイル内容を取得できません</div>'; // エラー表示
				return;
			}
			const afterData = parser.parse(afterXaml); // パース
			const lineIndex = XamlLineMapper.buildLineMap(afterXaml); // 行マップ構築
			container.innerHTML = ''; // クリア
			const seqContainer = document.createElement('div'); // コンテナ
			const seqRenderer = new SequenceRenderer(); // シーケンスレンダラー
			seqRenderer.render(afterData, seqContainer, lineIndex); // レンダリング
			container.appendChild(seqContainer); // 追加
		}

	} catch (error) {
		console.error(`ファイル読み込みエラー (${filePath}):`, error); // エラーログ
		container.innerHTML = `<div class="accordion-error">読み込みエラー: ${(error as Error).message}</div>`; // エラー表示
	}
}

/**
 * フルワークフロー上に差分ハイライトを適用（data-activity-keyで照合）
 */
function applyDiffHighlights(container: HTMLElement, diffResult: any): void {
	// 変更アクティビティをハイライト
	for (const item of diffResult.modified) {
		const key = buildActivityKey(item.activity, 0); // キーを生成（IdRef優先）
		const card = container.querySelector(`[data-activity-key="${key}"]`) as HTMLElement; // カードを検索
		if (!card) continue;
		card.classList.add('diff-highlight-modified'); // 変更ハイライトクラスを追加

		// プロパティ変更の詳細を注入
		if (item.changes && item.changes.length > 0) {
			const changesDiv = document.createElement('div'); // 変更詳細コンテナ
			changesDiv.className = 'diff-highlight-changes'; // CSSクラス
			for (const change of item.changes) {
				const changeItem = document.createElement('div'); // 個別変更要素
				changeItem.className = 'property-change-item'; // CSSクラス

				const propName = document.createElement('span'); // プロパティ名
				propName.className = 'prop-name'; // CSSクラス
				propName.textContent = `${change.propertyName}:`; // プロパティ名テキスト
				changeItem.appendChild(propName);

				const beforeDiv = document.createElement('div'); // 変更前の値
				beforeDiv.className = 'diff-before'; // CSSクラス
				beforeDiv.textContent = `- ${String(change.before ?? '(なし)')}`; // 変更前テキスト
				changeItem.appendChild(beforeDiv);

				const afterDiv = document.createElement('div'); // 変更後の値
				afterDiv.className = 'diff-after'; // CSSクラス
				afterDiv.textContent = `+ ${String(change.after ?? '(なし)')}`; // 変更後テキスト
				changeItem.appendChild(afterDiv);

				changesDiv.appendChild(changeItem); // 変更詳細に追加
			}
			// activity-header の後に挿入
			const header = card.querySelector(':scope > .activity-header'); // ヘッダー要素
			if (header && header.nextSibling) {
				card.insertBefore(changesDiv, header.nextSibling); // ヘッダーの直後に挿入
			} else {
				card.appendChild(changesDiv); // フォールバック: カード末尾に追加
			}
		}
	}

	// 追加アクティビティをハイライト
	for (const item of diffResult.added) {
		const key = buildActivityKey(item.activity, 0); // キーを生成
		const card = container.querySelector(`[data-activity-key="${key}"]`) as HTMLElement; // カードを検索
		if (!card) continue;
		card.classList.add('diff-highlight-added'); // 追加ハイライトクラスを追加
	}

	// 削除アクティビティを末尾に表示（head版には存在しないため）
	if (diffResult.removed.length > 0) {
		const removedSection = document.createElement('div'); // 削除セクション
		removedSection.className = 'removed-activities-section'; // CSSクラス

		const removedLabel = document.createElement('div'); // 削除ラベル
		removedLabel.className = 'status-deleted-file'; // CSSクラス
		removedLabel.textContent = `Removed Activities (${diffResult.removed.length})`; // ラベルテキスト
		removedSection.appendChild(removedLabel);

		for (const item of diffResult.removed) {
			const card = document.createElement('div'); // 削除カード
			card.className = 'activity-card diff-highlight-removed'; // CSSクラス

			const header = document.createElement('div'); // ヘッダー
			header.className = 'activity-header'; // CSSクラス

			const title = document.createElement('span'); // タイトル
			title.className = 'activity-title'; // CSSクラス
			title.textContent = `${item.activity.type}: ${item.activity.displayName} `; // アクティビティ名

			const badge = document.createElement('span'); // バッジ
			badge.className = 'badge badge-removed'; // CSSクラス
			badge.textContent = '- Removed'; // バッジテキスト
			title.appendChild(badge);

			header.appendChild(title);
			card.appendChild(header);
			removedSection.appendChild(card); // セクションに追加
		}
		container.appendChild(removedSection); // コンテナに追加
	}
}

// ========== 初期化とMutationObserver ==========

/**
 * メイン初期化関数
 */
function init(): void {
	console.log('UiPath XAML Visualizer for GitHub が読み込まれました'); // ログ出力
	injectSyncHighlightStyles(); // GitHub側ハイライト用CSSを注入

	const pageType = detectPageType(); // ページタイプを検出

	switch (pageType) {
		case 'blob-xaml':
			addVisualizerButton(); // 個別ファイルページにボタン追加
			break;
		case 'pr-diff':
			scanAndInjectDiffButtons(); // PR diff ページにボタン注入
			injectAllWorkflowsButton(); // 全ワークフローボタンを注入
			break;
		case 'commit-diff':
			scanAndInjectDiffButtons(showCommitDiffVisualizer); // コミット/Compare差分ページにボタン注入
			break;
		default:
			break; // その他のページでは何もしない
	}
}

// Ctrl+F (Mac: Cmd+F) で検索入力にフォーカス
document.addEventListener('keydown', (e: KeyboardEvent) => {
	if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
		const panel = document.getElementById('uipath-visualizer-panel'); // パネルの存在チェック
		if (!panel) return; // パネルがなければブラウザデフォルトに任せる
		const searchInput = panel.querySelector('.panel-search-input') as HTMLInputElement; // 検索入力要素
		if (!searchInput) return;
		e.preventDefault(); // ブラウザデフォルトの検索を抑止
		searchInput.focus(); // フォーカスを設定
		searchInput.select(); // テキストを全選択
	}
});

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
			lastUrl = currentUrl; // URLを更新
			init(); // 再初期化
		} else {
			// 同一URLでDOM変更 → lazy-loaded diffsに対応してボタンを再スキャン
			const currentPageType = detectPageType(); // 現在のページタイプ
			if (currentPageType === 'pr-diff') {
				scanAndInjectDiffButtons(); // PR差分ページ
			} else if (currentPageType === 'commit-diff') {
				scanAndInjectDiffButtons(showCommitDiffVisualizer); // コミット/Compare差分ページ
			}
		}
	}, 300); // 300msデバウンス
});

observer.observe(document.body, {
	childList: true, // 子要素の変更を監視
	subtree: true    // サブツリーも監視
});
