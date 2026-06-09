// `swiftsign-mcp import-docusign` — export your own DocuSign templates and
// re-create them as SwiftSign templates. Customer-run and BYO integration key:
// the OAuth happens in your browser against your DocuSign account, documents
// flow directly from DocuSign to your machine to your SwiftSign account, and
// nothing is proxied through SwiftSign servers.

import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { createInterface } from "node:readline/promises";
import { PDFDocument } from "pdf-lib";
import { authorize, type DocuSignAccount, type DocuSignEnv } from "./docusign/oauth.js";
import { DocuSignClient, type DsTemplateSummary } from "./docusign/client.js";
import { mapTemplate, type MapDocInput } from "./docusign/map.js";
import { formatApiError } from "./tools.js";

const USAGE = `Usage: swiftsign-mcp import-docusign [options]

Export your DocuSign templates and import them into SwiftSign. Runs entirely
on your machine with your own DocuSign integration key (read-only export).

Options:
  --env demo|prod          DocuSign environment to read from (default: demo)
  --integration-key <id>   Your DocuSign integration key (a public OAuth client
                           from DocuSign Admin > Apps and Keys); or set
                           DOCUSIGN_INTEGRATION_KEY
  --only <id-or-name>      Import only this template; repeatable
  --prefix <str>           Prefix added to every imported template name
  --dry-run                Convert and report, but create nothing in SwiftSign
  --yes                    Skip the confirmation prompt
  -h, --help               Show this help

Environment:
  SWIFTSIGN_API_KEY        Required unless --dry-run (mint a sandbox key with
                           the swiftsign_signup MCP tool)
  SWIFTSIGN_API_URL        SwiftSign base URL (default: https://swiftsign.ca)
  DOCUSIGN_INTEGRATION_KEY Fallback for --integration-key
  DOCUSIGN_REDIRECT_PORT   Pin the local OAuth callback port (default: random)

Writes import-report.json to the current directory.`;

export interface CliOptions {
  env: DocuSignEnv;
  dryRun: boolean;
  only: string[];
  prefix: string;
  integrationKey?: string;
  yes: boolean;
  help: boolean;
}

