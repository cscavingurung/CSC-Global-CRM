// Service Charges — the Super Admin's price list, and the one rule for what a client pays.
//
// Prices differ by service (visa type) and destination country. A client's fee is the current
// price for that service in their country, falling back to the "All countries" price. The fee is
// copied onto the client's charge when the service is assigned, so later price changes never
// touch existing clients. Special prices go through a discount request approved by the Branch
// Manager — nobody types a fee in by hand.
import { FinService, ServicePrice } from './types';

export const ALL_COUNTRIES = 'All countries';

/** Categories a service can be booked under (the ledger's report buckets). */
export const PRICE_CATEGORIES: FinService[] = ['Visa Processing', 'Application Processing', 'Consultation Fee', 'IELTS / PTE Class'];

/** Suggested service names — the Super Admin can add any other. */
export const SUGGESTED_SERVICES = ['Student Visa', 'Student Visa + SOWP', 'SOWP', 'Visitor Visa', 'PR', 'Application Processing', 'Consultation', 'IELTS / PTE Class'];

const newest = (a: ServicePrice, b: ServicePrice) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.setAt.localeCompare(a.setAt);
const sameKey = (p: ServicePrice, name: string, country: string) =>
  p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.country.trim().toLowerCase() === country.trim().toLowerCase();

/** Every version of one service/country price, newest first. */
export const priceHistory = (prices: ServicePrice[], name: string, country: string) =>
  prices.filter((p) => sameKey(p, name, country)).sort(newest);

/** The version in effect on `date` for exactly this service + country (null = none / retired). */
export function currentVersion(prices: ServicePrice[], name: string, country: string, date: string): ServicePrice | null {
  const v = priceHistory(prices, name, country).find((p) => p.effectiveFrom <= date);
  return v && v.active ? v : null;
}

/** The price a client pays: their country's price, else the All-countries price. */
export function resolvePrice(prices: ServicePrice[], name: string, country: string, date: string): ServicePrice | null {
  return currentVersion(prices, name, country, date) ?? currentVersion(prices, name, ALL_COUNTRIES, date);
}

/** Services a client in `country` can be given today, with the price that applies. */
export function servicesFor(prices: ServicePrice[], country: string, date: string): { name: string; price: ServicePrice }[] {
  const names = [...new Set(prices.map((p) => p.name.trim()))].sort();
  return names.flatMap((name) => {
    const price = resolvePrice(prices, name, country, date);
    return price ? [{ name, price }] : [];
  });
}

/** One row per service + country, with its current and next scheduled version. */
export interface PriceRow {
  key: string;
  name: string;
  country: string;
  current: ServicePrice | null;
  upcoming: ServicePrice | null;
  history: ServicePrice[];
}

export function priceRows(prices: ServicePrice[], date: string): PriceRow[] {
  const keys = new Map<string, { name: string; country: string }>();
  prices.forEach((p) => keys.set(`${p.name.trim().toLowerCase()}|${p.country.trim().toLowerCase()}`, { name: p.name.trim(), country: p.country.trim() }));
  return [...keys.entries()].map(([key, { name, country }]) => {
    const history = priceHistory(prices, name, country);
    const upcoming = [...history].reverse().find((p) => p.effectiveFrom > date) ?? null;
    return { key, name, country, current: currentVersion(prices, name, country, date), upcoming, history };
  }).sort((a, b) => a.name.localeCompare(b.name) || (a.country === ALL_COUNTRIES ? -1 : b.country === ALL_COUNTRIES ? 1 : a.country.localeCompare(b.country)));
}
