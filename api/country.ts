import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const country = (req.headers['x-vercel-ip-country'] as string) ?? 'US'
  res.json({ country: country.slice(0, 2).toUpperCase() })
}
