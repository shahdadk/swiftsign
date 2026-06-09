// Unit tests for the pure DocuSign -> SwiftSign template mapper. No network,
// no pdf parsing — page sizes are supplied as fixtures, exactly like the CLI
// supplies them after measuring the downloaded PDFs.
//
// Run: npm test (builds, then `node --test dist/__tests__/`).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapTemplate,
  MAX_DOC_BYTES,
  type DsTemplateDetail,
  type MapDocInput,
  type PageSizePt,
} from "../docusign/map.js";

const LETTER: PageSizePt = { w: 612, h: 792, rotation: 0 };

function doc(pages: PageSizePt[] = [LETTER], bytes = 16): MapDocInput {
  return { buffer: Buffer.alloc(bytes, 1), pageSizesPt: pages };
}

function template(overrides: Partial<DsTemplateDetail> = {}): DsTemplateDetail {
  return {
    templateId: "tpl-1",
    name: "Lease Agreement",
    documents: [{ documentId: "1", name: "lease.pdf" }],
    recipients: { signers: [{ recipientId: "10", roleName: "Tenant", routingOrder: "1", tabs: {} }] },
    ...overrides,
  };
}

function withTabs(tabs: NonNullable<DsTemplateDetail["recipients"]>["signers"]): DsTemplateDetail {
  return template({ recipients: { signers: tabs } });
}

test("fixed tab: points convert to top-left percentages", () => {
  const ds = withTabs([
    {
      roleName: "Tenant",
      tabs: {
        signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "306", yPosition: "396" }],
        textTabs: [
          {
            documentId: "1",
            pageNumber: "1",
            xPosition: "61.2",
            yPosition: "79.2",
            width: "153",
            height: "39.6",
          },
        ],
      },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);

  const [sig, text] = createPayload.fields;
  assert.equal(sig.type, "SIGNATURE");
  assert.equal(sig.page, 1);
  assert.equal(sig.x, 50); // 306 / 612 * 100
  assert.equal(sig.y, 50); // 396 / 792 * 100
  assert.equal(sig.width, undefined); // no size on the tab -> server default
  assert.equal(sig.required, true);

  assert.equal(text.type, "TEXT");
  assert.equal(text.x, 10);
  assert.equal(text.y, 10);
  assert.equal(text.width, 25); // 153 / 612 * 100
  assert.equal(text.height, 5); // 39.6 / 792 * 100
  assert.equal(warnings.length, 0);
});

test("fixed tab: coordinates beyond the page clamp to 100", () => {
  const ds = withTabs([
    { roleName: "T", tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "9999", yPosition: "-5" }] } },
  ]);
  const { createPayload } = mapTemplate(ds, [doc()]);
  assert.equal(createPayload.fields[0].x, 100);
  assert.equal(createPayload.fields[0].y, 0);
});

test("anchor tab: anchorString maps to anchor; offsets dropped with warning", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        signHereTabs: [
          { documentId: "1", anchorString: "/sign-here/", anchorXOffset: "12", anchorYOffset: "0" },
        ],
      },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);
  const field = createPayload.fields[0];
  assert.equal(field.anchor, "/sign-here/");
  assert.equal(field.x, 0);
  assert.equal(field.y, 0);
  assert.ok(warnings.some((w) => w.includes("anchorXOffset")));
});

test("anchor tab with zero offsets produces no offset warning", () => {
  const ds = withTabs([
    { roleName: "T", tabs: { signHereTabs: [{ documentId: "1", anchorString: "/s/", anchorXOffset: "0", anchorYOffset: "0" }] } },
  ]);
  const { warnings } = mapTemplate(ds, [doc()]);
  assert.equal(warnings.length, 0);
});

test("rotated page (90): width/height swap with warning", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "396", yPosition: "306" }] },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc([{ w: 612, h: 792, rotation: 90 }])]);
  const field = createPayload.fields[0];
  // Effective page is 792 wide x 612 tall after rotation.
  assert.equal(field.x, 50);
  assert.equal(field.y, 50);
  assert.ok(warnings.some((w) => w.includes("rotated 90")));
});

test("radio group: one RADIO field at the first option, options from values", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        radioGroupTabs: [
          {
            groupName: "pets",
            documentId: "1",
            radios: [
              { pageNumber: "2", xPosition: "61.2", yPosition: "396", value: "yes" },
              { pageNumber: "2", xPosition: "153", yPosition: "396", value: "no" },
            ],
          },
        ],
      },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc([LETTER, LETTER])]);
  assert.equal(createPayload.fields.length, 1);
  const field = createPayload.fields[0];
  assert.equal(field.type, "RADIO");
  assert.deepEqual(field.options, ["yes", "no"]);
  assert.equal(field.page, 2);
  assert.equal(field.x, 10); // first radio's position
  assert.equal(field.y, 50);
  assert.ok(warnings.some((w) => w.includes("per-option positions lost")));
});

test("list tab: DROPDOWN with options from listItems", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        listTabs: [
          {
            documentId: "1",
            pageNumber: "1",
            xPosition: "0",
            yPosition: "0",
            listItems: [{ text: "Ontario", value: "ON" }, { text: "Quebec", value: "QC" }],
          },
        ],
      },
    },
  ]);
  const { createPayload } = mapTemplate(ds, [doc()]);
  assert.equal(createPayload.fields[0].type, "DROPDOWN");
  assert.deepEqual(createPayload.fields[0].options, ["ON", "QC"]);
});

