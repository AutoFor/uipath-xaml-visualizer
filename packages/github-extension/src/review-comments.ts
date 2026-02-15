/**
 * GitHub PR レビューコメント取得・投稿・マッピングモジュール
 * コメントの取得、アクティビティへのマッピング、新規コメント投稿を担当
 */

import type { ActivityLineIndex } from '@uipath-xaml-visualizer/shared'; // 行マッピング型定義

// ========== 型定義 ==========

/**
 * PRの基本情報
 */
export interface PrInfo {
  owner: string;   // リポジトリオーナー
  repo: string;    // リポジトリ名
  prNumber: number; // PR番号
}

/**
 * GitHub PRレビューコメント
 */
export interface ReviewComment {
  id: number;                // コメントID
  body: string;              // コメント本文
  user: {                    // 投稿ユーザー
    login: string;           // ユーザー名
    avatar_url: string;      // アバターURL
  };
  created_at: string;        // 作成日時
  updated_at: string;        // 更新日時
  path: string;              // ファイルパス
  line: number | null;       // コメント対象行（endLine）
  start_line: number | null; // 複数行コメントの開始行
  side: 'LEFT' | 'RIGHT';   // diff側（LEFT=base, RIGHT=head）
  html_url: string;          // コメントのWeb URL
}

/**
 * コメント投稿パラメータ
 */
export interface PostCommentParams {
  body: string;       // コメント本文
  commitId: string;   // コミットSHA
  path: string;       // ファイルパス
  line: number;       // コメント対象行（endLine）
  startLine?: number; // 複数行コメントの開始行
  side: 'LEFT' | 'RIGHT'; // diff側
}

// ========== コメント取得 ==========

/**
 * PR のレビューコメントを取得（ファイルパスでフィルタ）
 * 方法1: github.com 同一オリジン fetch（プライベートリポジトリ対応）
 * 方法2: api.github.com credentials なし fetch（公開リポジトリ用フォールバック）
 */
export async function fetchReviewComments(
  pr: PrInfo,
  filePath: string
): Promise<ReviewComment[]> {
  // 方法1: github.com 同一オリジン fetch（セッションCookieでプライベートリポジトリ対応）
  const sameOriginComments = await fetchReviewCommentsSameOrigin(pr, filePath); // 同一オリジンで取得
  if (sameOriginComments !== null) return sameOriginComments; // 成功した場合はそのまま返す

  // 方法2: api.github.com フォールバック（公開リポジトリ用）
  console.log('UiPath Visualizer: 同一オリジン取得失敗、API にフォールバック');
  return fetchReviewCommentsApi(pr, filePath); // API で取得
}

/**
 * 方法1: github.com 同一オリジンでコメント取得（プライベートリポジトリ対応）
 * 成功時は ReviewComment[]、失敗時は null を返す
 */
