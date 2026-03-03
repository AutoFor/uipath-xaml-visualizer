import { XamlParser, DiffCalculator, SequenceRenderer, XamlLineMapper, buildActivityKey, setLanguage, getLanguage, t, categorizeDiffChanges } from '@uipath-xaml-visualizer/shared'; // shared library
import type { ActivityLineIndex, ScreenshotPathResolver, Language } from '@uipath-xaml-visualizer/shared'; // type definitions
import '../../shared/styles/github-panel.css'; // scoped styles for the panel

/**
 * Content script that visualizes XAML files on GitHub
 * - blob-xaml: individual file view page
 * - pr-diff: PR diff page
 * - commit-diff: commit diff page and Compare page
 */

// ========== Build info (injected by webpack DefinePlugin) ==========

declare const __BUILD_DATE__: string;  // build timestamp
declare const __VERSION__: string;     // version
declare const __BRANCH_NAME__: string; // branch name at build time

// ========== Type definitions ==========

type PageType = 'blob-xaml' | 'pr-diff' | 'commit-diff' | 'unknown'; // page type

interface PrInfo {
	owner: string;   // repository owner
	repo: string;    // repository name
	prNumber: number; // PR number
}

interface PrRefs {
	baseSha: string; // base branch SHA
	headSha: string; // head branch SHA
}

// ========== Module-level cache ==========

let cachedPrRefs: PrRefs | null = null; // PR refs cache (API called only once per PR)
let lastUrl: string = ''; // previous URL (for URL change detection)
let debounceTimer: ReturnType<typeof setTimeout> | null = null; // debounce timer
let syncAbortController: AbortController | null = null; // manages cursor sync event listeners
let searchMatches: HTMLElement[] = []; // list of matched search cards
let searchCurrentIndex: number = -1; // index of the currently focused match
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null; // search debounce timer
let originalBodyMarginRight: string = ''; // body marginRight before panel is shown
let originalBodyOverflowX: string = ''; // body overflowX before panel is shown

// ========== Re-render context for language switching ==========

type RenderContext =
	| { type: 'blob'; workflowData: any; lineIndex?: ActivityLineIndex; screenshotResolver?: ScreenshotPathResolver } // individual file view
	| { type: 'diff'; filePath: string } // PR diff view
	| { type: 'commit-diff'; filePath: string }; // commit diff view

let lastRenderContext: RenderContext | null = null; // last render context

/**
 * Loads the language preference from chrome.storage.sync
 */
async function loadLanguagePreference(): Promise<void> {
	try {
		const result = await chrome.storage.sync.get('language'); // retrieve from storage
		if (result.language) {
			setLanguage(result.language as Language); // set language
		}
	} catch (e) {
		console.warn('UiPath Visualizer: Failed to load language preference:', e); // error log
	}
}

/**
 * Saves the language preference to chrome.storage.sync
 */
async function saveLanguagePreference(lang: Language): Promise<void> {
	try {
		await chrome.storage.sync.set({ language: lang }); // save to storage
	} catch (e) {
		console.warn('UiPath Visualizer: Failed to save language preference:', e); // error log
	}
}

/**
 * Re-renders the current panel after a language switch
 */
function reRenderCurrentPanel(): void {
	if (!lastRenderContext) return; // do nothing if no context

	switch (lastRenderContext.type) {
		case 'blob':
			displayBlobVisualizerPanel(
				lastRenderContext.workflowData,
				lastRenderContext.lineIndex,
				lastRenderContext.screenshotResolver
			); // re-render individual file view
			break;
		case 'diff':
			showDiffVisualizer(lastRenderContext.filePath); // re-render PR diff
			break;
		case 'commit-diff':
			showCommitDiffVisualizer(lastRenderContext.filePath); // re-render commit diff
			break;
	}
}

// ========== Page type detection ==========

/**
 * Detects the type of the current page
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/GitHub-Extension#page-type-detection
 */
function detectPageType(): PageType {
	const url = window.location.href; // current URL

	if (url.includes('.xaml')) {
		return 'blob-xaml'; // individual XAML file page
	}

	if (/\/pull\/\d+\/files/.test(url)) {
		return 'pr-diff'; // PR diff page
	}

	if (/\/commit\/[a-f0-9]{7,40}/.test(url)) {
		return 'commit-diff'; // commit diff page
	}

	if (/\/compare\//.test(url)) {
		return 'commit-diff'; // Compare page (treated same as commit diff)
	}

	return 'unknown'; // any other page
}

// ========== Debug info collection ==========

/**
 * Collects debug information and returns it as an array of log strings
 */
function collectDebugInfo(): string[] {
	const info: string[] = []; // array of debug info

	// A. Number of script[type="application/json"] tags
	const jsonScripts = Array.from(document.querySelectorAll('script[type="application/json"]')); // JSON-embedded scripts
	info.push(`[A] script[type="application/json"] tag count: ${jsonScripts.length}`);

	// B. Check whether each tag contains a 40-character hex string (SHA candidate)
	const shaPattern = /[a-f0-9]{40}/g; // 40-character hex pattern
	let totalShaCandidates = 0; // total SHA candidate count
	jsonScripts.forEach((script, idx) => {
		const text = script.textContent || ''; // script content
		const matches = text.match(shaPattern); // search for SHA candidates
		if (matches && matches.length > 0) {
			totalShaCandidates += matches.length; // add to candidate count
			// record 30 characters of context around the first SHA candidate
			const firstMatch = matches[0]; // first SHA candidate
			const pos = text.indexOf(firstMatch); // position
			const contextStart = Math.max(0, pos - 30); // context start position
			const contextEnd = Math.min(text.length, pos + 40 + 30); // context end position
			const context = text.substring(contextStart, contextEnd); // context string
			info.push(`  [B] scriptTag#${idx}: SHA candidates ${matches.length}, context: ...${context.replace(/</g, '&lt;').replace(/>/g, '&gt;')}...`);
		}
	});
	info.push(`[B] Total SHA candidates: ${totalShaCandidates}`);

	// C. Number of inline scripts containing "Oid", "sha", or "Sha"
	const inlineScripts = Array.from(document.querySelectorAll('script:not([src]):not([type])')); // inline scripts
	let oidCount = 0; // count containing Oid
	let shaKeyCount = 0; // count containing sha
	inlineScripts.forEach(script => {
		const text = script.textContent || ''; // script content
		if (text.includes('Oid') || text.includes('sha') || text.includes('Sha')) {
			oidCount++; // count
		}
		if (text.includes('baseRefOid') || text.includes('headRefOid')) {
			shaKeyCount++; // count of SHA-related key occurrences
		}
	});
	info.push(`[C] Total inline scripts: ${inlineScripts.length}, containing Oid/sha/Sha: ${oidCount}, containing baseRefOid/headRefOid: ${shaKeyCount}`);

	// D. Presence of hidden inputs (comparison_start_oid, comparison_end_oid)
	const startOid = document.querySelector('input[name="comparison_start_oid"]') as HTMLInputElement; // comparison start OID
	const endOid = document.querySelector('input[name="comparison_end_oid"]') as HTMLInputElement; // comparison end OID
	info.push(`[D] hidden input: comparison_start_oid=${startOid ? startOid.value : '(none)'}, comparison_end_oid=${endOid ? endOid.value : '(none)'}`);

	// E. Number of blob links (a[href*="/blob/"]) and first href
	const blobLinks = Array.from(document.querySelectorAll('a[href*="/blob/"]')); // blob links
	const firstBlobHref = blobLinks.length > 0 ? (blobLinks[0] as HTMLAnchorElement).href : '(none)'; // first href
	info.push(`[E] blob link count: ${blobLinks.length}, first: ${firstBlobHref}`);

	// extract SHA candidate from blob link
	if (blobLinks.length > 0) {
		const blobShaPattern = /\/blob\/([a-f0-9]{40})\//; // SHA pattern in blob link
		const blobShaMatches = firstBlobHref.match(blobShaPattern); // search for SHA candidates
		info.push(`  [E] SHA extracted from blob link: ${blobShaMatches ? blobShaMatches[1] : '(pattern not matched)'}`);
	}

	// F. Branch info elements: .commit-ref, [data-branch-name], etc.
	const commitRefs = document.querySelectorAll('.commit-ref'); // commit ref elements
	const branchNames = document.querySelectorAll('[data-branch-name]'); // branch name elements
	info.push(`[F] .commit-ref: ${commitRefs.length}, [data-branch-name]: ${branchNames.length}`);
	commitRefs.forEach((el, idx) => {
		info.push(`  [F] .commit-ref#${idx}: "${el.textContent?.trim()}"`); // record content
	});

	// G. Page URL info
	info.push(`[G] URL: ${window.location.href}`);
	info.push(`[G] pathname: ${window.location.pathname}`);

	return info;
}

// ========== PR info retrieval ==========

/**
 * Extracts PR info from the URL
 */
function parsePrUrl(): PrInfo | null {
	const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/); // parse URL
	if (!match) return null;

	return {
		owner: match[1],   // owner name
		repo: match[2],    // repository name
		prNumber: parseInt(match[3], 10) // PR number
	};
}

/**
 * Generically extracts repository info from the URL (usable on non-PR pages too)
 */
function parseRepoInfo(): { owner: string; repo: string } | null {
	const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/); // extract owner/repo from URL
	if (!match) return null;
	return { owner: match[1], repo: match[2] }; // return repository info
}

/**
 * Creates a resolver that resolves screenshot paths to GitHub raw URLs
 */
function createScreenshotResolver(owner: string, repo: string, sha: string): ScreenshotPathResolver {
	return (filename: string) => `https://github.com/${owner}/${repo}/raw/${sha}/.screenshots/${filename}`; // GitHub raw URL
}

/**
 * Extracts base/head SHA pairs from text (supports multiple patterns)
 */
