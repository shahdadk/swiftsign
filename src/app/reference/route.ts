import { ApiReference } from '@scalar/nextjs-api-reference'

// The installed @scalar/nextjs-api-reference exports `ApiReference`, a Route
// Handler FACTORY: ApiReference(config) => (() => Response). It is NOT a React
// component, so /reference is a route handler (route.ts), not a page.tsx. It
// serves the interactive API explorer HTML, pointed at our generated spec.
export const GET = ApiReference({
  url: '/openapi.json',
})
