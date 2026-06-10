// GET /api/v1/envelopes/[id]/download
//
// Versioned, OpenAPI-declared alias of /api/envelopes/[id]/download so the
// sealed-PDF download (the product's core output) is discoverable on the same
// /api/v1 surface an agent reads from the OpenAPI spec. Behavior is identical:
// Bearer API key (envelopes:read) or ?token=<signingToken> auth; ?doc=<index>
// (default 0) for the sealed document, ?certificate=true for the Certificate
// of Completion. Requires the envelope to be COMPLETED.
export { GET } from '../../../../envelopes/[id]/download/route'