function extractShasFromText(text: string): PrRefs | null {
	// Pattern 1: baseRefOid / headRefOid (GitHub React embedded data)
	let base = text.match(/"baseRefOid"\s*:\s*"([a-f0-9]{40})"/);
	let head = text.match(/"headRefOid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// Pattern 2: baseSha / headSha
	base = text.match(/"baseSha"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"headSha"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// Pattern 3: "base":{"sha":"..."} / "head":{"sha":"..."} (REST API format)
	base = text.match(/"base"\s*:\s*\{[^}]*"sha"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"head"\s*:\s*\{[^}]*"sha"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// Pattern 4: comparison_start_oid / comparison_end_oid (GitHub diff hidden input)
	base = text.match(/"comparison_start_oid"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"comparison_end_oid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	// Pattern 5: oid fields (GitHub GraphQL format)
	base = text.match(/"baseOid"\s*:\s*"([a-f0-9]{40})"/);
	head = text.match(/"headOid"\s*:\s*"([a-f0-9]{40})"/);
	if (base && head) return { baseSha: base[1], headSha: head[1] };

	return null;
}

/**
 * Extracts base/head SHAs from the current page DOM
 */
function extractShasFromDom(): PrRefs | null {
	// Method A: <script type="application/json"> tags (GitHub React embedded data)
	const jsonScripts = Array.from(document.querySelectorAll('script[type="application/json"]')); // JSON-embedded scripts
	console.log(`UiPath Visualizer: DOM extraction: JSON script tags detected: ${jsonScripts.length}`);
	let shaCount = 0; // SHA candidate counter
	for (let i = 0; i < jsonScripts.length; i++) {
		const text = jsonScripts[i].textContent || '';
		const refs = extractShasFromText(text);
		if (refs) {
			console.log('UiPath Visualizer: SHA successfully retrieved from JSON script tag');
			return refs;
		}
		// check for SHA candidates (for debugging)
		const shaMatches = text.match(/[a-f0-9]{40}/g); // search for 40-character hex strings
		if (shaMatches) shaCount += shaMatches.length; // count candidates
	}
	console.log(`UiPath Visualizer: DOM extraction: JSON script tags detected: ${jsonScripts.length}, SHA candidates: ${shaCount}`);

	// Method B: inline scripts (no src attribute, no type attribute)
	const inlineScripts = Array.from(document.querySelectorAll('script:not([src]):not([type])')); // inline scripts
	for (let i = 0; i < inlineScripts.length; i++) {
		const text = inlineScripts[i].textContent || '';
		if (text.length > 100 && (text.includes('Oid') || text.includes('sha') || text.includes('Sha'))) {
			const refs = extractShasFromText(text);
			if (refs) {
				console.log('UiPath Visualizer: SHA successfully retrieved from inline script tag');
				return refs;
			}
		}
	}

	// Method C: hidden input elements
	const startOid = document.querySelector('input[name="comparison_start_oid"]') as HTMLInputElement; // comparison start OID
	const endOid = document.querySelector('input[name="comparison_end_oid"]') as HTMLInputElement; // comparison end OID
	if (startOid?.value && endOid?.value) {
		console.log('UiPath Visualizer: SHA successfully retrieved from hidden input');
		return { baseSha: startOid.value, headSha: endOid.value };
	}

	// Method D: extract head SHA from blob links
	const blobLinks = Array.from(document.querySelectorAll('a[href*="/blob/"]')); // blob links
	if (blobLinks.length > 0) {
		const blobShaPattern = /\/blob\/([a-f0-9]{40})\//; // SHA pattern in blob link
		for (const link of blobLinks) {
			const href = (link as HTMLAnchorElement).href; // link URL
			const match = href.match(blobShaPattern); // search for SHA candidates
			if (match) {
				console.log(`UiPath Visualizer: head SHA candidate retrieved from blob link: ${match[1]}`);
				// only head SHA can be obtained from blob link - base SHA is still needed separately
				// record it here for later combination with base SHA retrieval
				break;
			}
		}
	}

	// Method E: search for SHA pairs in the full page HTML (last resort)
	const fullHtml = document.documentElement.innerHTML; // full page HTML
	// check for keywords first before applying regex (performance optimization)
	if (fullHtml.indexOf('baseRefOid') !== -1 || fullHtml.indexOf('headRefOid') !== -1 ||
		fullHtml.indexOf('baseSha') !== -1 || fullHtml.indexOf('headSha') !== -1 ||
		fullHtml.indexOf('baseOid') !== -1 || fullHtml.indexOf('headOid') !== -1 ||
		fullHtml.indexOf('comparison_start_oid') !== -1) {
		console.log('UiPath Visualizer: SHA keyword detected in full page HTML, searching with regex...');
		const refs = extractShasFromText(fullHtml); // extract from full page
		if (refs) {
			console.log('UiPath Visualizer: SHA successfully retrieved from full page HTML');
			return refs;
		}
		console.log('UiPath Visualizer: SHA keyword found in full page HTML but pair extraction failed');
	}

	return null;
}

/**
 * Extracts head SHA from blob links (for PR files page)
 */
function extractBlobHeadSha(): string | null {
	const blobLinks = document.querySelectorAll('a[href*="/blob/"]'); // blob links
	const blobShaPattern = /\/blob\/([a-f0-9]{40})\//; // SHA pattern in blob link
	for (const link of Array.from(blobLinks)) {
		const href = (link as HTMLAnchorElement).href; // link URL
		const match = href.match(blobShaPattern); // search for SHA candidates
		if (match) return match[1]; // return the first SHA found
	}
	return null;
}

/**
 * Resolves a branch name to a commit SHA (via GitHub same-origin fetch)
 * Tries multiple methods to retrieve the latest commit SHA
 */
async function resolveBranchSha(owner: string, repo: string, branch: string): Promise<string | null> {
	// if branch name is already a SHA (40-character hex), return as-is
	if (/^[a-f0-9]{40}$/.test(branch)) return branch;
	const commitShaPattern = /\/commit\/([a-f0-9]{40})/; // commit SHA pattern

	// Method 1: /commit/<branch> page (GitHub redirects to SHA URL or SHA is in HTML)
	try {
		const commitUrl = `https://github.com/${owner}/${repo}/commit/${encodeURIComponent(branch)}`; // single commit page
		console.log(`UiPath Visualizer: Resolving branch SHA: ${branch} -> ${commitUrl}`);
		const response = await fetch(commitUrl, { credentials: 'same-origin' }); // send same-origin cookies
		if (response.ok) {
			// extract SHA from redirected URL (GitHub redirects /commit/<branch> to /commit/<sha>)
			const urlMatch = response.url.match(commitShaPattern); // redirect URL
			if (urlMatch) {
				console.log(`UiPath Visualizer: Branch ${branch} -> SHA (URL): ${urlMatch[1]}`);
				return urlMatch[1];
			}
			// search HTML for canonical URL, og:url, or commit links
			const html = await response.text(); // HTML text
			const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="[^"]*\/commit\/([a-f0-9]{40})"/) // canonical URL
				|| html.match(/<meta[^>]*property="og:url"[^>]*content="[^"]*\/commit\/([a-f0-9]{40})"/); // OG URL
			if (canonicalMatch) {
				console.log(`UiPath Visualizer: Branch ${branch} -> SHA (canonical): ${canonicalMatch[1]}`);
				return canonicalMatch[1];
			}
			const shaMatch = html.match(commitShaPattern); // extract SHA from commit links
			if (shaMatch) {
				console.log(`UiPath Visualizer: Branch ${branch} -> SHA (HTML): ${shaMatch[1]}`);
				return shaMatch[1];
			}
		}
	} catch (e) {
		console.warn(`UiPath Visualizer: Failed to resolve SHA for branch ${branch} (/commit):`, e);
	}

	// Method 2: /commits/<branch> page (extract SHA from commit list, fallback)
	try {
		const url = `https://github.com/${owner}/${repo}/commits/${encodeURIComponent(branch)}`; // commit list page
		console.log(`UiPath Visualizer: Resolving branch SHA (fallback): ${branch} -> ${url}`);
		const response = await fetch(url, { credentials: 'same-origin' }); // send same-origin cookies
		if (response.ok) {
			const html = await response.text(); // HTML text
			const shaMatch = html.match(commitShaPattern); // extract SHA from commit links
			if (shaMatch) {
				console.log(`UiPath Visualizer: Branch ${branch} -> SHA (commits): ${shaMatch[1]}`);
				return shaMatch[1];
			}
		}
	} catch (e) {
		console.warn(`UiPath Visualizer: Failed to resolve SHA for branch ${branch} (/commits):`, e);
	}
	return null;
}

/**
 * Retrieves base/head SHAs for a PR (DOM extraction -> branch resolution -> same-origin fetch -> API fallback)
 */
async function fetchPrRefs(pr: PrInfo): Promise<PrRefs> {
	// return cached value if available
	if (cachedPrRefs) {
		return cachedPrRefs;
	}

	// Method 1: extract SHA directly from the current page DOM (fastest and most reliable)
	const domRefs = extractShasFromDom();
	if (domRefs) {
		cachedPrRefs = domRefs;
		return cachedPrRefs;
	}
	console.log('UiPath Visualizer: Could not retrieve SHA from DOM, falling back to branch resolution');

	// Method 2: resolve SHAs from branch names in .commit-ref (supports private repositories)
	const commitRefs = document.querySelectorAll('.commit-ref'); // commit ref elements
	if (commitRefs.length >= 2) {
		const baseBranch = commitRefs[0].textContent?.trim(); // base branch name
		const headBranch = commitRefs[1].textContent?.trim(); // head branch name
		if (baseBranch && headBranch) {
			console.log(`UiPath Visualizer: Branch names retrieved from .commit-ref: base=${baseBranch}, head=${headBranch}`);

			// if head SHA can be obtained from blob links, only base needs resolving (saves one round trip)
			const blobHeadSha = extractBlobHeadSha(); // get head SHA from blob links
			if (blobHeadSha) {
				console.log(`UiPath Visualizer: head SHA retrieved from blob link: ${blobHeadSha}`);
				const baseSha = await resolveBranchSha(pr.owner, pr.repo, baseBranch); // resolve base only
				if (baseSha) {
					console.log('UiPath Visualizer: SHA successfully retrieved via blob SHA + branch resolution');
					cachedPrRefs = { baseSha, headSha: blobHeadSha };
					return cachedPrRefs;
				}
				// if base SHA resolution fails, use branch name directly (GitHub raw URL also accepts branch names)
				console.log(`UiPath Visualizer: base SHA resolution failed, using branch name directly: ${baseBranch}`);
				cachedPrRefs = { baseSha: baseBranch, headSha: blobHeadSha };
				return cachedPrRefs;
			}

			// fallback: resolve both branches to SHAs
			const [baseSha, headSha] = await Promise.all([ // resolve in parallel
				resolveBranchSha(pr.owner, pr.repo, baseBranch),
				resolveBranchSha(pr.owner, pr.repo, headBranch)
			]);
			if (baseSha && headSha) {
				console.log('UiPath Visualizer: SHA successfully resolved from branch names');
				cachedPrRefs = { baseSha, headSha };
				return cachedPrRefs;
			}
			// if SHA resolution partially succeeded, use branch name directly for the rest
			console.log(`UiPath Visualizer: Partial SHA resolution failure, using branch names directly: base=${baseSha || baseBranch}, head=${headSha || headBranch}`);
			cachedPrRefs = { baseSha: baseSha || baseBranch, headSha: headSha || headBranch };
			return cachedPrRefs;
		}
	}
	console.log('UiPath Visualizer: Branch resolution failed, falling back to fetch');

	// Method 3: fetch the PR page as HTML and extract SHA (same-origin -> sends cookies)
	const prPageUrl = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.prNumber}`; // PR page URL

	// 3a: try with credentials: 'same-origin'
	try {
		console.log(`UiPath Visualizer: Starting HTML fetch (same-origin): ${prPageUrl}`);
		const response = await fetch(prPageUrl, { credentials: 'same-origin' }); // send same-origin cookies
		console.log(`UiPath Visualizer: HTML fetch: status=${response.status}`);
		if (response.ok) {
			const html = await response.text(); // HTML text
			console.log(`UiPath Visualizer: HTML fetch: length=${html.length}, SHA keyword present=${html.indexOf('baseRefOid') !== -1 || html.indexOf('baseSha') !== -1}`);
			const refs = extractShasFromText(html);
			if (refs) {
				console.log('UiPath Visualizer: SHA successfully retrieved from fetched HTML (same-origin)');
				cachedPrRefs = refs;
				return cachedPrRefs;
			}
			console.warn('UiPath Visualizer: SHA pattern not found in HTML (HTML length:', html.length, ')');
		} else {
			console.warn('UiPath Visualizer: Failed to fetch PR page (same-origin):', response.status);
		}
	} catch (e) {
		console.warn('UiPath Visualizer: PR page fetch error (same-origin):', e);
	}

	// 3b: retry with credentials: 'include' (handles differences in cookie sending behavior in Chrome extensions)
	try {
		console.log(`UiPath Visualizer: Starting HTML fetch (include): ${prPageUrl}`);
		const response = await fetch(prPageUrl, { credentials: 'include' }); // request with cookies
		console.log(`UiPath Visualizer: HTML fetch (include): status=${response.status}`);
		if (response.ok) {
			const html = await response.text(); // HTML text
			console.log(`UiPath Visualizer: HTML fetch (include): length=${html.length}`);
			const refs = extractShasFromText(html);
			if (refs) {
				console.log('UiPath Visualizer: SHA successfully retrieved from fetched HTML (include)');
				cachedPrRefs = refs;
				return cachedPrRefs;
			}
		}
	} catch (e) {
		console.warn('UiPath Visualizer: PR page fetch error (include):', e);
	}

	// Method 4: GitHub REST API (fallback for public repositories)
	try {
		const apiUrl = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}`; // API URL
		console.log(`UiPath Visualizer: Starting API fetch: ${apiUrl}`);
		const apiResponse = await fetch(apiUrl, {
			headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
		});
		console.log(`UiPath Visualizer: API fetch: status=${apiResponse.status}`);
		if (apiResponse.ok) {
			const data = await apiResponse.json(); // parse response
			cachedPrRefs = { baseSha: data.base.sha, headSha: data.head.sha };
			console.log('UiPath Visualizer: SHA successfully retrieved from GitHub API');
			return cachedPrRefs;
		}
	} catch (e) {
		console.warn('UiPath Visualizer: GitHub API fallback failed:', e);
	}

	throw new Error('Could not retrieve base/head SHA for PR. Please check the console log.'); // error
}

/**
 * Retrieves base/head SHAs for the commit page (DOM extraction -> API fallback)
 */
async function fetchCommitRefs(owner: string, repo: string): Promise<PrRefs> {
	// Method 1: extract SHAs from DOM (hidden inputs, etc.)
	const domRefs = extractShasFromDom(); // extract directly from DOM
	if (domRefs) {
		console.log('UiPath Visualizer: Commit page - SHA successfully retrieved from DOM');
		return domRefs;
	}

	// Method 2: get commit SHA from URL and retrieve parent commit via GitHub API
	const commitMatch = window.location.pathname.match(/\/commit\/([a-f0-9]{7,40})/); // extract SHA from URL
	if (commitMatch) {
		const headSha = commitMatch[1]; // commit SHA
		try {
			const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}`; // Commits API
			console.log(`UiPath Visualizer: Commit API fetch: ${apiUrl}`);
			const response = await fetch(apiUrl, {
				headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
			});
			if (response.ok) {
				const data = await response.json(); // parse response
				if (data.parents && data.parents.length > 0) {
					const baseSha = data.parents[0].sha; // parent commit SHA
					console.log(`UiPath Visualizer: Commit API - base=${baseSha}, head=${data.sha}`);
					return { baseSha, headSha: data.sha }; // use full SHA
				}
			}
		} catch (e) {
			console.warn('UiPath Visualizer: Commit API failed:', e);
		}
	}

	// Method 3: for Compare page, use branch/SHA info from URL
	const compareMatch = window.location.pathname.match(/\/compare\/([^.]+)\.{2,3}(.+)/); // compare URL pattern
	if (compareMatch) {
		const baseRef = compareMatch[1]; // base ref
		const headRef = compareMatch[2]; // head ref
		console.log(`UiPath Visualizer: Compare page - base=${baseRef}, head=${headRef}`);
		// if refs are not SHAs (i.e. branch names), resolve via API
		try {
			const [baseResponse, headResponse] = await Promise.all([
				fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${baseRef}`, {
					headers: { 'Accept': 'application/vnd.github.v3+json' }
				}),
				fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${headRef}`, {
					headers: { 'Accept': 'application/vnd.github.v3+json' }
				})
			]); // resolve both refs
			if (baseResponse.ok && headResponse.ok) {
				const baseData = await baseResponse.json(); // base commit
				const headData = await headResponse.json(); // head commit
				console.log(`UiPath Visualizer: Compare API - base=${baseData.sha}, head=${headData.sha}`);
				return { baseSha: baseData.sha, headSha: headData.sha };
			}
		} catch (e) {
			console.warn('UiPath Visualizer: Compare API failed:', e);
		}
	}

	throw new Error('Could not retrieve base/head SHA for commit. Please check the console log.'); // error
}

/**
 * Fetches file content (supports private repositories via same-origin)
 */
async function fetchRawContent(owner: string, repo: string, sha: string, filePath: string): Promise<string> {
	// Method 1: fetch from github.com same-origin (session cookies are sent -> supports private repositories)
	const sameOriginUrl = `https://github.com/${owner}/${repo}/raw/${sha}/${filePath}`; // same-origin URL
	const response = await fetch(sameOriginUrl, { credentials: 'same-origin' }); // request with cookies

	if (response.status === 404) {
		return ''; // file does not exist (handles newly added/deleted files)
	}

	if (response.ok) {
		return await response.text(); // return as text
	}

	// Method 2: fallback to raw.githubusercontent.com (for public repositories)
	const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${filePath}`; // Raw URL
	const fallbackResponse = await fetch(rawUrl); // HTTP request

	if (fallbackResponse.status === 404) {
		return ''; // file does not exist
	}

	if (!fallbackResponse.ok) {
		throw new Error(`Raw content fetch error: ${fallbackResponse.status}`); // error
	}

	return await fallbackResponse.text(); // return as text
}

// ========== DOM operations for diff pages ==========

/**
 * Scans the diff page and injects buttons for XAML files (shared by PR, commit, and Compare pages)
 */
function scanAndInjectDiffButtons(onClick?: (filePath: string) => void): void {
	// get each file's div on GitHub diff pages
	const fileContainers = document.querySelectorAll('div.file[data-tagsearch-path]'); // file containers

	fileContainers.forEach(container => {
		const filePath = container.getAttribute('data-tagsearch-path'); // file path
		if (!filePath || !filePath.endsWith('.xaml')) return; // process XAML files only

		// check if button has already been added
		if (container.querySelector('.uipath-visualizer-btn')) return; // prevent duplicates

		// find the toolbar (action area in the file header)
		const toolbar = container.querySelector('.file-actions, .js-file-header-dropdown'); // toolbar

		if (!toolbar) return; // skip if toolbar not found

		// create the "View as Workflow" button
		const button = document.createElement('button'); // button element
		button.textContent = 'View as Workflow'; // button text
		button.className = 'btn btn-sm uipath-visualizer-btn'; // GitHub style + identifier class
		button.style.marginLeft = '8px'; // left margin
		button.addEventListener('click', (e) => {
			e.preventDefault(); // prevent default behavior
			e.stopPropagation(); // stop event propagation
			(onClick || showDiffVisualizer)(filePath); // call callback or default PR visualizer
		});

		toolbar.appendChild(button); // add button to toolbar
	});
}

// ========== Diff visualization ==========

/**
 * Displays the diff visualizer
 */
async function showDiffVisualizer(filePath: string): Promise<void> {
	removeExistingPanel(); // remove existing panel and overlay
	lastRenderContext = { type: 'diff', filePath }; // save context for re-rendering

	// show loading panel
	const panel = createPanel(); // create panel
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // content area
	contentArea.innerHTML = '<div class="status-message">Loading...</div>'; // show loading
	originalBodyMarginRight = document.body.style.marginRight; // save current marginRight
	originalBodyOverflowX = document.body.style.overflowX; // save current overflowX
	document.body.appendChild(panel); // add to page
	applyBodyShrink(panel.offsetWidth); // shrink page content

	try {
		const pr = parsePrUrl(); // get PR info
		if (!pr) throw new Error('Could not retrieve PR info');

		const refs = await fetchPrRefs(pr); // get base/head SHAs
		const screenshotResolver = createScreenshotResolver(pr.owner, pr.repo, refs.headSha); // screenshot resolver
		const baseScreenshotResolver = createScreenshotResolver(pr.owner, pr.repo, refs.baseSha); // screenshot resolver for before state

		// fetch before/after XAML in parallel
		const [beforeXaml, afterXaml] = await Promise.all([
			fetchRawContent(pr.owner, pr.repo, refs.baseSha, filePath), // base version
			fetchRawContent(pr.owner, pr.repo, refs.headSha, filePath)  // head version
		]);

		const parser = new XamlParser(); // initialize parser

		if (beforeXaml && afterXaml) {
			// modified file: show full workflow + diff highlights
			const beforeData = parser.parse(beforeXaml); // parse base version
			const afterData = parser.parse(afterXaml);   // parse head version

			const diffCalc = new DiffCalculator(); // diff calculator
			const diffResult = diffCalc.calculate(beforeData, afterData); // calculate diff

			// build line number mapping
			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // line map for head side

			contentArea.innerHTML = ''; // clear

			// render full workflow (head version)
			const seqContainer = document.createElement('div'); // sequence container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(afterData, seqContainer, headLineIndex); // render all activities
			contentArea.appendChild(seqContainer); // add to content

			// overlay diff highlights
			applyDiffHighlights(seqContainer, diffResult, baseScreenshotResolver, screenshotResolver); // highlight modified/added/removed (with screenshot comparison)

			// set up cursor sync (diff view)
			setupCursorSync(panel, headLineIndex, 'diff', filePath);

		} else if (afterXaml) {
			// new file: show after only
			const afterData = parser.parse(afterXaml); // parse
			const afterLineIndex = XamlLineMapper.buildLineMap(afterXaml); // build line map
			contentArea.innerHTML = `<div class="status-new-file">${t('New File')}</div>`; // label
			const seqContainer = document.createElement('div'); // container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(afterData, seqContainer, afterLineIndex); // render with line numbers
			contentArea.appendChild(seqContainer); // add

			// set up cursor sync (new file -> treated as blob view)
			setupCursorSync(panel, afterLineIndex, 'blob');

		} else if (beforeXaml) {
			// deleted file: show before only
			const beforeData = parser.parse(beforeXaml); // parse
			const beforeLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // build line map
			contentArea.innerHTML = `<div class="status-deleted-file">${t('Deleted File')}</div>`; // label
			const seqContainer = document.createElement('div'); // container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(beforeData, seqContainer, beforeLineIndex); // render with line numbers
			contentArea.appendChild(seqContainer); // add

		} else {
			contentArea.innerHTML = '<div class="status-message">XAML content not found</div>'; // error display
		}

	} catch (error) {
		console.error('Diff visualizer error:', error); // error log

		// collect debug info and display in panel
		const debugInfo = collectDebugInfo(); // collect debug info
		contentArea.innerHTML = `
			<div class="error-message">
				<div class="error-title">
					Error: ${(error as Error).message}
				</div>
				<div class="debug-info">${debugInfo.join('\n')}</div>
			</div>`; // display error and debug info
	}
}

/**
 * Displays the commit diff visualizer (no comment feature)
 */
async function showCommitDiffVisualizer(filePath: string): Promise<void> {
	removeExistingPanel(); // remove existing panel and overlay
	lastRenderContext = { type: 'commit-diff', filePath }; // save context for re-rendering

	// show loading panel
	const panel = createPanel(); // create panel
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // content area
	contentArea.innerHTML = '<div class="status-message">Loading...</div>'; // show loading
	originalBodyMarginRight = document.body.style.marginRight; // save current marginRight
	originalBodyOverflowX = document.body.style.overflowX; // save current overflowX
	document.body.appendChild(panel); // add to page
	applyBodyShrink(panel.offsetWidth); // shrink page content

	try {
		const repoInfo = parseRepoInfo(); // get repository info
		if (!repoInfo) throw new Error('Could not retrieve repository info');

		const refs = await fetchCommitRefs(repoInfo.owner, repoInfo.repo); // get base/head SHAs
		const screenshotResolver = createScreenshotResolver(repoInfo.owner, repoInfo.repo, refs.headSha); // screenshot resolver
		const baseScreenshotResolver = createScreenshotResolver(repoInfo.owner, repoInfo.repo, refs.baseSha); // screenshot resolver for before state

		// fetch before/after XAML in parallel
		const [beforeXaml, afterXaml] = await Promise.all([
			fetchRawContent(repoInfo.owner, repoInfo.repo, refs.baseSha, filePath), // base version
			fetchRawContent(repoInfo.owner, repoInfo.repo, refs.headSha, filePath)  // head version
		]);

		const parser = new XamlParser(); // initialize parser

		if (beforeXaml && afterXaml) {
			// modified file: show full workflow + diff highlights
			const beforeData = parser.parse(beforeXaml); // parse base version
			const afterData = parser.parse(afterXaml);   // parse head version

			const diffCalc = new DiffCalculator(); // diff calculator
			const diffResult = diffCalc.calculate(beforeData, afterData); // calculate diff

			const headLineIndex = XamlLineMapper.buildLineMap(afterXaml); // line map for head side

			contentArea.innerHTML = ''; // clear

			// render full workflow (head version)
			const seqContainer = document.createElement('div'); // sequence container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(afterData, seqContainer, headLineIndex); // render all activities
			contentArea.appendChild(seqContainer); // add to content

			// overlay diff highlights
			applyDiffHighlights(seqContainer, diffResult, baseScreenshotResolver, screenshotResolver); // highlight modified/added/removed (with screenshot comparison)

			// set up cursor sync (diff view)
			setupCursorSync(panel, headLineIndex, 'diff', filePath);

		} else if (afterXaml) {
			// new file: show after only
			const afterData = parser.parse(afterXaml); // parse
			const afterLineIndex = XamlLineMapper.buildLineMap(afterXaml); // build line map
			contentArea.innerHTML = `<div class="status-new-file">${t('New File')}</div>`; // label
			const seqContainer = document.createElement('div'); // container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(afterData, seqContainer, afterLineIndex); // render with line numbers
			contentArea.appendChild(seqContainer); // add

			// set up cursor sync (new file -> treated as blob view)
			setupCursorSync(panel, afterLineIndex, 'blob');

		} else if (beforeXaml) {
			// deleted file: show before only
			const beforeData = parser.parse(beforeXaml); // parse
			const beforeLineIndex = XamlLineMapper.buildLineMap(beforeXaml); // build line map
			contentArea.innerHTML = `<div class="status-deleted-file">${t('Deleted File')}</div>`; // label
			const seqContainer = document.createElement('div'); // container
			const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
			seqRenderer.render(beforeData, seqContainer, beforeLineIndex); // render with line numbers
			contentArea.appendChild(seqContainer); // add

		} else {
			contentArea.innerHTML = '<div class="status-message">XAML content not found</div>'; // error display
		}

	} catch (error) {
		console.error('Commit diff visualizer error:', error); // error log

		// collect debug info and display in panel
		const debugInfo = collectDebugInfo(); // collect debug info
		contentArea.innerHTML = `
			<div class="error-message">
				<div class="error-title">
					Error: ${(error as Error).message}
				</div>
				<div class="debug-info">${debugInfo.join('\n')}</div>
			</div>`; // display error and debug info
	}
}

// ========== Cursor sync (Visualizer <-> GitHub) ==========

/**
 * Injects highlight styles for GitHub-side into the page
 */
function injectSyncHighlightStyles(): void {
	if (document.getElementById('xaml-sync-styles')) return; // skip if already injected
	const style = document.createElement('style'); // style element
	style.id = 'xaml-sync-styles'; // ID to prevent duplicates
	style.textContent = `
		.xaml-sync-highlight {
			background-color: rgba(255, 165, 0, 0.25) !important;
			transition: background-color 0.5s ease-out;
		}
	`; // highlight style for GitHub-side code lines
	document.head.appendChild(style); // inject into page
}

/**
 * Removes all GitHub-side sync highlights
 */
function clearGithubHighlights(): void {
	document.querySelectorAll('.xaml-sync-highlight').forEach(el => {
		el.classList.remove('xaml-sync-highlight'); // remove highlight class
	});
}

/**
 * Removes all highlights from Visualizer cards
 */
function clearVisualizerHighlights(panel: HTMLElement): void {
	panel.querySelectorAll('.activity-card.sync-highlighted').forEach(el => {
		el.classList.remove('sync-highlighted'); // remove highlight class
	});
}

/**
 * Highlights and scrolls to a Visualizer card (auto-clears after 3 seconds)
 */
function highlightVisualizerCard(panel: HTMLElement, activityKey: string): void {
	clearVisualizerHighlights(panel); // clear previous highlights
	const card = panel.querySelector(`.activity-card[data-activity-key="${activityKey}"]`) as HTMLElement; // find target card
	if (!card) return; // do nothing if not found
	card.classList.add('sync-highlighted'); // add highlight class
	card.scrollIntoView({ behavior: 'smooth', block: 'center' }); // scroll to card
	setTimeout(() => card.classList.remove('sync-highlighted'), 3000); // remove highlight after 3 seconds
}

/**
 * Highlights and scrolls to GitHub-side lines (auto-clears after 2 seconds)
 */
function highlightGithubLines(startLine: number, endLine: number, filePath?: string): void {
	clearGithubHighlights(); // clear previous highlights

	if (filePath) {
		// diff view: find matching lines from td.blob-num inside the file container
		const fileContainer = document.querySelector(`div.file[data-tagsearch-path="${filePath}"]`); // file container
		if (!fileContainer) return;
		for (let line = startLine; line <= endLine; line++) {
			// find line number cells in diff view (identified by data-line-number attribute)
			const lineNumCells = fileContainer.querySelectorAll(`td.blob-num[data-line-number="${line}"]`); // line number cells
			lineNumCells.forEach(cell => {
				const row = cell.closest('tr'); // get row element
				if (row) row.classList.add('xaml-sync-highlight'); // highlight the row
			});
		}
		// scroll to first highlighted line
		const firstHighlighted = fileContainer.querySelector('.xaml-sync-highlight') as HTMLElement;
		if (firstHighlighted) firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
	} else {
		// blob view: get line element via document.getElementById('LC${lineNum}')
		for (let line = startLine; line <= endLine; line++) {
			const lineEl = document.getElementById(`LC${line}`); // code line element
			if (lineEl) lineEl.classList.add('xaml-sync-highlight'); // highlight
		}
		// scroll to the middle line
		const midLine = Math.floor((startLine + endLine) / 2); // middle line number
		const scrollTarget = document.getElementById(`LC${midLine}`); // scroll target
		if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// auto-clear highlights after 2 seconds
	setTimeout(clearGithubHighlights, 2000);
}

/**
 * Sets up cursor sync (bidirectional: Visualizer <-> GitHub)
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/GitHub-Extension#cursor-synchronization
 */
function setupCursorSync(
	panel: HTMLElement,
	lineIndex: ActivityLineIndex,
	viewMode: 'blob' | 'diff',
	filePath?: string
): void {
	// remove all previous listeners
	if (syncAbortController) syncAbortController.abort();
	syncAbortController = new AbortController(); // new AbortController
	const signal = syncAbortController.signal; // signal

	// === Direction 1: Visualizer -> GitHub (line number badge click) ===
	panel.addEventListener('visualizer-line-click', ((e: CustomEvent) => {
		const { startLine, endLine } = e.detail; // clicked line range
		highlightGithubLines(startLine, endLine, viewMode === 'diff' ? filePath : undefined); // highlight GitHub side
	}) as EventListener, { signal }); // managed by AbortController

	// === Direction 2: GitHub -> Visualizer (line number click) ===
	if (viewMode === 'blob') {
		// blob view: listen for clicks on line number cells in the code table (event delegation)
		const codeTable = document.querySelector('table.highlight') // find code table
			|| document.querySelector('.blob-code-content table') // fallback
			|| document.querySelector('.js-file-line-container'); // further fallback
		if (codeTable) {
			codeTable.addEventListener('click', (e: Event) => {
				const target = e.target as HTMLElement; // click target
				const lineCell = target.closest('td[id]') as HTMLElement; // find line number cell
				if (!lineCell) return;
				const match = lineCell.id.match(/^L(\d+)$/); // match id="L123" pattern
				if (!match) return;
				const lineNum = parseInt(match[1], 10); // get line number
				const activityKey = lineIndex.lineToKey.get(lineNum); // look up activity key from line number
				if (!activityKey) return; // ignore if no mapping
				highlightVisualizerCard(panel, activityKey); // highlight Visualizer-side card
			}, { signal }); // managed by AbortController
		}
	} else {
		// diff view: listen for clicks on line number cells inside the file container
		const fileContainer = filePath
			? document.querySelector(`div.file[data-tagsearch-path="${filePath}"]`)
			: null; // file container
		if (fileContainer) {
			fileContainer.addEventListener('click', (e: Event) => {
				const target = e.target as HTMLElement; // click target
				const blobNumCell = target.closest('td.blob-num[data-line-number]') as HTMLElement; // find line number cell
				if (!blobNumCell) return;
				const lineNum = parseInt(blobNumCell.getAttribute('data-line-number') || '0', 10); // get line number
				if (!lineNum) return;
				const activityKey = lineIndex.lineToKey.get(lineNum); // look up activity key from line number
				if (!activityKey) return; // ignore if no mapping
				highlightVisualizerCard(panel, activityKey); // highlight Visualizer-side card
			}, { signal }); // managed by AbortController
		}
	}
}

// ========== Search feature ==========

/**
 * Wraps matching parts of text nodes in <mark> elements to highlight them
 */
function highlightTextInElement(el: HTMLElement, query: string): void {
	const lowerQuery = query.toLowerCase(); // lowercased query
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); // traverse text nodes
	const textNodes: Text[] = []; // list of text nodes
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text); // collect text nodes
	}
	for (const node of textNodes) {
		const text = node.textContent || ''; // text content
		const lowerText = text.toLowerCase(); // lowercased
		const idx = lowerText.indexOf(lowerQuery); // match position
		if (idx === -1) continue; // skip if no match

		const before = text.substring(0, idx); // text before match
		const match = text.substring(idx, idx + query.length); // matched text
		const after = text.substring(idx + query.length); // text after match

		const mark = document.createElement('mark'); // <mark> element
		mark.className = 'search-highlight'; // highlight class
		mark.textContent = match; // set matched text

		const parent = node.parentNode; // parent node
		if (!parent) continue;
		if (before) parent.insertBefore(document.createTextNode(before), node); // text before match
		parent.insertBefore(mark, node); // insert <mark> element
		if (after) parent.insertBefore(document.createTextNode(after), node); // text after match
		parent.removeChild(node); // remove original text node
	}
}

/**
 * Reverts search highlights (<mark>) back to text nodes and merges them
 */
function clearSearchHighlights(): void {
	const panel = document.getElementById('uipath-visualizer-panel'); // get panel
	if (!panel) return;

	// revert <mark> elements back to text nodes
	panel.querySelectorAll('mark.search-highlight, mark.search-highlight-current').forEach(mark => {
		const parent = mark.parentNode; // parent node
		if (!parent) return;
		const textNode = document.createTextNode(mark.textContent || ''); // convert to text node
		parent.replaceChild(textNode, mark); // replace
		parent.normalize(); // merge adjacent text nodes
	});

	// remove all search-related classes
	panel.querySelectorAll('.activity-card.search-match, .activity-card.search-current, .activity-card.search-dimmed').forEach(el => {
		el.classList.remove('search-match', 'search-current', 'search-dimmed'); // remove classes
	});
}

/**
 * Completely clears the search state
 */
function clearSearch(input: HTMLInputElement, countSpan: HTMLElement, prevBtn: HTMLButtonElement, nextBtn: HTMLButtonElement): void {
	clearSearchHighlights(); // remove highlights
	searchMatches = []; // clear match list
	searchCurrentIndex = -1; // reset index
	input.value = ''; // clear input
	countSpan.textContent = ''; // clear count display
	prevBtn.disabled = true; // disable nav buttons
	nextBtn.disabled = true; // disable nav buttons
}

/**
 * Updates focus to the current match (scroll + count display)
 */
function updateSearchFocus(countSpan: HTMLElement): void {
	// clear previous search-current
	const panel = document.getElementById('uipath-visualizer-panel'); // get panel
	if (panel) {
		panel.querySelectorAll('.activity-card.search-current').forEach(el => {
			el.classList.remove('search-current'); // clear previous focus
		});
		panel.querySelectorAll('mark.search-highlight-current').forEach(mark => {
			mark.className = 'search-highlight'; // revert text highlight to normal
		});
	}

	if (searchMatches.length === 0 || searchCurrentIndex < 0) {
		countSpan.textContent = ''; // clear count display
		return;
	}

	const current = searchMatches[searchCurrentIndex]; // current matched card
	current.classList.add('search-current'); // add focus class
	current.scrollIntoView({ behavior: 'smooth', block: 'center' }); // scroll

	// emphasize <mark> inside the current card
	const mark = current.querySelector('.activity-title mark.search-highlight'); // mark inside title
	if (mark) mark.className = 'search-highlight-current'; // change to emphasis class

	countSpan.textContent = `${searchCurrentIndex + 1}/${searchMatches.length}`; // update count display
}

/**
 * Navigates to the previous/next match in the list (circular)
 */
function navigateSearch(direction: 'prev' | 'next', countSpan: HTMLElement): void {
	if (searchMatches.length === 0) return; // do nothing if no matches
	if (direction === 'next') {
		searchCurrentIndex = (searchCurrentIndex + 1) % searchMatches.length; // next (circular)
	} else {
		searchCurrentIndex = (searchCurrentIndex - 1 + searchMatches.length) % searchMatches.length; // previous (circular)
	}
	updateSearchFocus(countSpan); // update focus
}

/**
 * Executes a search (scans all .activity-card elements in the panel)
 */
function performSearch(query: string, countSpan: HTMLElement, prevBtn: HTMLButtonElement, nextBtn: HTMLButtonElement): void {
	clearSearchHighlights(); // clear previous search results
	searchMatches = []; // reset match list
	searchCurrentIndex = -1; // reset index

	if (!query.trim()) {
		countSpan.textContent = ''; // clear count display
		prevBtn.disabled = true; // disable nav buttons
		nextBtn.disabled = true; // disable nav buttons
		return;
	}

	const panel = document.getElementById('uipath-visualizer-panel'); // get panel
	if (!panel) return;

	const lowerQuery = query.toLowerCase(); // lowercased query
	const allCards = Array.from(panel.querySelectorAll('.activity-card')) as HTMLElement[]; // all cards

	// determine match/no-match for each card
	const matchedCards = new Set<HTMLElement>(); // set of matched cards
	for (const card of allCards) {
		const titleEl = card.querySelector(':scope > .activity-header > .activity-title') as HTMLElement; // title element (direct children only)
		if (!titleEl) continue;
		const titleText = titleEl.textContent || ''; // title text
		if (titleText.toLowerCase().includes(lowerQuery)) {
			matchedCards.add(card); // add to matched cards
		}
	}

	// also un-dim ancestor cards of matched cards
	const undimmedCards = new Set<HTMLElement>(matchedCards); // set of un-dimmed cards
	for (const card of matchedCards) {
		let parent = card.parentElement; // get parent element
		while (parent) {
			const ancestorCard = parent.closest('.activity-card') as HTMLElement; // find ancestor card
			if (ancestorCard && ancestorCard !== card) {
				undimmedCards.add(ancestorCard); // un-dim ancestor card
				parent = ancestorCard.parentElement; // search further up
			} else {
				break; // stop when outside the panel
			}
		}
	}

	// apply classes
	for (const card of allCards) {
		if (matchedCards.has(card)) {
			card.classList.add('search-match'); // matched card
			searchMatches.push(card); // add to match list
			// highlight text inside title
			const titleEl = card.querySelector(':scope > .activity-header > .activity-title') as HTMLElement;
			if (titleEl) highlightTextInElement(titleEl, query); // highlight text
		} else if (!undimmedCards.has(card)) {
			card.classList.add('search-dimmed'); // card that neither matches nor is an ancestor
		}
	}

	// enable/disable nav buttons
	const hasMatches = searchMatches.length > 0; // whether there are matches
	prevBtn.disabled = !hasMatches; // previous button
	nextBtn.disabled = !hasMatches; // next button

	if (hasMatches) {
		searchCurrentIndex = 0; // focus on first match
		updateSearchFocus(countSpan); // update focus
	} else {
		countSpan.textContent = '0'; // no matches display
	}
}

/**
 * Creates the search bar
 */
function createSearchBar(): HTMLElement {
	const bar = document.createElement('div'); // search bar container
	bar.className = 'panel-search-bar'; // CSS class

	const input = document.createElement('input'); // search input field
	input.type = 'text'; // text input
	input.className = 'panel-search-input'; // CSS class
	input.placeholder = 'Search by DisplayName...'; // placeholder

	const countSpan = document.createElement('span'); // match count display
	countSpan.className = 'panel-search-count'; // CSS class

	const prevBtn = document.createElement('button'); // previous button
	prevBtn.className = 'panel-search-nav-btn'; // CSS class
	prevBtn.textContent = '\u25B2'; // ▲
	prevBtn.title = 'Previous match (Shift+Enter)'; // tooltip
	prevBtn.disabled = true; // initially disabled

	const nextBtn = document.createElement('button'); // next button
	nextBtn.className = 'panel-search-nav-btn'; // CSS class
	nextBtn.textContent = '\u25BC'; // ▼
	nextBtn.title = 'Next match (Enter)'; // tooltip
	nextBtn.disabled = true; // initially disabled

	// input event: execute search with 250ms debounce
	input.addEventListener('input', () => {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer); // clear previous timer
		searchDebounceTimer = setTimeout(() => {
			performSearch(input.value, countSpan, prevBtn, nextBtn); // execute search
		}, 250); // 250ms debounce
	});

	// keyboard event: Enter/Shift+Enter for prev/next navigation, Escape to clear
	input.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault(); // prevent default behavior
			if (e.shiftKey) {
				navigateSearch('prev', countSpan); // Shift+Enter: previous
			} else {
				navigateSearch('next', countSpan); // Enter: next
			}
		} else if (e.key === 'Escape') {
			clearSearch(input, countSpan, prevBtn, nextBtn); // Escape: clear
			input.blur(); // remove focus
		}
	});

	// nav button clicks
	prevBtn.addEventListener('click', () => navigateSearch('prev', countSpan)); // previous
	nextBtn.addEventListener('click', () => navigateSearch('next', countSpan)); // next

	bar.appendChild(input); // add input field
	bar.appendChild(countSpan); // add count display
	bar.appendChild(prevBtn); // add previous button
	bar.appendChild(nextBtn); // add next button

	return bar;
}

// ========== Panel UI ==========

/**
 * Closes the panel and restores the page layout (centralized close logic)
 */
function closePanel(): void {
	clearGithubHighlights(); // clear GitHub-side highlights
	syncAbortController?.abort(); // remove all cursor sync listeners
	syncAbortController = null; // clear reference
	searchMatches = []; // clear search match list
	searchCurrentIndex = -1; // reset search index
	lastRenderContext = null; // clear re-render context
	document.getElementById('uipath-visualizer-panel')?.remove(); // remove panel
	document.body.style.marginRight = originalBodyMarginRight; // restore body margin
	document.body.style.overflowX = originalBodyOverflowX; // restore body overflowX
}

/**
 * Removes the existing panel and overlay
 */
function removeExistingPanel(): void {
	closePanel(); // delegate to closePanel
}

/**
 * Shrinks the page content to the left to make room for the sidebar
 */
function applyBodyShrink(panelWidth: number): void {
	document.body.style.marginRight = panelWidth + 'px'; // margin equal to sidebar width
	document.body.style.overflowX = 'hidden'; // suppress horizontal scrolling
}

/**
 * Enables panel width resizing via the left-edge resize handle
 */
function setupResize(panel: HTMLElement): void {
	const handle = document.createElement('div'); // resize handle
	handle.className = 'resize-handle'; // CSS class
	panel.appendChild(handle); // add to panel

	let isResizing = false; // resizing flag
	let startX = 0; // X coordinate at resize start
	let startWidth = 0; // panel width at resize start

	handle.addEventListener('mousedown', (e: MouseEvent) => {
		isResizing = true; // start resizing
		startX = e.clientX; // mouse X coordinate
		startWidth = panel.offsetWidth; // current width
		panel.classList.add('is-resizing'); // add resizing class
		handle.classList.add('is-active'); // handle active state
		e.preventDefault(); // prevent default behavior
		e.stopPropagation(); // stop event propagation
	});

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!isResizing) return; // skip if not resizing
		const dx = startX - e.clientX; // drag left = expand width (sign inverted)
		const newWidth = Math.max(320, Math.min(window.innerWidth * 0.7, startWidth + dx)); // min 320px, max 70vw
		panel.style.width = newWidth + 'px'; // update width
		applyBodyShrink(newWidth); // also update page shrink
	});

	document.addEventListener('mouseup', () => {
		if (!isResizing) return; // skip if not resizing
		isResizing = false; // end resizing
		panel.classList.remove('is-resizing'); // remove resizing class
		handle.classList.remove('is-active'); // deactivate handle
	});
}

/**
 * Creates the visualizer panel
 */
function createPanel(): HTMLElement {
	const panel = document.createElement('div'); // panel element
	panel.id = 'uipath-visualizer-panel'; // set ID (layout and colors defined in CSS)

	// header section
	const header = document.createElement('div'); // header
	header.className = 'panel-header'; // apply styles via CSS class

	const titleArea = document.createElement('div'); // title area

	const title = document.createElement('span'); // title
	title.textContent = 'UiPath Workflow Visualizer'; // title text
	title.className = 'panel-title'; // apply styles via CSS class

	const buildInfo = document.createElement('div'); // build info
	const buildDate = new Date(__BUILD_DATE__); // convert build timestamp to Date
	const formattedDate = buildDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }); // format in Japan time
	buildInfo.textContent = `v${__VERSION__} | ${__BRANCH_NAME__} | Build: ${formattedDate}`; // version, branch name, build timestamp
	buildInfo.className = 'panel-build-info'; // apply styles via CSS class

	titleArea.appendChild(title);
	titleArea.appendChild(buildInfo);

	const closeButton = document.createElement('button'); // close button
	closeButton.textContent = '✕'; // text
	closeButton.className = 'btn btn-sm'; // button style
	closeButton.addEventListener('click', () => closePanel()); // close panel

	/**
	 * Extracts panel-related CSS rules and resolves CSS variables to their computed values
	 */
	function extractPanelCss(): string {
		const rules: string[] = []; // collected CSS rules
		const panel = document.getElementById('uipath-visualizer-panel'); // panel element for CSS variable resolution
		const computedStyle = panel ? getComputedStyle(panel) : null; // computed style of the panel

		for (const sheet of Array.from(document.styleSheets)) { // iterate over all stylesheets
			let cssRules: CSSRuleList;
			try {
				cssRules = sheet.cssRules; // get rule list
			} catch {
				continue; // skip cross-origin stylesheets
			}
			for (const rule of Array.from(cssRules)) { // iterate over each rule
				if (rule.cssText.includes('uipath-visualizer-panel')) { // collect only panel-related rules
					let text = rule.cssText; // rule text
					if (computedStyle) { // resolve CSS variables to computed values
						text = text.replace(/var\(--([^)]+)\)/g, (_match, varName) => {
							return computedStyle.getPropertyValue(`--${varName}`).trim() || _match; // get variable value, or keep original if not found
						});
					}
					rules.push(text); // add resolved rule
				}
			}
		}
		return rules.join('\n'); // join with newlines
	}

	// Copy HTML button (for debugging)
	const copyHtmlButton = document.createElement('button'); // copy button
	copyHtmlButton.textContent = 'Copy HTML'; // button text
	copyHtmlButton.className = 'btn btn-sm panel-copy-btn'; // apply style
	copyHtmlButton.addEventListener('click', () => { // click event
		const originalText = copyHtmlButton.textContent; // save original text
		const css = extractPanelCss(); // extract panel-related CSS
		const fullHtml = `<style>\n${css}\n</style>\n<div id="uipath-visualizer-panel"><div class="panel-content">\n${content.innerHTML}\n</div></div>`; // complete HTML including CSS and panel structure
		navigator.clipboard.writeText(fullHtml) // copy HTML with CSS to clipboard
			.then(() => {
				copyHtmlButton.textContent = 'Copied!'; // success display
				copyHtmlButton.classList.add('panel-copy-btn-success'); // success style
			})
			.catch(() => {
				copyHtmlButton.textContent = 'Failed'; // failure display
				copyHtmlButton.classList.add('panel-copy-btn-error'); // failure style
			})
			.finally(() => {
				setTimeout(() => { // restore after 1.5 seconds
					copyHtmlButton.textContent = originalText; // restore text
					copyHtmlButton.classList.remove('panel-copy-btn-success', 'panel-copy-btn-error'); // restore style
				}, 1500);
			});
	});

	// language toggle button
	const langToggleButton = document.createElement('button'); // language toggle button
	langToggleButton.className = 'btn btn-sm panel-lang-toggle'; // apply style
	langToggleButton.textContent = getLanguage() === 'en' ? '日本語' : 'English'; // show the opposite language
	langToggleButton.title = getLanguage() === 'en' ? '日本語に切り替え' : 'Switch to English'; // tooltip
	langToggleButton.addEventListener('click', async () => { // click event
		const newLang: Language = getLanguage() === 'en' ? 'ja' : 'en'; // toggle language
		setLanguage(newLang); // set language
		await saveLanguagePreference(newLang); // persist
		reRenderCurrentPanel(); // re-render panel
	});

	// header button group
	const headerButtons = document.createElement('div'); // button container
	headerButtons.className = 'panel-header-buttons'; // apply style
	headerButtons.appendChild(langToggleButton); // add language toggle button
	headerButtons.appendChild(copyHtmlButton); // add copy button
	headerButtons.appendChild(closeButton); // add close button

	header.appendChild(titleArea);
	header.appendChild(headerButtons);

	// content section
	const content = document.createElement('div'); // content
	content.className = 'panel-content'; // apply styles via CSS class

	panel.appendChild(header);
	const searchBar = createSearchBar(); // create search bar
	panel.appendChild(searchBar); // add search bar
	panel.appendChild(content);

	setupResize(panel); // enable resizing

	return panel;
}

// ========== Existing feature: individual XAML file page ==========

/**
 * Adds a visualizer button to the individual XAML file page
 */
function addVisualizerButton(): void {
	const toolbar = document.querySelector('.file-actions'); // toolbar element

	if (!toolbar) {
		console.log('Toolbar not found'); // log output
		return;
	}

	// prevent duplicates
	if (toolbar.querySelector('.uipath-visualizer-btn')) return;

	const button = document.createElement('button'); // button element
	button.textContent = 'View as Workflow'; // button text
	button.className = 'btn btn-sm uipath-visualizer-btn'; // GitHub button style + identifier class
	button.style.marginLeft = '8px'; // left margin
	button.addEventListener('click', showBlobVisualizer); // click event

	toolbar.appendChild(button); // add button to toolbar
}

/**
 * Displays the individual file visualizer
 */
async function showBlobVisualizer(): Promise<void> {
	try {
		const xamlContent = await fetchXamlContent(); // fetch XAML content
		const parser = new XamlParser(); // initialize parser
		const workflowData = parser.parse(xamlContent); // parse XAML
		const lineIndex = XamlLineMapper.buildLineMap(xamlContent); // build line map

		// create screenshot resolver from blob URL
		const repoInfo = parseRepoInfo(); // repository info
		const blobMatch = window.location.pathname.match(/^\/[^/]+\/[^/]+\/blob\/([^/]+)/); // extract ref from blob URL
		const ref = blobMatch?.[1] || 'HEAD'; // ref (SHA or branch name)
		const screenshotResolver = repoInfo
			? createScreenshotResolver(repoInfo.owner, repoInfo.repo, ref) // generate resolver
			: undefined;

		displayBlobVisualizerPanel(workflowData, lineIndex, screenshotResolver); // show panel (with line numbers)
	} catch (error) {
		console.error('Visualizer display error:', error); // error log
		alert('Failed to parse XAML file'); // show alert
	}
}

/**
 * Fetches XAML file content (via the Raw button)
 */
async function fetchXamlContent(): Promise<string> {
	const rawButton = document.querySelector('a[data-testid="raw-button"]') as HTMLAnchorElement; // Raw button

	if (!rawButton) {
		throw new Error('Raw button not found'); // error
	}

	const rawUrl = rawButton.href; // Raw URL
	const response = await fetch(rawUrl); // HTTP request
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`); // error
	}

	return await response.text(); // return as text
}

