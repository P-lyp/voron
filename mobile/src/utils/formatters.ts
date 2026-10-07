const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(val: number, isPrivacyMode: boolean = false): string {
  if (isPrivacyMode) return '••••••';
  return currencyFormatter.format(val || 0);
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

const saldoFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatSaldo(val?: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return saldoFormatter.format(val);
}

// Hoisted RegExps (Vercel Best Practice: js-hoist-regexp)
const CAPITALIZE_WORD_REGEX = /(?:^|\s)\S/g;
const EPS_REGEX = /\bEps\b/g;
const HJZ_REGEX = /\bHjz\b/g;
const KG_MT_REGEX = /\bKg\/mt\b/g;
const V_REGEX = /\bV\b/g;
const DANFOSS_REGEX = /\bDanfoss\b/g;

export function toSentenceCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(CAPITALIZE_WORD_REGEX, (char) => char.toUpperCase())
    .replace(EPS_REGEX, 'EPS')
    .replace(HJZ_REGEX, 'HJZ')
    .replace(KG_MT_REGEX, 'kg/m')
    .replace(V_REGEX, 'V')
    .replace(DANFOSS_REGEX, 'Danfoss');
}
