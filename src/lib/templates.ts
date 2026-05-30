import type {
  Template,
  TemplateDocument,
  TemplateRole,
  TemplateField,
  FieldType,
  RecipientRole,
} from '@/generated/prisma/client'

// A Template loaded with its documents, roles, and fields — the input shape the
// resolver needs. Mirrors `prisma.template.findUnique({ include: { documents,
// roles, fields } })`.
export type TemplateWithRelations = Template & {
  documents: TemplateDocument[]
  roles: TemplateRole[]
  fields: TemplateField[]
}

export interface RoleAssignment {
  name: string
  email: string
}

// In-memory structures the envelope-create transaction consumes. Documents
// reuse the template's already-uploaded/rendered R2 keys (no re-ingest).
// Recipients carry an array index; fields reference document + recipient by
// that same index so the route can map them to created rows.
export interface ResolvedDocument {
  name: string
  originalKey: string
  pageCount: number
  imageKeys: string[]
}

export interface ResolvedRecipient {
  name: string
  email: string
  role: RecipientRole
  routingOrder: number
}

export interface ResolvedField {
  documentIndex: number
  recipientIndex: number
  type: FieldType
  page: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
  options: unknown
}

export interface ResolvedEnvelopeInput {
  documents: ResolvedDocument[]
  recipients: ResolvedRecipient[]
  fields: ResolvedField[]
}

function coerceImageKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((k): k is string => typeof k === 'string')
  return []
}

// Turn a loaded Template + role->signer assignments into the structure the
// envelope-create transaction writes. The route does the DB writes; this is
// pure (no IO). Throws if a TemplateRole has no assignment — the route should
// validate assignments first and return validation_error, but we guard here too.
export function resolveTemplateToEnvelopeInput(
  template: TemplateWithRelations,
  roleAssignments: Record<string, RoleAssignment>
): ResolvedEnvelopeInput {
  // Stable ordering so array indices are deterministic.
  const documents = [...template.documents].sort((a, b) => a.order - b.order)
  const roles = [...template.roles].sort((a, b) => a.order - b.order)

  const docIndexById = new Map<string, number>()
  documents.forEach((d, i) => docIndexById.set(d.id, i))

  const roleIndexById = new Map<string, number>()
  roles.forEach((r, i) => roleIndexById.set(r.id, i))

  const resolvedDocuments: ResolvedDocument[] = documents.map((d) => ({
    name: d.name,
    originalKey: d.originalKey,
    pageCount: d.pageCount,
    imageKeys: coerceImageKeys(d.imageKeys),
  }))

  const resolvedRecipients: ResolvedRecipient[] = roles.map((r) => {
    const assignment = roleAssignments[r.roleName]
    if (!assignment) {
      throw new Error(`No assignment provided for role "${r.roleName}"`)
    }
    return {
      name: assignment.name,
      email: assignment.email,
      role: r.recipientType,
      routingOrder: r.routingOrder,
    }
  })

  const resolvedFields: ResolvedField[] = template.fields.map((f) => {
    const documentIndex = docIndexById.get(f.templateDocumentId)
    const recipientIndex = roleIndexById.get(f.templateRoleId)
    if (documentIndex === undefined) {
      throw new Error(`Template field references unknown document ${f.templateDocumentId}`)
    }
    if (recipientIndex === undefined) {
      throw new Error(`Template field references unknown role ${f.templateRoleId}`)
    }
    return {
      documentIndex,
      recipientIndex,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      options: f.options,
    }
  })

  return {
    documents: resolvedDocuments,
    recipients: resolvedRecipients,
    fields: resolvedFields,
  }
}
