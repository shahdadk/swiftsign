// Minimal read-only DocuSign eSignature REST v2.1 client over global fetch.
// Scope: list templates, fetch one template's full definition, download its
// documents. Retries 429s using the X-RateLimit-Reset / Retry-After headers.

import type { DsTemplateDetail } from "./map.js";

export interface DsTemplateSummary {
  templateId?: string;
  name?: string;
  description?: string;
}

const PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res: Response, attempt: number): number {
  // X-RateLimit-Reset is an epoch timestamp in seconds; Retry-After is seconds.
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const retryAfter = Number(res.headers.get("retry-after"));
  let ms = (attempt + 1) * 2_000;
  if (Number.isFinite(reset) && reset > 0) ms = reset * 1000 - Date.now();
  else if (Number.isFinite(retryAfter) && retryAfter > 0) ms = retryAfter * 1000;
  return Math.min(MAX_RETRY_MS, Math.max(MIN_RETRY_MS, ms));
}

export class DocuSignClient {
  private readonly base: string;

  constructor(
    baseUri: string,
    accountId: string,
    private readonly accessToken: string,
    private readonly log: (msg: string) => void = (m) => console.error(m)
  ) {
    this.base = `${baseUri.replace(/\/+$/, "")}/restapi/v2.1/accounts/${encodeURIComponent(accountId)}`;
  }

  private async request(path: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${this.base}${path}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const ms = retryDelayMs(res, attempt);
        this.log(`DocuSign rate limit hit — retrying in ${Math.ceil(ms / 1000)}s (${attempt + 1}/${MAX_RETRIES})…`);
        await res.text().catch(() => undefined); // release the connection
        await sleep(ms);
        continue;
      }
      if (!res.ok) {
        throw new Error(`DocuSign API error ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
      }
      return res;
    }
  }

  // GET /templates, paginated via count/start_position until totalSetSize.
  async listTemplates(): Promise<DsTemplateSummary[]> {
    const all: DsTemplateSummary[] = [];
    let start = 0;
    for (;;) {
      const res = await this.request(`/templates?count=${PAGE_SIZE}&start_position=${start}`);
      const page = (await res.json()) as {
        totalSetSize?: string;
        envelopeTemplates?: DsTemplateSummary[];
      };
      const items = page.envelopeTemplates ?? [];
      all.push(...items);
      const total = num(page.totalSetSize, all.length);
      start += items.length;
      if (items.length === 0 || start >= total) return all;
    }
  }

  async getTemplate(templateId: string): Promise<DsTemplateDetail> {
    const res = await this.request(
      `/templates/${encodeURIComponent(templateId)}?include=recipients,documents,tabs`
    );
    return (await res.json()) as DsTemplateDetail;
  }

  // Template documents download as PDF regardless of the uploaded format.
  async downloadDocument(templateId: string, documentId: string): Promise<Buffer> {
    const res = await this.request(
      `/templates/${encodeURIComponent(templateId)}/documents/${encodeURIComponent(documentId)}`
    );
    return Buffer.from(await res.arrayBuffer());
  }
}

function num(v: string | undefined, fallback: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