/**
 * Displays the visualizer panel for an individual file
 * @see https://github.com/AutoFor/uipath-xaml-visualizer/wiki/GitHub-Extension#visualizer-panel-injection
 */
function displayBlobVisualizerPanel(workflowData: any, lineIndex?: ActivityLineIndex, screenshotResolver?: ScreenshotPathResolver): void {
	removeExistingPanel(); // remove existing panel and overlay
	lastRenderContext = { type: 'blob', workflowData, lineIndex, screenshotResolver }; // save context for re-rendering

	const panel = createPanel(); // create panel
	const contentArea = panel.querySelector('.panel-content') as HTMLElement; // content area

	// render with SequenceRenderer
	const seqRenderer = new SequenceRenderer(screenshotResolver); // with screenshot resolver
	seqRenderer.render(workflowData, contentArea, lineIndex); // render with line numbers

	originalBodyMarginRight = document.body.style.marginRight; // save current marginRight
	originalBodyOverflowX = document.body.style.overflowX; // save current overflowX
	document.body.appendChild(panel); // add to page
	applyBodyShrink(panel.offsetWidth); // shrink page content

	// set up cursor sync (blob view)
	if (lineIndex) {
		setupCursorSync(panel, lineIndex, 'blob'); // enable bidirectional sync
	}
}

