export { SwiftSign, DEFAULT_BASE_URL, Envelopes, Templates, Billing } from "./client.js";
export type {
  SwiftSignOptions,
  // enums
  EnvelopeStatus,
  RecipientRole,
  FieldType,
  Mode,
  Plan,
  // inputs
  DocumentInput,
  RecipientInput,
  FieldInput,
  InlineEnvelopeInput,
  RoleAssignment,
  TemplateEnvelopeInput,
  CreateEnvelopeInput,
  ListEnvelopesParams,
  TemplateRoleInput,
  TemplateFieldInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateEmbeddedUrlOptions,
  // outputs
  ApiKeyView,
  SignupResult,
  EnvelopeDocument,
  EnvelopeRecipient,
  Envelope,
  EnvelopeListItem,
  Page,
  EnvelopeActionResult,
  EmbeddedUrl,
  TemplateListItem,
  Template,
  UpgradeResult,
} from "./client.js";

export { SwiftSignError } from "./errors.js";
export type { SwiftSignProblem } from "./errors.js";

export { embed } from "./embed.js";
export type { EmbedOptions, EmbedHandle, EmbedCompletedEvent } from "./embed.js";

import { SwiftSign } from "./client.js";
export default SwiftSign;