async function fetchReviewCommentsSameOrigin(
  pr: PrInfo,
  filePath: string
): Promise<ReviewComment[] | null> {
  const url = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.prNumber}/review_comments`; // 同一オリジンURL

  let response: Response; // レスポンス
  try {
    response = await fetch(url, {
      headers: { 'Accept': 'application/json' }, // JSONレスポンスを要求
      credentials: 'same-origin' // 同一オリジンCookie送信（プライベートリポジトリ認証）
    });
  } catch (e) {
    console.warn('UiPath Visualizer: コメント取得エラー (同一オリジン):', e);
    return null; // ネットワークエラー → フォールバック
  }

  if (!response.ok) {
    console.warn(`UiPath Visualizer: コメント取得失敗 (同一オリジン): status=${response.status}`);
    return null; // エラー → フォールバック
  }

  // レスポンスが JSON か確認（HTML が返る場合はフォールバック）
  const contentType = response.headers.get('content-type') || ''; // Content-Type ヘッダ
  if (!contentType.includes('json')) {
    console.warn('UiPath Visualizer: 同一オリジンが JSON でないレスポンスを返却、API にフォールバック');
    return null; // JSON でない → フォールバック
  }

  let data: any; // レスポンスデータ
  try {
    data = await response.json(); // JSON パース
  } catch (e) {
    console.warn('UiPath Visualizer: 同一オリジン JSON パースエラー:', e);
    return null; // パースエラー → フォールバック
  }

  // デバッグ: レスポンス構造を出力
  console.log('UiPath Visualizer: 同一オリジン レスポンス構造:', typeof data, Array.isArray(data) ? `array[${data.length}]` : Object.keys(data)); // デバッグ用
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    console.log('UiPath Visualizer: 同一オリジン レスポンスキー:', Object.keys(data)); // オブジェクトのキー一覧
    // 各キーの型と値のプレビューを出力
    for (const key of Object.keys(data).slice(0, 10)) { // 最初の10キーまで
      const val = data[key]; // 値
      console.log(`  ${key}: ${typeof val}${Array.isArray(val) ? `[${val.length}]` : ''}${typeof val === 'string' ? ` = "${val.slice(0, 100)}"` : ''}`); // 型とプレビュー
    }
  }

  // レスポンス形式を正規化（配列でない場合も対応）
  const comments = normalizeReviewComments(data); // 正規化
  if (comments === null) {
    console.warn('UiPath Visualizer: 同一オリジンのレスポンス形式が不明、API にフォールバック');
    return null; // 不明な形式 → フォールバック
  }

  // ファイルパスでフィルタ
  const filtered = comments.filter(comment => comment.path === filePath); // 対象ファイルのコメントのみ
  console.log(`UiPath Visualizer: レビューコメント ${filtered.length}件取得 (同一オリジン, ${filePath})`);
  return filtered;
}

/**
 * 方法2: api.github.com でコメント取得（公開リポジトリ用フォールバック）
 * ページネーション対応で全件取得
 */
async function fetchReviewCommentsApi(
  pr: PrInfo,
  filePath: string
): Promise<ReviewComment[]> {
  const allComments: ReviewComment[] = []; // 全コメント
  let page = 1; // ページ番号
  const perPage = 100; // 1ページあたりの取得数

  // ページネーション対応でコメントを全件取得
  while (true) {
    const url = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}/comments?per_page=${perPage}&page=${page}`; // API URL

    // credentials なしで fetch（GitHub API は Access-Control-Allow-Origin: * のため credentials 付きは CORS エラー）
    let response: Response; // レスポンス
    try {
      response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
      });
    } catch (e) {
      console.warn('UiPath Visualizer: コメント取得エラー (API):', e);
      break; // ネットワークエラー
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn(`UiPath Visualizer: コメント取得失敗 (API ${response.status}): プライベートリポジトリの場合は認証が必要です`);
      } else if (response.status === 404) {
        console.warn('UiPath Visualizer: コメント取得失敗 (API 404): PRが見つかりません');
      } else {
        console.warn(`UiPath Visualizer: コメント取得失敗 (API): status=${response.status}`);
      }
      break;
    }

    const data: ReviewComment[] = await response.json(); // レスポンスをパース

    if (data.length === 0) break; // これ以上コメントなし

    // ファイルパスでフィルタして追加
    const filtered = data.filter(comment => comment.path === filePath); // 対象ファイルのコメントのみ
    allComments.push(...filtered);

    if (data.length < perPage) break; // 最後のページ
    page++; // 次のページ
  }

  console.log(`UiPath Visualizer: レビューコメント ${allComments.length}件取得 (API, ${filePath})`);
  return allComments;
}

/**
 * github.com 内部エンドポイントのレスポンスを ReviewComment[] に正規化
 * API 形式と異なる場合に対応する変換レイヤー
 * 正規化できない場合は null を返す
 */
function normalizeReviewComments(data: any): ReviewComment[] | null {
  // 配列の場合（API と同じ形式、またはコメント配列）
  const items = Array.isArray(data) ? data : Array.isArray(data?.comments) ? data.comments : null; // 配列を抽出
  if (!items) return null; // 配列でない → 正規化不可

  const result: ReviewComment[] = []; // 結果
  for (const item of items) {
    // 必須フィールドの存在確認
    if (!item || typeof item.path !== 'string') continue; // path がなければスキップ

    result.push({
      id: item.id ?? 0, // コメントID
      body: item.body ?? '', // コメント本文
      user: {
        login: item.user?.login ?? '', // ユーザー名
        avatar_url: item.user?.avatar_url ?? item.user?.avatarUrl ?? '' // アバターURL（camelCase 対応）
      },
      created_at: item.created_at ?? item.createdAt ?? '', // 作成日時（camelCase 対応）
      updated_at: item.updated_at ?? item.updatedAt ?? '', // 更新日時（camelCase 対応）
      path: item.path, // ファイルパス
      line: item.line ?? item.original_line ?? null, // コメント対象行
      start_line: item.start_line ?? item.startLine ?? null, // 開始行（camelCase 対応）
      side: item.side === 'LEFT' ? 'LEFT' : 'RIGHT', // diff側（デフォルト RIGHT）
      html_url: item.html_url ?? item.htmlUrl ?? '' // Web URL（camelCase 対応）
    });
  }

  return result;
}

// ========== コメント → アクティビティマッピング ==========

/**
 * レビューコメントをアクティビティキーにマッピング
 */