/**
 * Applies diff highlights on top of the full workflow (matched by data-activity-key)
 */
/**
 * Calculates common and differing parts between two strings
 */
/**
 * Tokenizes a selector string into attribute name and value units
 * Example: `<webctrl aaname='Shopping' tag='SPAN' />`
 * -> [`<webctrl `, `aaname`, `='Shopping' `, `tag`, `='SPAN' `, `/>`]
 */
function tokenizeSelector(s: string): string[] { // split selector string into tokens
	const tokens: string[] = []; // result array
	let i = 0; // current position

	// get leading <tagName
	const tagMatch = s.match(/^<[\w]+\s*/); // matches <webctrl etc.
	if (tagMatch) { // if tag name found
		tokens.push(tagMatch[0]); // add tag name token
		i = tagMatch[0].length; // advance past tag name
	}

	while (i < s.length) { // process remaining string
		// check for closing tag />
		if (s[i] === '/' && i + 1 < s.length && s[i + 1] === '>') { // />
			tokens.push('/>'); // closing tag token
			i += 2;
			continue;
		}
		if (s[i] === '>') { // > only
			tokens.push('>'); // closing tag token
			i++;
			continue;
		}

		// skip whitespace (included in tail of attribute value tokens)
		if (/\s/.test(s[i])) { // whitespace character
			i++;
			continue;
		}

		// get attribute name (alphanumeric, colon, hyphen, dot, etc.)
		if (/[a-zA-Z_:]/.test(s[i])) { // starting character of attribute name
			let start = i; // start position of attribute name
			while (i < s.length && s[i] !== '=' && !/\s/.test(s[i]) && s[i] !== '/' && s[i] !== '>') { // advance to end of attribute name
				i++;
			}
			tokens.push(s.substring(start, i)); // attribute name token (e.g. aaname, check:innerText)

			// get quoted value following =
			if (i < s.length && s[i] === '=') { // if value is present
				let valStart = i; // start from =
				i++; // skip =
				if (i < s.length && (s[i] === "'" || s[i] === '"')) { // quote start
					const quote = s[i]; // remember quote character
					i++; // skip opening quote
					while (i < s.length && s[i] !== quote) i++; // advance to closing quote
					if (i < s.length) i++; // skip closing quote
				}
				tokens.push(s.substring(valStart, i)); // value token (e.g. ='Shopping')
			}
			continue;
		}

		// other characters as-is
		tokens.push(s[i]); // single character token
		i++;
	}
	return tokens; // return token array
}

