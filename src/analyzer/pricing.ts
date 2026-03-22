export interface PricingTier {
  input: number
  output: number
  cache_5m: number
  cache_1h: number
  cache_read: number
}

export const PRICING: Record<string, PricingTier> = {
  'claude-opus-4-6':            { input: 5,    output: 25,   cache_5m: 6.25, cache_1h: 10,   cache_read: 0.50 },
  'claude-opus-4-5-20251101':   { input: 5,    output: 25,   cache_5m: 6.25, cache_1h: 10,   cache_read: 0.50 },
  'claude-opus-4-1-20250805':   { input: 15,   output: 75,   cache_5m: 18.75, cache_1h: 30,  cache_read: 1.50 },
  'claude-sonnet-4-6':          { input: 3,    output: 15,   cache_5m: 3.75, cache_1h: 6,    cache_read: 0.30 },
  'claude-sonnet-4-5-20250929': { input: 3,    output: 15,   cache_5m: 3.75, cache_1h: 6,    cache_read: 0.30 },
  'claude-sonnet-4-20250514':   { input: 3,    output: 15,   cache_5m: 3.75, cache_1h: 6,    cache_read: 0.30 },
  'claude-haiku-4-5-20251001':  { input: 1,    output: 5,    cache_5m: 1.25, cache_1h: 2,    cache_read: 0.10 },
}

const DEFAULT_PRICING: PricingTier = { input: 3, output: 15, cache_5m: 3.75, cache_1h: 6, cache_read: 0.30 }

export function getPricing(model: string): PricingTier {
  if (model in PRICING) return PRICING[model]
  for (const [prefix, p] of Object.entries(PRICING)) {
    const base = prefix.slice(0, prefix.lastIndexOf('-'))
    if (model.startsWith(base)) return p
  }
  return DEFAULT_PRICING
}

export function costForUsage(model: string, tokens: { input: number; output: number; cache_5m: number; cache_1h: number; cache_read: number }): number {
  const p = getPricing(model)
  return (
    tokens.input / 1e6 * p.input
    + tokens.output / 1e6 * p.output
    + tokens.cache_5m / 1e6 * p.cache_5m
    + tokens.cache_1h / 1e6 * p.cache_1h
    + tokens.cache_read / 1e6 * p.cache_read
  )
}
