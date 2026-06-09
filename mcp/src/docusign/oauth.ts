// DocuSign OAuth 2.0 Authorization Code + PKCE for a PUBLIC client (the
// customer's own integration key, no client secret). Spins a loopback HTTP
// server on 127.0.0.1, opens the system browser to the DocuSign consent page,
// and exchanges the returned code for an access token. Zero dependencies —
// node:crypto, node:http, node:child_process only.

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";

export type DocuSignEnv = "demo" | "prod";

export interface DocuSignAccount {
  account_id: string;
  account_name?: string;
  base_uri: string;
  is_default?: boolean | string;
}

export interface OAuthResult {
  accessToken: string;
  accounts: DocuSignAccount[];
}

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function authBase(env: DocuSignEnv): string {
  return env === "prod" ? "https://account.docusign.com" : "https://account-d.docusign.com";
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function openBrowser(url: string): void {
  const [cmd, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* browser open failed — the URL is printed for manual use */
    });
    child.unref();
  } catch {
    /* same: manual fallback via the printed URL */
  }
}

// Runs the full browser flow and returns an access token plus the user's
// DocuSign accounts ({account_id, base_uri, is_default}) from /oauth/userinfo.
export async function authorize(
  env: DocuSignEnv,
  integrationKey: string,
  log: (msg: string) => void = (m) => console.error(m)
): Promise<OAuthResult> {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  const server = createServer();
  // DOCUSIGN_REDIRECT_PORT pins the port when the integration key's registered
  // redirect URI requires a fixed one; default is an OS-assigned random port.
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(process.env.DOCUSIGN_REDIRECT_PORT) || 0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for the DocuSign sign-in (5 minutes)."));
    }, LOGIN_TIMEOUT_MS);

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const finish = (ok: boolean, err?: Error) => {
        res
          .writeHead(ok ? 200 : 400, { "content-type": "text/html" })
          .end(
            ok
              ? "<h3>Signed in to DocuSign — you can close this tab and return to the terminal.</h3>"
              : "<h3>DocuSign sign-in failed — you can close this tab. See the terminal for details.</h3>"
          );
        clearTimeout(timer);
        if (ok) resolve(url.searchParams.get("code")!);
        else reject(err);
      };
      const error = url.searchParams.get("error");
      if (error) {
        finish(false, new Error(`DocuSign authorization failed: ${error}${url.searchParams.get("error_description") ? ` — ${url.searchParams.get("error_description")}` : ""}`));
      } else if (url.searchParams.get("state") !== state) {
        finish(false, new Error("OAuth state mismatch on the callback — aborting."));
      } else if (!url.searchParams.get("code")) {
        finish(false, new Error("DocuSign callback did not include an authorization code."));
      } else {
        finish(true);
      }
    });
  });

  const authUrl = new URL(`${authBase(env)}/oauth/auth`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "signature");
  authUrl.searchParams.set("client_id", integrationKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  log(`Opening your browser to sign in to DocuSign (${env})…`);
  log(`If it does not open, visit:\n  ${authUrl.toString()}`);
  log(`(Your integration key must allow the redirect URI ${redirectUri} — set DOCUSIGN_REDIRECT_PORT to pin the port.)`);
  openBrowser(authUrl.toString());

  let code: string;
  try {
    code = await codePromise;
  } finally {
    server.close();
  }

  const tokenRes = await fetch(`${authBase(env)}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: integrationKey,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`DocuSign token exchange failed (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 300)}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("DocuSign token response did not include an access_token.");
  }

  const userRes = await fetch(`${authBase(env)}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`DocuSign userinfo failed (${userRes.status}): ${(await userRes.text()).slice(0, 300)}`);
  }
  const userinfo = (await userRes.json()) as { accounts?: DocuSignAccount[] };
  const accounts = (userinfo.accounts ?? []).filter((a) => a.account_id && a.base_uri);
  if (accounts.length === 0) {
    throw new Error("Your DocuSign user has no accounts visible to this integration key.");
  }

  return { accessToken: token.access_token, accounts };
}