/**
 * Tokenizes a string (selector strings by attribute unit, others by whitespace)
 */
function tokenize(s: string): string[] { // tokenize string into appropriate units
	if (s.startsWith('<') && s.includes('>')) { // if selector string
		return tokenizeSelector(s); // split by attribute name and value
	}
	if (s.includes(',')) { // if comma-separated (e.g. coordinate values)
		return s.split(/(,\s*)/); // split using comma+whitespace as delimiter
	}
	return s.split(/(\s+)/); // otherwise split by whitespace
}

function findCommonParts(a: string, b: string): { value: string; same: boolean }[] {
	// tokenize and compare (selector by attribute unit, others by whitespace)
	const tokensA = tokenize(a); // tokenize a
	const tokensB = tokenize(b); // tokenize b
	const result: { value: string; same: boolean }[] = []; // result array
	let ai = 0; // index into tokensA
	let bi = 0; // index into tokensB

	while (ai < tokensA.length && bi < tokensB.length) {
		if (tokensA[ai] === tokensB[bi]) {
			let start = ai; // start of common part
			while (ai < tokensA.length && bi < tokensB.length && tokensA[ai] === tokensB[bi]) {
				ai++;
				bi++;
			}
			result.push({ value: tokensA.slice(start, ai).join(''), same: true }); // common token group
		} else {
			// find next sync point (3 patterns)
			let foundA = -1;    // skip A only (A has extra tokens)
			let foundB = -1;    // skip B only (B has extra tokens)
			let foundBoth = -1; // skip same amount from both (token substitution)
			const searchLimit = Math.min(Math.max(tokensA.length - ai, tokensB.length - bi), 20); // search range
			for (let d = 1; d < searchLimit; d++) {
				if (foundBoth < 0 && ai + d < tokensA.length && bi + d < tokensB.length && tokensA[ai + d] === tokensB[bi + d]) {
					foundBoth = d; // advancing both by d tokens gives a match (substitution)
				}
				if (foundA < 0 && ai + d < tokensA.length && tokensA[ai + d] === tokensB[bi]) {
					foundA = d; // advancing A by d tokens gives a match (A has extra)
				}
				if (foundB < 0 && bi + d < tokensB.length && tokensA[ai] === tokensB[bi + d]) {
					foundB = d; // advancing B by d tokens gives a match (B has extra)
				}
				if (foundBoth >= 0 || foundA >= 0 || foundB >= 0) break; // stop when any is found
			}
			// select the minimum-cost strategy
			if (foundBoth >= 0 && (foundA < 0 || foundBoth <= foundA) && (foundB < 0 || foundBoth <= foundB)) {
				result.push({ value: tokensA.slice(ai, ai + foundBoth).join(''), same: false }); // substituted part
				ai += foundBoth;
				bi += foundBoth;
			} else if (foundA >= 0 && (foundB < 0 || foundA <= foundB)) {
				result.push({ value: tokensA.slice(ai, ai + foundA).join(''), same: false }); // extra tokens in A
				ai += foundA;
			} else if (foundB >= 0) {
				bi += foundB; // skip extra tokens in B (no output for A)
			} else {
				result.push({ value: tokensA.slice(ai).join(''), same: false }); // all remaining is diff
				ai = tokensA.length;
				bi = tokensB.length;
			}
		}
	}
	if (ai < tokensA.length) {
		result.push({ value: tokensA.slice(ai).join(''), same: false }); // remaining in A
	}
	return result;
}

