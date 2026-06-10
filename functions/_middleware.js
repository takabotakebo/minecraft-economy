/**
 * Cloudflare Pages Functions - Basic 認証ミドルウェア
 * site/ 配下の全リクエストに Basic 認証をかける。
 *
 * 認証情報（ユーザー/パスワード）は環境変数で上書きできます。
 *   - BASIC_AUTH_USER : ユーザー名（未設定なら "gkr"）
 *   - BASIC_AUTH_PASS : パスワード（未設定なら "gkr"）
 * Cloudflare ダッシュボードの Settings > Environment variables で設定すると、
 * 認証情報をソースコードに残さず運用できます（推奨）。
 */

const DEFAULT_USER = "gkr";
const DEFAULT_PASS = "gkr";
const REALM = "Minecraft Economy World";

export const onRequest = async (context) => {
  const { request, next, env } = context;

  const expectedUser = (env && env.BASIC_AUTH_USER) || DEFAULT_USER;
  const expectedPass = (env && env.BASIC_AUTH_PASS) || DEFAULT_PASS;

  const header = request.headers.get("Authorization") || "";

  if (header.startsWith("Basic ")) {
    const encoded = header.slice(6).trim();
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch (e) {
      decoded = "";
    }
    // "user:pass" 形式。パスワードに ":" が含まれても良いよう最初の ":" で分割
    const idx = decoded.indexOf(":");
    const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const pass = idx >= 0 ? decoded.slice(idx + 1) : "";

    if (timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) {
      // 認証成功 → 通常のアセット配信へ
      return next();
    }
  }

  // 認証失敗・未認証 → 認証ダイアログを要求
  return new Response("認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

/** タイミング攻撃に少し配慮した文字列比較 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