export class UsageError extends Error {}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { env: "demo", dryRun: false, only: [], prefix: "", yes: false, help: false };
  const next = (flag: string, i: number): string => {
    const v = argv[i + 1];
    if (v === undefined) throw new UsageError(`${flag} requires a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--env": {
        const v = next(arg, i++);
        if (v !== "demo" && v !== "prod") throw new UsageError(`--env must be "demo" or "prod", got "${v}"`);
        opts.env = v;
        break;
      }
      case "--integration-key":
        opts.integrationKey = next(arg, i++);
        break;
      case "--only":
        opts.only.push(next(arg, i++));
        break;
      case "--prefix":
        opts.prefix = next(arg, i++);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--yes":
      case "-y":
        opts.yes = true;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new UsageError(`Unknown argument "${arg}"`);
    }
  }
  return opts;
}

interface TemplateReport {
  docusignTemplateId: string;
  name: string;
  status: "imported" | "dry-run" | "failed";
  swiftsignTemplateId?: string;
  documents: number;
  roles: number;
  fields: number;
  warnings: string[];
  error?: string;
}

const log = (msg: string) => console.error(msg);

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function pickAccount(accounts: DocuSignAccount[], yes: boolean): Promise<DocuSignAccount> {
  const fallback = accounts.find((a) => a.is_default === true || a.is_default === "true") ?? accounts[0];
  if (accounts.length === 1 || yes) return fallback;
  log("\nYour DocuSign accounts:");
  accounts.forEach((a, i) => {
    const def = a === fallback ? " (default)" : "";
    log(`  [${i + 1}] ${a.account_name ?? a.account_id}${def} — ${a.base_uri}`);
  });
  const answer = await ask(`Account to export from [${accounts.indexOf(fallback) + 1}]: `);
  if (answer === "") return fallback;
  const n = parseInt(answer, 10);
  if (!Number.isFinite(n) || n < 1 || n > accounts.length) throw new UsageError(`Invalid account choice "${answer}"`);
  return accounts[n - 1];
}

function matchesOnly(t: DsTemplateSummary, only: string[]): boolean {
  if (only.length === 0) return true;
  return only.some(
    (o) =>
      (t.templateId ?? "").toLowerCase() === o.toLowerCase() ||
      (t.name ?? "").toLowerCase() === o.toLowerCase()
  );
}

async function pageSizesPt(buffer: Buffer): Promise<MapDocInput["pageSizesPt"]> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  return pdf.getPages().map((p) => {
    const { width, height } = p.getSize();
    return { w: width, h: height, rotation: p.getRotation().angle };
  });
}

async function createSwiftSignTemplate(
  apiUrl: string,
  apiKey: string,
  payload: unknown
): Promise<{ id: string }> {
  const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/v1/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // SwiftSign errors are RFC 9457 problem+json; formatApiError surfaces code/detail.
    throw new Error(formatApiError(res.status, await res.text()));
  }
  return (await res.json()) as { id: string };
}

export async function runImportDocusign(argv: string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    log(`\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    log(USAGE);
    return 0;
  }

  const apiUrl = process.env.SWIFTSIGN_API_URL || process.env.SWIFTSIGN_URL || "https://swiftsign.ca";
  const apiKey = process.env.SWIFTSIGN_API_KEY;
  if (!apiKey && !opts.dryRun) {
    log(
      "SWIFTSIGN_API_KEY is not set. Mint a sandbox key with the swiftsign_signup MCP tool (sk_test_…), export it, and re-run — or use --dry-run to preview without importing."
    );
    return 2;
  }
  const integrationKey = opts.integrationKey || process.env.DOCUSIGN_INTEGRATION_KEY;
  if (!integrationKey) {
    log(
      "A DocuSign integration key is required (--integration-key <id> or DOCUSIGN_INTEGRATION_KEY).\nCreate one in your DocuSign Admin under Apps and Keys (a public OAuth client; no secret needed). SwiftSign never sees your DocuSign credentials."
    );
    return 2;
  }

  // 1. OAuth (browser) + account selection.
  const { accessToken, accounts } = await authorize(opts.env, integrationKey, log);
  const account = await pickAccount(accounts, opts.yes);
  log(`Using DocuSign account ${account.account_name ?? account.account_id} (${account.account_id})`);
  const client = new DocuSignClient(account.base_uri, account.account_id, accessToken, log);

  // 2. List + filter templates.
  const allTemplates = await client.listTemplates();
  const templates = allTemplates.filter((t) => matchesOnly(t, opts.only));
  for (const o of opts.only) {
    if (!templates.some((t) => matchesOnly(t, [o]))) log(`--only "${o}" matched no template; ignored`);
  }
  if (templates.length === 0) {
    log(allTemplates.length === 0 ? "No templates found in this DocuSign account." : "No templates matched the --only filter(s).");
    return allTemplates.length === 0 ? 0 : 1;
  }

  log(`Found ${templates.length} template(s) to ${opts.dryRun ? "convert (dry run)" : `import into ${apiUrl}`}.`);
  if (!opts.yes && !opts.dryRun) {
    const answer = await ask(`Import ${templates.length} template(s)? [y/N]: `);
    if (!/^y(es)?$/i.test(answer)) {
      log("Aborted.");
      return 1;
    }
  }

  // 3. Per template: fetch detail -> download docs -> measure pages -> map -> create.
  const reports: TemplateReport[] = [];
  for (let i = 0; i < templates.length; i++) {
    const summary = templates[i];
    const id = summary.templateId ?? "";
    const displayName = summary.name ?? id;
    const progress = `[${i + 1}/${templates.length}]`;
    try {
      const detail = await client.getTemplate(id);
      const dsDocs = detail.documents ?? [];
      if (dsDocs.length === 0) throw new Error("template has no documents");

      const docs: MapDocInput[] = [];
      const docWarnings: string[] = [];
      for (const d of dsDocs) {
        const buffer = await client.downloadDocument(id, String(d.documentId ?? ""));
        let sizes: MapDocInput["pageSizesPt"] = [];
        try {
          sizes = await pageSizesPt(buffer);
        } catch (err) {
          docWarnings.push(
            `could not read page sizes of "${d.name ?? d.documentId}" (${err instanceof Error ? err.message : err}); positions assume US Letter`
          );
        }
        docs.push({ buffer, pageSizesPt: sizes });
      }

      const { createPayload, warnings } = mapTemplate(detail, docs);
      warnings.unshift(...docWarnings);
      if (opts.prefix) createPayload.name = `${opts.prefix}${createPayload.name}`;

      const report: TemplateReport = {
        docusignTemplateId: id,
        name: createPayload.name,
        status: "dry-run",
        documents: createPayload.documents.length,
        roles: createPayload.roles.length,
        fields: createPayload.fields.length,
        warnings,
      };

      if (createPayload.roles.length === 0) {
        report.status = "failed";
        report.error = "no importable recipients (SwiftSign requires at least one SIGNER or CC role)";
      } else if (!opts.dryRun) {
        const created = await createSwiftSignTemplate(apiUrl, apiKey!, createPayload);
        report.status = "imported";
        report.swiftsignTemplateId = created.id;
      }
      reports.push(report);

      const tail =
        report.status === "imported"
          ? `imported (${report.swiftsignTemplateId})`
          : report.status === "dry-run"
            ? "dry run — not created"
            : `FAILED: ${report.error}`;
      log(
        `${progress} ${report.name} — ${report.documents} doc(s), ${report.roles} role(s), ${report.fields} field(s), ${warnings.length} warning(s) → ${tail}`
      );
      for (const w of warnings) log(`    ! ${w}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reports.push({
        docusignTemplateId: id,
        name: displayName,
        status: "failed",
        documents: 0,
        roles: 0,
        fields: 0,
        warnings: [],
        error: message,
      });
      log(`${progress} ${displayName} → FAILED: ${message}`);
    }
  }

  // 4. Summary + report file.
  const imported = reports.filter((r) => r.status === "imported").length;
  const dryRun = reports.filter((r) => r.status === "dry-run").length;
  const failed = reports.filter((r) => r.status === "failed").length;
  const warningCount = reports.reduce((n, r) => n + r.warnings.length, 0);
  log(
    `\nDone: ${imported} imported, ${dryRun} dry-run, ${failed} failed, ${warningCount} warning(s) across ${reports.length} template(s).`
  );

  const reportPath = resolvePath(process.cwd(), "import-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        docusign: { env: opts.env, accountId: account.account_id, baseUri: account.base_uri },
        swiftsign: { apiUrl, dryRun: opts.dryRun },
        summary: { total: reports.length, imported, dryRun, failed, warnings: warningCount },
        templates: reports,
      },
      null,
      2
    )
  );
  log(`Report written to ${reportPath}`);

  return failed === reports.length && reports.length > 0 ? 1 : 0;
}