/**
 * Builds HTML using word-level diff (wraps changed parts in <span class="word-highlight">)
 */
function buildWordDiffHtml(div: HTMLElement, prefix: string, text: string, otherText: string): void {
	const parts = findCommonParts(text, otherText); // calculate common and differing parts
	div.textContent = ''; // clear textContent

	div.appendChild(document.createTextNode(prefix + ' ')); // prefix (- / +)

	// calculate proportion of common parts (highlight entirely if too low)
	const sameLen = parts.reduce((sum, p) => sum + (p.same ? p.value.length : 0), 0); // common character count
	const totalLen = parts.reduce((sum, p) => sum + p.value.length, 0);                // total character count
	const similarity = totalLen > 0 ? sameLen / totalLen : 0;                          // similarity (0-1)

	if (similarity < 0.5) {
		// below 50% similarity: highlight entirely (avoids accidental matches like hashes)
		const span = document.createElement('span');
		span.className = 'word-highlight';
		span.textContent = text;
		div.appendChild(span);
		return;
	}

	parts.forEach(part => {
		if (part.same) {
			div.appendChild(document.createTextNode(part.value)); // common part as-is
		} else {
			const span = document.createElement('span'); // wrap differing part in span
			span.className = 'word-highlight'; // word highlight class
			span.textContent = part.value;
			div.appendChild(span);
		}
	});
}

