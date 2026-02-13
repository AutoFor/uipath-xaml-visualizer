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
 */
export async function fetchReviewComments(
  pr: PrInfo,
  filePath: string
): Promise<ReviewComment[]> {
  const allComments: ReviewComment[] = []; // 全コメント
  let page = 1; // ページ番号
  const perPage = 100; // 1ページあたりの取得数

  // ページネーション対応でコメントを全件取得
  while (true) {
    const url = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}/comments?per_page=${perPage}&page=${page}`; // API URL

    let response: Response | null = null; // レスポンス

    // 方法1: credentials: 'include'（Chrome拡張のhost_permissionsでCookie送信）
    try {
      response = await fetch(url, {
        credentials: 'include', // Cookie付きリクエスト
        headers: { 'Accept': 'application/vnd.github.v3+json' } // GitHub API v3
      });
    } catch (e) {
      console.warn('UiPath Visualizer: コメント取得エラー (include):', e);
    }

    // 方法2: credentials: 'same-origin' にフォールバック
    if (!response || !response.ok) {
      try {
        response = await fetch(url, {
          credentials: 'same-origin', // 同一オリジンCookie送信
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
      } catch (e) {
        console.warn('UiPath Visualizer: コメント取得エラー (same-origin):', e);
      }
    }

    // 方法3: Cookie なしフォールバック（パブリックリポジトリ用）
    if (!response || !response.ok) {
      try {
        response = await fetch(url, {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
      } catch (e) {
        console.warn('UiPath Visualizer: コメント取得エラー (no-auth):', e);
        break; // 全手段失敗
      }
    }

    if (!response || !response.ok) {
      console.warn(`UiPath Visualizer: コメント取得失敗: status=${response?.status}`);
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

  console.log(`UiPath Visualizer: レビューコメント ${allComments.length}件取得 (${filePath})`);
  return allComments;
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

  // 方法1: credentials: 'include' でAPI経由投稿
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include', // Cookie付きリクエスト
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

  // 方法2: GitHub DOM内のCSRFトークンを使った同一オリジンPOSTにフォールバック
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
        console.log('UiPath Visualizer: コメント投稿成功 (CSRF fallback)');
        // フォールバックではレスポンスがHTMLのため、最低限の情報で返す
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
    }
  } catch (e) {
    console.warn('UiPath Visualizer: コメント投稿エラー (CSRF fallback):', e);
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