export function mapCommentsToActivities(
  comments: ReviewComment[],
  headLineIndex: ActivityLineIndex | null,
  baseLineIndex: ActivityLineIndex | null
): Map<string, ReviewComment[]> {
  const commentsMap = new Map<string, ReviewComment[]>(); // 結果マップ

  for (const comment of comments) {
    const targetLine = comment.line; // コメント対象行
    if (!targetLine) continue; // 行番号なしのコメントはスキップ

    // side に基づいて適切な行マップを選択
    const lineIndex = comment.side === 'LEFT' ? baseLineIndex : headLineIndex; // LEFT=base, RIGHT=head
    if (!lineIndex) continue; // 行マップがない場合はスキップ

    const activityKey = lineIndex.lineToKey.get(targetLine); // 行番号からアクティビティキーを逆引き
    if (!activityKey) continue; // マッピングできないコメントはスキップ

    // マップに追加
    const existing = commentsMap.get(activityKey) || []; // 既存コメントリスト
    existing.push(comment);
    commentsMap.set(activityKey, existing);
  }

  console.log(`UiPath Visualizer: ${commentsMap.size}個のアクティビティにコメントをマッピング`);
  return commentsMap;
}

// ========== コメント投稿 ==========

/**
 * レビューコメントを投稿
 */
export async function postReviewComment(
  pr: PrInfo,
  params: PostCommentParams
): Promise<ReviewComment | null> {
  const url = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}/comments`; // API URL

  // リクエストボディ
  const body: Record<string, any> = {
    body: params.body,               // コメント本文
    commit_id: params.commitId,      // コミットSHA
    path: params.path,               // ファイルパス
    line: params.line,               // コメント対象行
    side: params.side                // diff側
  };

  // 複数行コメントの場合はstart_lineを追加
  if (params.startLine && params.startLine !== params.line) {
    body.start_line = params.startLine; // 開始行
    body.start_side = params.side; // 開始行のdiff側
  }

  // 方法1: GitHub DOM内のCSRFトークンを使った同一オリジンPOST（github.com 上で動作、プライベートリポジトリ対応）
  try {
    const csrfToken = extractCsrfToken(); // CSRFトークンを取得
    if (csrfToken) {
      const formUrl = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.prNumber}/review_comment`; // GitHub内部エンドポイント

      const formData = new FormData(); // フォームデータ
      formData.append('authenticity_token', csrfToken); // CSRFトークン
      formData.append('comment[body]', params.body); // コメント本文
      formData.append('comment[commit_id]', params.commitId); // コミットSHA
      formData.append('comment[path]', params.path); // ファイルパス
      formData.append('comment[line]', String(params.line)); // 対象行
      formData.append('comment[side]', params.side); // diff側

      if (params.startLine && params.startLine !== params.line) {
        formData.append('comment[start_line]', String(params.startLine)); // 開始行
        formData.append('comment[start_side]', params.side); // 開始行のdiff側
      }

      const response = await fetch(formUrl, {
        method: 'POST',
        credentials: 'same-origin', // 同一オリジンCookie送信
        body: formData
      });

      if (response.ok) {
        console.log('UiPath Visualizer: コメント投稿成功 (CSRF)');
        // レスポンスがHTMLのため、最低限の情報で返す
        return {
          id: Date.now(), // 仮ID
          body: params.body,
          user: { login: '', avatar_url: '' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          path: params.path,
          line: params.line,
          start_line: params.startLine || null,
          side: params.side,
          html_url: ''
        };
      }

      console.warn(`UiPath Visualizer: コメント投稿失敗 (CSRF): status=${response.status}`);
    }
  } catch (e) {
    console.warn('UiPath Visualizer: コメント投稿エラー (CSRF):', e);
  }

  // 方法2: API（credentials なし）にフォールバック（パブリックリポジトリ用）
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body) // ボディをJSON文字列化
    });

    if (response.ok) {
      const comment: ReviewComment = await response.json(); // レスポンスをパース
      console.log('UiPath Visualizer: コメント投稿成功 (API)');
      return comment;
    }

    console.warn(`UiPath Visualizer: コメント投稿失敗 (API): status=${response.status}`);
  } catch (e) {
    console.warn('UiPath Visualizer: コメント投稿エラー (API):', e);
  }

  console.error('UiPath Visualizer: コメント投稿失敗 - 全手段で失敗');
  return null;
}

// ========== ヘルパー関数 ==========

/**
 * GitHub ページからCSRFトークンを抽出
 */
function extractCsrfToken(): string | null {
  // meta タグから取得
  const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement; // CSRFメタタグ
  if (metaTag?.content) return metaTag.content;

  // hidden input から取得
  const input = document.querySelector('input[name="authenticity_token"]') as HTMLInputElement; // CSRFトークンinput
  if (input?.value) return input.value;

  return null;
}