/**
 * Formats a diff value for display (objects are JSON-stringified)
 */
function formatDiffValue(value: any): string {
	if (value === null || value === undefined) return '(none)';            // null/undefined displayed as "none"
	if (typeof value === 'object') return JSON.stringify(value);           // objects JSON-stringified
	return String(value);                                                  // primitives converted to string as-is
}

/**
 * Expands and displays object-type property diffs at the attribute level
 * Only displays before/after for attributes that have changed
 */
function renderObjectPropertyDiff(
	container: HTMLElement,
	beforeObj: Record<string, any>,
	afterObj: Record<string, any>
): void {
	const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]); // collect all keys
	for (const key of allKeys) {
		if (key === 'type') continue;                                      // skip type key (internal use)
		if (key === 'InformativeScreenshot') continue;                     // screenshot displayed separately as comparison
		if (key === 'ImageBase64') continue;                               // binary data not shown
		const bVal = beforeObj[key];
		const aVal = afterObj[key];
		const bStr = formatDiffValue(bVal);                                // before text
		const aStr = formatDiffValue(aVal);                                // after text
		if (bStr === aStr) continue;                                       // skip if no diff

		const changeItem = document.createElement('div');                  // individual change element
		changeItem.className = 'property-change-item';                     // CSS class

		const propName = document.createElement('span');                   // property name
		propName.className = 'prop-name';                                  // CSS class
		propName.textContent = `${key}:`;                                  // display sub-key name
		changeItem.appendChild(propName);

		const beforeDiv = document.createElement('div');                   // before line
		beforeDiv.className = 'diff-before';                               // CSS class
		buildWordDiffHtml(beforeDiv, '-', bStr, aStr);                     // word-level diff
		changeItem.appendChild(beforeDiv);

		const afterDiv = document.createElement('div');                    // after line
		afterDiv.className = 'diff-after';                                 // CSS class
		buildWordDiffHtml(afterDiv, '+', aStr, bStr);                      // word-level diff
		changeItem.appendChild(afterDiv);

		container.appendChild(changeItem);                                 // add to change details
	}
}

/**
 * Common function for rendering diff property changes
 * Object comparisons are expanded at attribute level; primitives shown as before/after lines
 */
function renderDiffChangeList(container: HTMLElement, changes: any[]): void { // render change list into container
	for (const change of changes) { // loop over each change
		// expand object comparisons at attribute level
		if (typeof change.before === 'object' && change.before !== null // before is object
			&& typeof change.after === 'object' && change.after !== null // after is also object
			&& !Array.isArray(change.before) && !Array.isArray(change.after)) { // not arrays
			renderObjectPropertyDiff(container, change.before, change.after); // expand at attribute level
			continue;
		}

		const changeItem = document.createElement('div'); // individual change element
		changeItem.className = 'property-change-item'; // CSS class

		const propName = document.createElement('span'); // property name
		propName.className = 'prop-name'; // CSS class
		propName.textContent = `${change.propertyName}:`; // property name text
		changeItem.appendChild(propName);

		const bfText = formatDiffValue(change.before); // before text
		const afText = formatDiffValue(change.after); // after text

		const beforeDiv = document.createElement('div'); // before value
		beforeDiv.className = 'diff-before'; // CSS class
		buildWordDiffHtml(beforeDiv, '-', bfText, afText); // word-level diff
		changeItem.appendChild(beforeDiv);

		const afterDiv = document.createElement('div'); // after value
		afterDiv.className = 'diff-after'; // CSS class
		buildWordDiffHtml(afterDiv, '+', afText, bfText); // word-level diff
		changeItem.appendChild(afterDiv);

		container.appendChild(changeItem); // add to container
	}
}

