// Pure mapping from a DocuSign template detail (eSignature REST v2.1, fetched
// with ?include=recipients,documents,tabs) to a SwiftSign POST /api/v1/templates
// payload. No I/O — callers supply the downloaded document buffers plus
// per-page sizes in PDF points, so the whole conversion is unit-testable.
//
// Coordinate model: DocuSign fixed tabs are absolute points (1/72 inch) from
// the top-left of the page; SwiftSign fields are percentages (0-100) from the
// top-left. Pages rotated 90/270 swap effective width/height.

export type SwiftSignFieldType =
  | "SIGNATURE"
  | "NAME"
  | "DATE"
  | "TEXT"
  | "INITIALS"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN"
  | "ATTACHMENT";

// ---------- DocuSign response shapes (values are strings in the REST API) ----------

export interface DsRadio {
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
  value?: string;
}

export interface DsListItem {
  text?: string;
  value?: string;
}

export interface DsTab {
  documentId?: string;
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
  width?: string;
  height?: string;
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  optional?: string | boolean;
  required?: string | boolean;
  tabLabel?: string;
  name?: string;
  groupName?: string;
  radios?: DsRadio[];
  listItems?: DsListItem[];
}

export interface DsRecipient {
  recipientId?: string;
  roleName?: string;
  name?: string;
  routingOrder?: string;
  tabs?: Record<string, DsTab[] | undefined>;
}

export interface DsRecipients {
  signers?: DsRecipient[];
  carbonCopies?: DsRecipient[];
  agents?: DsRecipient[];
  editors?: DsRecipient[];
  intermediaries?: DsRecipient[];
  witnesses?: DsRecipient[];
  notaries?: DsRecipient[];
  certifiedDeliveries?: DsRecipient[];
  inPersonSigners?: DsRecipient[];
  seals?: DsRecipient[];
}

export interface DsDocumentRef {
  documentId?: string;
  name?: string;
}

export interface DsTemplateDetail {
  templateId?: string;
  name?: string;
  description?: string;
  documents?: DsDocumentRef[];
  recipients?: DsRecipients;
}

// ---------- Mapper inputs/outputs ----------

export interface PageSizePt {
  w: number;
  h: number;
  rotation: number; // degrees, 0/90/180/270
}

export interface MapDocInput {
  buffer: Buffer;
  pageSizesPt: PageSizePt[];
}

export interface SwiftSignField {
  role: number;
  document: number;
  type: SwiftSignFieldType;
  page: number;
  anchor?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  required: boolean;
  options?: string[];
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  documents: { name: string; base64: string }[];
  roles: { roleName: string; routingOrder: number; recipientType: "SIGNER" | "CC" }[];
  fields: SwiftSignField[];
}

export interface MapResult {
  createPayload: CreateTemplatePayload;
  warnings: string[];
}

// Mirror of the server-side ingest guards (src/lib/pdf-ingest.ts).
export const MAX_DOC_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const LETTER: PageSizePt = { w: 612, h: 792, rotation: 0 };

// Tab arrays that translate 1:1 to a SwiftSign field type.
const TAB_TYPE: Record<string, SwiftSignFieldType> = {
  signHereTabs: "SIGNATURE",
  initialHereTabs: "INITIALS",
  dateSignedTabs: "DATE",
  fullNameTabs: "NAME",
  textTabs: "TEXT",
  checkboxTabs: "CHECKBOX",
  radioGroupTabs: "RADIO",
  listTabs: "DROPDOWN",
  signerAttachmentTabs: "ATTACHMENT",
};

// Typed-input tabs SwiftSign has no validator for — coerced to TEXT.
const TEXT_COERCED: Record<string, string> = {
  emailTabs: "email",
  numberTabs: "number",
  numericalTabs: "numerical",
  ssnTabs: "SSN",
  zipTabs: "ZIP",
  phoneNumberTabs: "phone",
  titleTabs: "title",
  companyTabs: "company",
  dateTabs: "date",
};

// DocuSign-only behaviors with no SwiftSign equivalent — skipped.
const SKIPPED_TABS = new Set(["formulaTabs", "noteTabs", "approveTabs", "declineTabs", "viewTabs"]);

const SKIPPED_RECIPIENTS: (keyof DsRecipients)[] = [
  "agents",
  "editors",
  "intermediaries",
  "witnesses",
  "notaries",
  "certifiedDeliveries",
  "inPersonSigners",
  "seals",
];

// ---------- Helpers ----------

