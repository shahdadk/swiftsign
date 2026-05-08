// Vercel injects geo headers when deployed. In local dev they're absent.
// See https://vercel.com/docs/edge-network/headers#geographic-information-headers

type Geo = {
  country: string | null
  region: string | null
  city: string | null
}

export function captureGeo(headers: Headers): Geo {
  const country = headers.get('x-vercel-ip-country')
  const region = headers.get('x-vercel-ip-country-region')
  const city = headers.get('x-vercel-ip-city')
  return {
    country: country ? decodeURIComponent(country) : null,
    region: region ? decodeURIComponent(region) : null,
    city: city ? decodeURIComponent(city) : null,
  }
}