function applyDiffHighlights(
	container: HTMLElement,
	diffResult: any,
	baseScreenshotResolver?: ScreenshotPathResolver, // URL resolver for before-state screenshots
	headScreenshotResolver?: ScreenshotPathResolver   // URL resolver for after-state screenshots
): void {
	// highlight modified activities
	for (const item of diffResult.modified) {
		const key = buildActivityKey(item.activity, 0); // generate key (IdRef preferred)
		const card = container.querySelector(`[data-activity-key="${key}"]`) as HTMLElement; // find card
		if (!card) continue;
		card.classList.add('diff-highlight-modified'); // add modified highlight class

		// inject property change details
		if (item.changes && item.changes.length > 0) {
			const changesDiv = document.createElement('div'); // change details container
			changesDiv.className = 'diff-highlight-changes'; // CSS class

			// for Assign activities, display To/Value in integrated format
			const isAssign = item.activity.type === 'Assign'; // whether it is Assign
			const hasAssignChange = isAssign && item.changes.some( // whether To/Value changed
				(c: any) => c.propertyName === 'To' || c.propertyName === 'Value'
			);

			if (hasAssignChange && item.beforeActivity) {
				// integrated format: display "left-hand side = right-hand side" together
				const beforeTo = item.beforeActivity.properties['To']; // before left-hand side
				const beforeVal = item.beforeActivity.properties['Value']; // before right-hand side
				const afterTo = item.activity.properties['To']; // after left-hand side
				const afterVal = item.activity.properties['Value']; // after right-hand side

				const changeItem = document.createElement('div'); // integrated change element
				changeItem.className = 'property-change-item'; // CSS class

				const beforeText = `${formatDiffValue(beforeTo)} = ${formatDiffValue(beforeVal)}`; // before text
				const afterText = `${formatDiffValue(afterTo)} = ${formatDiffValue(afterVal)}`; // after text

				const beforeDiv = document.createElement('div'); // before line
				beforeDiv.className = 'diff-before'; // CSS class
				buildWordDiffHtml(beforeDiv, '-', beforeText, afterText); // word-level diff
				changeItem.appendChild(beforeDiv);

				const afterDiv = document.createElement('div'); // after line
				afterDiv.className = 'diff-after'; // CSS class
				buildWordDiffHtml(afterDiv, '+', afterText, beforeText); // word-level diff
				changeItem.appendChild(afterDiv);

				changesDiv.appendChild(changeItem); // add to change details

				// hide the normal property display since diff is being shown
				const propsDiv = card.querySelector(':scope > .activity-properties'); // normal properties
				if (propsDiv) {
					(propsDiv as HTMLElement).style.display = 'none'; // hide to prevent duplication
				}
				// also hide sub-property panel toggle and panel
				const subToggle = card.querySelector(':scope > .property-sub-panel-toggle'); // sub-panel toggle
				if (subToggle) {
					(subToggle as HTMLElement).style.display = 'none'; // hide
				}
				const subPanel = card.querySelector(':scope > .property-sub-panel'); // sub-panel body
				if (subPanel) {
					(subPanel as HTMLElement).style.display = 'none'; // hide
				}

				// display property changes other than To/Value as normal
				const otherChanges = item.changes.filter( // extract changes other than To/Value, InformativeScreenshot, ImageBase64
					(c: any) => c.propertyName !== 'To' && c.propertyName !== 'Value' && c.propertyName !== 'InformativeScreenshot' && c.propertyName !== 'ImageBase64'
				);
				renderDiffChangeList(changesDiv, otherChanges); // render using helper function
			} else {
				// normal property change display (classified as main/sub, screenshots shown separately as comparison)
				const nonScreenshotChanges = item.changes.filter( // extract changes other than InformativeScreenshot and ImageBase64
					(c: any) => c.propertyName !== 'InformativeScreenshot' && c.propertyName !== 'ImageBase64'
				);
				const { main: mainChanges, sub: subChanges } = categorizeDiffChanges(nonScreenshotChanges, item.activity.type); // categorize changes
				renderDiffChangeList(changesDiv, mainChanges); // display main changes

				// display sub-property changes in a collapsible panel
				if (subChanges.length > 0) { // if there are sub changes
					const subToggle = document.createElement('button'); // toggle button
					subToggle.className = 'property-sub-panel-toggle'; // CSS class
					subToggle.textContent = `${t('Toggle property panel')} ▶`; // label in collapsed state

					const subPanel = document.createElement('div'); // sub-panel
					subPanel.className = 'property-sub-panel'; // CSS class
					subPanel.style.display = 'none'; // initially hidden

					renderDiffChangeList(subPanel, subChanges); // render sub changes into panel

					subToggle.addEventListener('click', (e) => { // toggle click event
						e.stopPropagation(); // stop propagation to parent elements
						const isExpanded = subPanel.style.display !== 'none'; // current display state
						subPanel.style.display = isExpanded ? 'none' : 'block'; // toggle display
						subToggle.textContent = isExpanded // update label
							? `${t('Toggle property panel')} ▶` // collapsed state
							: `${t('Toggle property panel')} ▼`; // expanded state
					});

					changesDiv.appendChild(subToggle); // add toggle button
					changesDiv.appendChild(subPanel); // add panel
				}
			}
			// insert after activity-header
			const header = card.querySelector(':scope > .activity-header'); // header element
			if (header && header.nextSibling) {
				card.insertBefore(changesDiv, header.nextSibling); // insert immediately after header
			} else {
				card.appendChild(changesDiv); // fallback: append to end of card
			}

			// if InformativeScreenshot changed, build comparison display
			const screenshotChange = item.changes.find( // find screenshot change
				(c: any) => c.propertyName === 'InformativeScreenshot'
			);
			if (screenshotChange && baseScreenshotResolver && headScreenshotResolver) {
				// remove existing screenshot display
				const existingScreenshot = card.querySelector(':scope > .informative-screenshot'); // existing element
				if (existingScreenshot) existingScreenshot.remove(); // remove

				// build comparison container
				const compareDiv = document.createElement('div'); // comparison container
				compareDiv.className = 'screenshot-compare'; // CSS class

				// before state
				const beforeBox = document.createElement('div'); // before box
				beforeBox.className = 'screenshot-before'; // CSS class (red left border)
				const beforeImg = document.createElement('img'); // before image
				beforeImg.src = baseScreenshotResolver(screenshotChange.before); // base-side URL
				beforeImg.alt = 'Before screenshot'; // alt attribute
				beforeImg.onerror = () => { beforeImg.style.display = 'none'; }; // hide on load error
				beforeBox.appendChild(beforeImg);
				compareDiv.appendChild(beforeBox);

				// after state
				const afterBox = document.createElement('div'); // after box
				afterBox.className = 'screenshot-after'; // CSS class (green left border)
				const afterImg = document.createElement('img'); // after image
				afterImg.src = headScreenshotResolver(screenshotChange.after); // head-side URL
				afterImg.alt = 'After screenshot'; // alt attribute
				afterImg.onerror = () => { afterImg.style.display = 'none'; }; // hide on load error
				afterBox.appendChild(afterImg);
				compareDiv.appendChild(afterBox);
				card.appendChild(compareDiv); // add to card
			}
		}
	}

	// highlight added activities
	for (const item of diffResult.added) {
		const key = buildActivityKey(item.activity, 0); // generate key
		const card = container.querySelector(`[data-activity-key="${key}"]`) as HTMLElement; // find card
		if (!card) continue;
		card.classList.add('diff-highlight-added'); // add added highlight class
	}

	// display removed activities at the bottom (they don't exist in the head version)
	if (diffResult.removed.length > 0) {
		const removedSection = document.createElement('div'); // removed section
		removedSection.className = 'removed-activities-section'; // CSS class

		const removedLabel = document.createElement('div'); // removed label
		removedLabel.className = 'status-deleted-file'; // CSS class
		removedLabel.textContent = `Removed Activities (${diffResult.removed.length})`; // label text
		removedSection.appendChild(removedLabel);

		for (const item of diffResult.removed) {
			const card = document.createElement('div'); // removed card
			card.className = 'activity-card diff-highlight-removed'; // CSS class

			const header = document.createElement('div'); // header
			header.className = 'activity-header'; // CSS class

			const title = document.createElement('span'); // title
			title.className = 'activity-title'; // CSS class
			title.textContent = `${item.activity.type}: ${item.activity.displayName} `; // activity name

			const badge = document.createElement('span'); // badge
			badge.className = 'badge badge-removed'; // CSS class
			badge.textContent = '- Removed'; // badge text
			title.appendChild(badge);

			header.appendChild(title);
			card.appendChild(header);
			removedSection.appendChild(card); // add to section
		}
		container.appendChild(removedSection); // add to container
	}
}

// ========== Initialization and MutationObserver ==========

/**
 * Main initialization function
 */
async function init(): Promise<void> {
	console.log('UiPath XAML Visualizer for GitHub has been loaded'); // log output
	await loadLanguagePreference(); // load language preference
	injectSyncHighlightStyles(); // inject CSS for GitHub-side highlights

	const pageType = detectPageType(); // detect page type

	switch (pageType) {
		case 'blob-xaml':
			addVisualizerButton(); // add button to individual file page
			break;
		case 'pr-diff':
			scanAndInjectDiffButtons(); // inject buttons to PR diff page
			break;
		case 'commit-diff':
			scanAndInjectDiffButtons(showCommitDiffVisualizer); // inject buttons to commit/Compare diff page
			break;
		default:
			break; // do nothing on other pages
	}
}

// Ctrl+F (Mac: Cmd+F) focuses the search input
document.addEventListener('keydown', (e: KeyboardEvent) => {
	if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
		const panel = document.getElementById('uipath-visualizer-panel'); // check if panel exists
		if (!panel) return; // let browser default handle if no panel
		const searchInput = panel.querySelector('.panel-search-input') as HTMLInputElement; // search input element
		if (!searchInput) return;
		e.preventDefault(); // suppress browser default search
		searchInput.focus(); // set focus
		searchInput.select(); // select all text
	}
});

// Escape key closes the panel
document.addEventListener('keydown', (e: KeyboardEvent) => {
	if (e.key !== 'Escape') return; // skip non-Escape keys
	const panel = document.getElementById('uipath-visualizer-panel'); // check if panel exists
	if (!panel) return; // skip if no panel
	// skip if search input is focused (search Escape takes priority)
	const searchInput = panel.querySelector('.panel-search-input') as HTMLInputElement; // search input element
	if (searchInput && document.activeElement === searchInput) return; // delegate to search Escape
	closePanel(); // close panel and restore page layout
});

// initialize on page load
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init); // initialize after DOM load
} else {
	init(); // initialize immediately if already loaded
}

// record the current URL
lastUrl = window.location.href;

// handle GitHub SPA navigation (MutationObserver with debounce)
const observer = new MutationObserver(() => {
	// debounce: batch rapid changes within 300ms
	if (debounceTimer) clearTimeout(debounceTimer);

	debounceTimer = setTimeout(() => {
		const currentUrl = window.location.href; // current URL

		if (currentUrl !== lastUrl) {
			// URL changed -> clear cache and re-initialize
			cachedPrRefs = null; // clear PR cache
			lastUrl = currentUrl; // update URL
			init(); // re-initialize
		} else {
			// same URL, DOM changed -> re-scan buttons for lazy-loaded diffs
			const currentPageType = detectPageType(); // current page type
			if (currentPageType === 'pr-diff') {
				scanAndInjectDiffButtons(); // PR diff page
			} else if (currentPageType === 'commit-diff') {
				scanAndInjectDiffButtons(showCommitDiffVisualizer); // commit/Compare diff page
			}
		}
	}, 300); // 300ms debounce
});

observer.observe(document.body, {
	childList: true, // observe child element changes
	subtree: true    // also observe subtree
});