function num(v: string | number | undefined, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function int(v: string | number | undefined, fallback: number): number {
  const n = Math.trunc(num(v, fallback));
  return n >= 1 ? n : fallback;
}

function isTrue(v: string | boolean | undefined): boolean {
  return v === true || v === "true";
}

function isRequired(tab: DsTab): boolean {
  if (tab.required !== undefined) return isTrue(tab.required);
  if (tab.optional !== undefined) return !isTrue(tab.optional);
  return true;
}

function pct(valuePt: number, pageDimPt: number): number {
  const v = (valuePt / pageDimPt) * 100;
  return Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
}

function label(tab: DsTab, tabKey: string): string {
  return tab.tabLabel || tab.name || tab.groupName || tabKey.replace(/Tabs$/, "");
}

function pdfName(name: string | undefined, index: number): string {
  const base = (name || `document-${index + 1}`).replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base}.pdf`;
}

// ---------- The mapper ----------

export function mapTemplate(dsTemplate: DsTemplateDetail, docs: MapDocInput[]): MapResult {
  const warnings: string[] = [];
  const pageNoted = new Set<string>(); // dedupe per-page rotation/size warnings

  // Documents — order defines the SwiftSign document index.
  const dsDocs = dsTemplate.documents ?? [];
  if (dsDocs.length === 0 || docs.length === 0) {
    warnings.push("template has no documents; SwiftSign requires at least one");
  }
  const docIndexById = new Map<string, number>();
  dsDocs.forEach((d, i) => {
    if (d.documentId !== undefined) docIndexById.set(String(d.documentId), i);
  });

  let totalBytes = 0;
  const documents = docs.map((d, i) => {
    totalBytes += d.buffer.byteLength;
    const name = pdfName(dsDocs[i]?.name, i);
    if (d.buffer.byteLength > MAX_DOC_BYTES) {
      const mb = (d.buffer.byteLength / (1024 * 1024)).toFixed(1);
      warnings.push(
        `document "${name}" is ${mb}MB — exceeds SwiftSign's 25MB per-document limit; the import will be rejected`
      );
    }
    return { name, base64: d.buffer.toString("base64") };
  });
  if (totalBytes > MAX_TOTAL_BYTES) {
    warnings.push(
      `documents total ${(totalBytes / (1024 * 1024)).toFixed(1)}MB — exceeds SwiftSign's 50MB per-template limit; the import will be rejected`
    );
  }

  // Effective page size in points for a 1-based page, honoring rotation.
  function pageSize(docIndex: number, page: number): { w: number; h: number } {
    const sizes = docs[docIndex]?.pageSizesPt ?? [];
    let size = sizes[page - 1];
    if (!size) {
      size = LETTER;
      const key = `size:${docIndex}:${page}`;
      if (!pageNoted.has(key)) {
        pageNoted.add(key);
        warnings.push(
          `document ${docIndex + 1} page ${page}: page size unknown; assumed US Letter (612x792pt)`
        );
      }
    }
    const rot = ((size.rotation % 360) + 360) % 360;
    if (rot === 90 || rot === 270) {
      const key = `rot:${docIndex}:${page}`;
      if (!pageNoted.has(key)) {
        pageNoted.add(key);
        warnings.push(
          `document ${docIndex + 1} page ${page} is rotated ${rot}°; width/height swapped for coordinate conversion`
        );
      }
      return { w: size.h, h: size.w };
    }
    return { w: size.w, h: size.h };
  }

  // Recipients -> roles. Signers first (in order), then carbon copies.
  const roles: CreateTemplatePayload["roles"] = [];
  const signers = dsTemplate.recipients?.signers ?? [];
  const ccs = dsTemplate.recipients?.carbonCopies ?? [];
  const signerRole = new Map<DsRecipient, number>();

  signers.forEach((s, i) => {
    signerRole.set(s, roles.length);
    roles.push({
      roleName: s.roleName || s.name || `Signer ${i + 1}`,
      routingOrder: int(s.routingOrder, 1),
      recipientType: "SIGNER",
    });
  });
  ccs.forEach((c, i) => {
    const dropped = countTabs(c);
    if (dropped > 0) {
      warnings.push(`cc "${c.roleName || c.name || i + 1}": ${dropped} tab(s) dropped (CC recipients do not sign)`);
    }
    roles.push({
      roleName: c.roleName || c.name || `CC ${i + 1}`,
      routingOrder: int(c.routingOrder, 1),
      recipientType: "CC",
    });
  });
  for (const kind of SKIPPED_RECIPIENTS) {
    for (const r of dsTemplate.recipients?.[kind] ?? []) {
      warnings.push(
        `skipped ${kind.replace(/s$/, "")} recipient "${r.roleName || r.name || r.recipientId || "?"}" — unsupported recipient type; its ${countTabs(r)} tab(s) were dropped`
      );
    }
  }
  if (roles.length === 0) {
    warnings.push(
      "template has no signers or carbon copies — SwiftSign requires at least one role; this template cannot be imported"
    );
  }

  // Tabs -> fields (signers only; CCs cannot hold tabs).
  const fields: SwiftSignField[] = [];
  for (const signer of signers) {
    const roleIndex = signerRole.get(signer)!;
    const who = signer.roleName || signer.name || `Signer ${roleIndex + 1}`;

    for (const [tabKey, tabs] of Object.entries(signer.tabs ?? {})) {
      if (!Array.isArray(tabs) || tabs.length === 0) continue;

      if (SKIPPED_TABS.has(tabKey)) {
        warnings.push(`signer "${who}": ${tabs.length} ${tabKey.replace(/Tabs$/, "")} tab(s) skipped (no SwiftSign equivalent)`);
        continue;
      }
      const coerced = TEXT_COERCED[tabKey];
      const type = coerced ? "TEXT" : TAB_TYPE[tabKey];
      if (!type) {
        warnings.push(`signer "${who}": ${tabs.length} unsupported "${tabKey}" tab(s) skipped`);
        continue;
      }

      for (const tab of tabs) {
        if (coerced) {
          warnings.push(`signer "${who}": ${coerced} tab "${label(tab, tabKey)}" imported as TEXT — ${coerced} validation lost`);
        }

        // Radio groups: one RADIO field at the first option's position.
        let posTab = tab;
        let options: string[] | undefined;
        if (tabKey === "radioGroupTabs") {
          const radios = tab.radios ?? [];
          if (radios.length === 0) {
            warnings.push(`signer "${who}": radio group "${label(tab, tabKey)}" has no options; skipped`);
            continue;
          }
          options = radios.map((r, i) => r.value || `Option ${i + 1}`);
          posTab = { ...tab, ...radios[0] };
          warnings.push(
            `signer "${who}": radio group "${label(tab, tabKey)}" — per-option positions lost; field placed at the first option`
          );
        } else if (tabKey === "listTabs") {
          options = (tab.listItems ?? []).map((li) => li.value || li.text || "").filter((v) => v !== "");
          if (options.length === 0) {
            options = undefined;
            warnings.push(`signer "${who}": dropdown "${label(tab, tabKey)}" has no options`);
          }
        }

        const docId = posTab.documentId !== undefined ? String(posTab.documentId) : undefined;
        const docIndex = docId !== undefined ? docIndexById.get(docId) : 0;
        if (docIndex === undefined) {
          warnings.push(`signer "${who}": tab "${label(tab, tabKey)}" references unknown document ${docId}; skipped`);
          continue;
        }

        const field: SwiftSignField = {
          role: roleIndex,
          document: docIndex,
          type,
          page: 1,
          x: 0,
          y: 0,
          required: isRequired(tab),
          ...(options ? { options } : {}),
        };

        if (tab.anchorString) {
          // Anchor-positioned tab: SwiftSign resolves the anchor server-side.
          field.anchor = tab.anchorString;
          if (num(tab.anchorXOffset, 0) !== 0 || num(tab.anchorYOffset, 0) !== 0) {
            warnings.push(
              `signer "${who}": anchor tab "${label(tab, tabKey)}" — anchorXOffset/anchorYOffset dropped (not supported by SwiftSign)`
            );
          }
        } else {
          // Fixed-position tab: points (top-left) -> percent (top-left).
          const page = int(posTab.pageNumber, 1);
          const { w, h } = pageSize(docIndex, page);
          field.page = page;
          field.x = pct(num(posTab.xPosition, 0), w);
          field.y = pct(num(posTab.yPosition, 0), h);
          const wPt = num(tab.width, 0);
          const hPt = num(tab.height, 0);
          if (wPt > 0) field.width = pct(wPt, w);
          if (hPt > 0) field.height = pct(hPt, h);
        }

        fields.push(field);
      }
    }
  }

  return {
    createPayload: {
      name: dsTemplate.name?.trim() || "Untitled DocuSign template",
      ...(dsTemplate.description ? { description: dsTemplate.description } : {}),
      documents,
      roles,
      fields,
    },
    warnings,
  };
}

function countTabs(recipient: DsRecipient): number {
  return Object.values(recipient.tabs ?? {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}