test("tab type mapping: dateSigned/fullName/initialHere/checkbox/signerAttachment", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        dateSignedTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
        fullNameTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
        initialHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
        checkboxTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
        signerAttachmentTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
      },
    },
  ]);
  const { createPayload } = mapTemplate(ds, [doc()]);
  assert.deepEqual(
    createPayload.fields.map((f) => f.type),
    ["DATE", "NAME", "INITIALS", "CHECKBOX", "ATTACHMENT"]
  );
});

test("validation tabs (email/ssn/...) coerce to TEXT with a warning", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        emailTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0", tabLabel: "Email" }],
        ssnTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
      },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);
  assert.deepEqual(createPayload.fields.map((f) => f.type), ["TEXT", "TEXT"]);
  assert.ok(warnings.some((w) => w.includes("email") && w.includes("validation lost")));
  assert.ok(warnings.some((w) => w.includes("SSN")));
});

test("formula/note/approve tabs and unknown tab types are skipped with warnings", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: {
        formulaTabs: [{ documentId: "1" }],
        noteTabs: [{ documentId: "1" }],
        firstNameTabs: [{ documentId: "1" }], // not in the mapping at all
        signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0" }],
      },
    },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);
  assert.equal(createPayload.fields.length, 1); // only the signHere survives
  assert.ok(warnings.some((w) => w.includes("formula")));
  assert.ok(warnings.some((w) => w.includes("note")));
  assert.ok(warnings.some((w) => w.includes("firstNameTabs")));
});

test("optional tab maps to required: false", () => {
  const ds = withTabs([
    {
      roleName: "T",
      tabs: { textTabs: [{ documentId: "1", pageNumber: "1", xPosition: "0", yPosition: "0", optional: "true" }] },
    },
  ]);
  const { createPayload } = mapTemplate(ds, [doc()]);
  assert.equal(createPayload.fields[0].required, false);
});

test("recipients: signers and carbonCopies map; agents/witnesses skip with warning", () => {
  const ds = template({
    recipients: {
      agents: [{ roleName: "Routing Agent", tabs: { textTabs: [{ documentId: "1" }] } }],
      signers: [
        { roleName: "Tenant", routingOrder: "1", tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "306", yPosition: "396" }] } },
        { roleName: "Landlord", routingOrder: "2", tabs: {} },
      ],
      carbonCopies: [{ roleName: "Property Manager", routingOrder: "3" }],
    },
  });
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);

  assert.deepEqual(createPayload.roles, [
    { roleName: "Tenant", routingOrder: 1, recipientType: "SIGNER" },
    { roleName: "Landlord", routingOrder: 2, recipientType: "SIGNER" },
    { roleName: "Property Manager", routingOrder: 3, recipientType: "CC" },
  ]);
  // The skipped agent does NOT shift signer role indices.
  assert.equal(createPayload.fields[0].role, 0);
  assert.ok(warnings.some((w) => w.includes("agent") && w.includes("Routing Agent")));
});

test("template with only unsupported recipients yields zero roles + warning", () => {
  const ds = template({ recipients: { notaries: [{ roleName: "Notary" }] } });
  const { createPayload, warnings } = mapTemplate(ds, [doc()]);
  assert.equal(createPayload.roles.length, 0);
  assert.ok(warnings.some((w) => w.includes("at least one role")));
});

test("multi-document: documentId maps to the document index; unknown id skips", () => {
  const ds = template({
    documents: [
      { documentId: "1", name: "first.pdf" },
      { documentId: "7", name: "second.docx" },
    ],
    recipients: {
      signers: [
        {
          roleName: "T",
          tabs: {
            signHereTabs: [
              { documentId: "7", pageNumber: "1", xPosition: "306", yPosition: "396" },
              { documentId: "99", pageNumber: "1", xPosition: "0", yPosition: "0" },
            ],
          },
        },
      ],
    },
  });
  const { createPayload, warnings } = mapTemplate(ds, [doc(), doc()]);
  assert.equal(createPayload.fields.length, 1);
  assert.equal(createPayload.fields[0].document, 1);
  assert.ok(warnings.some((w) => w.includes("unknown document 99")));
  // Downloaded template docs are always PDF — names normalize to .pdf.
  assert.deepEqual(createPayload.documents.map((d) => d.name), ["first.pdf", "second.pdf"]);
});

test("oversized document gets a 25MB warning", () => {
  const ds = template();
  const { warnings } = mapTemplate(ds, [doc([LETTER], MAX_DOC_BYTES + 1)]);
  assert.ok(warnings.some((w) => w.includes("25MB")));
});

test("documents are base64 encoded and the payload shape matches the API schema", () => {
  const ds = withTabs([
    { roleName: "T", tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "306", yPosition: "396" }] } },
  ]);
  const input = doc();
  const { createPayload } = mapTemplate(ds, [input]);
  assert.equal(createPayload.name, "Lease Agreement");
  assert.equal(createPayload.documents[0].base64, input.buffer.toString("base64"));
  // Only schema-accepted keys on the field (role/document/type/page/x/y/required here).
  assert.deepEqual(Object.keys(createPayload.fields[0]).sort(), [
    "document",
    "page",
    "required",
    "role",
    "type",
    "x",
    "y",
  ]);
});

test("missing page size falls back to US Letter with a warning", () => {
  const ds = withTabs([
    { roleName: "T", tabs: { signHereTabs: [{ documentId: "1", pageNumber: "3", xPosition: "306", yPosition: "396" }] } },
  ]);
  const { createPayload, warnings } = mapTemplate(ds, [doc([LETTER])]); // only 1 page measured
  assert.equal(createPayload.fields[0].x, 50);
  assert.ok(warnings.some((w) => w.includes("assumed US Letter")));
});
