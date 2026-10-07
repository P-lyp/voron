import { DashboardPeriod } from '@ai-db/shared';

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): string => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseISODate = (isoStr: string): Date => {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export interface PeriodDateRange {
  startDate: string;
  endDate: string;
}

export function getPeriodDateRange(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): PeriodDateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  if (period === 'ontem') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dStr = toISODate(yesterday);
    return { startDate: dStr, endDate: dStr };
  }

  if (period === 'semana') {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    return { startDate: toISODate(start), endDate: toISODate(today) };
  }

  if (period === 'semana_passada') {
    const weekday = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 = Seg, 6 = Dom
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - weekday);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
    const startOfLastWeek = new Date(endOfLastWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
    return { startDate: toISODate(startOfLastWeek), endDate: toISODate(endOfLastWeek) };
  }

  if (period === 'este_mes' || period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toISODate(start), endDate: toISODate(today) };
  }

  if (period === 'mes_anterior') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }

  if (period === '30d') {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { startDate: toISODate(start), endDate: toISODate(today) };
  }

  if (period === 'ano') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { startDate: toISODate(start), endDate: toISODate(today) };
  }

  if (period === 'total') {
    return { startDate: '', endDate: '' };
  }

  // Padrão: Hoje
  const todayStr = toISODate(today);
  return { startDate: todayStr, endDate: todayStr };
}

export function getPeriodDisplayLabel(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): string {
  switch (period) {
    case 'dia':
      return 'Hoje';
    case 'ontem':
      return 'Ontem';
    case 'este_mes':
    case 'mes':
      return 'Este Mês';
    case 'semana':
      return '7 Dias';
    case 'semana_passada':
      return 'Semana Anterior';
    case 'mes_anterior':
      return 'Mês Anterior';
    case '30d':
      return 'Últimos 30 Dias';
    case 'ano':
      return 'Este Ano';
    case 'total':
      return 'Consolidado';
    case 'custom':
      if (customStart && customEnd) {
        const s = parseISODate(customStart);
        const e = parseISODate(customEnd);
        return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} - ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;
      }
      return 'Personalizado';
    default:
      return 'Hoje';
  }
}

export function getPeriodDateSummary(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): string {
  const range = getPeriodDateRange(period, customStart, customEnd);
  const now = new Date();

  if (period === 'total') {
    return 'Consolidado histórico geral';
  }

  if (!range.startDate || !range.endDate) {
    return '';
  }

  const start = parseISODate(range.startDate);
  const end = parseISODate(range.endDate);

  if (range.startDate === range.endDate) {
    const isToday = range.startDate === toISODate(now);
    const day = start.getDate();
    const month = MONTH_NAMES[start.getMonth()];
    const year = start.getFullYear();

    if (isToday) {
      return `Hoje • ${day} de ${month} de ${year}`;
    }
    if (period === 'ontem') {
      return `Ontem • ${day} de ${month} de ${year}`;
    }
    return `${day} de ${month} de ${year}`;
  }

  // Intervalo
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = MONTH_SHORT[start.getMonth()];
  const eMonth = MONTH_SHORT[end.getMonth()];
  const sYear = start.getFullYear();
  const eYear = end.getFullYear();

  if (period === 'este_mes' || period === 'mes') {
    return `${pad(sDay)} a ${pad(eDay)} de ${MONTH_NAMES[end.getMonth()]} (Mês até hoje)`;
  }

  if (period === 'mes_anterior') {
    return `${MONTH_NAMES[start.getMonth()]} de ${sYear} (Mês fechado)`;
  }

  if (period === 'semana') {
    if (sMonth === eMonth) {
      return `${sDay} a ${eDay} de ${sMonth} (Últimos 7 dias)`;
    }
    return `${sDay} ${sMonth} – ${eDay} ${eMonth} (Últimos 7 dias)`;
  }

  if (period === 'semana_passada') {
    if (sMonth === eMonth) {
      return `${sDay} a ${eDay} de ${sMonth} (Semana anterior)`;
    }
    return `${sDay} ${sMonth} – ${eDay} ${eMonth} (Semana anterior)`;
  }

  if (period === 'ano') {
    return `01 de Jan a ${pad(eDay)} de ${eMonth} de ${eYear} (Ano)`;
  }

  if (sMonth === eMonth && sYear === eYear) {
    return `${sDay} a ${eDay} de ${MONTH_NAMES[end.getMonth()]} de ${eYear}`;
  }

  return `${pad(sDay)}/${pad(start.getMonth() + 1)}/${sYear} até ${pad(eDay)}/${pad(end.getMonth() + 1)}/${eYear}`;
}

export function getComparisonLabel(period: DashboardPeriod): string {
  switch (period) {
    case 'dia':
      return 'vs ontem';
    case 'ontem':
      return 'vs anteontem';
    case 'semana':
    case 'semana_passada':
      return 'vs semana ant.';
    case 'este_mes':
    case 'mes':
    case 'mes_anterior':
    case '30d':
      return 'vs mês ant.';
    case 'ano':
      return 'vs ano ant.';
    default:
      return 'vs ant.';
  }
}

export function getPeriodButtonLabel(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): string {
  const range = getPeriodDateRange(period, customStart, customEnd);
  const now = new Date();
  const todayStr = toISODate(now);

  if (period === 'dia') {
    const d = parseISODate(range.startDate || todayStr);
    return `Hoje • ${pad(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === 'ontem') {
    const d = parseISODate(range.startDate);
    return `Ontem • ${pad(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === 'este_mes' || period === 'mes') {
    const d = parseISODate(range.endDate || todayStr);
    return `Este Mês • ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === 'semana') {
    return 'Últimos 7 Dias';
  }

  if (period === 'semana_passada') {
    return 'Semana Anterior';
  }

  if (period === 'mes_anterior') {
    const d = parseISODate(range.startDate);
    return `Mês Anterior • ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === '30d') {
    return 'Últimos 30 Dias';
  }

  if (period === 'ano') {
    return `Ano • ${now.getFullYear()}`;
  }

  if (period === 'total') {
    return 'Consolidado Geral';
  }

  if (period === 'custom' && customStart && customEnd) {
    const s = parseISODate(customStart);
    const e = parseISODate(customEnd);
    return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} a ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;
  }

  return 'Selecionar Período';
}

export function getPeriodShortDateBadge(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): string {
  const range = getPeriodDateRange(period, customStart, customEnd);
  const now = new Date();
  const todayStr = toISODate(now);

  if (period === 'dia') {
    const d = parseISODate(range.startDate || todayStr);
    return `${pad(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === 'ontem') {
    const d = parseISODate(range.startDate);
    return `${pad(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
  }

  if (period === 'este_mes' || period === 'mes') {
    const end = parseISODate(range.endDate || todayStr);
    return `01 a ${pad(end.getDate())} ${MONTH_SHORT[end.getMonth()]}`;
  }

  if (period === 'semana') {
    const s = parseISODate(range.startDate);
    const e = parseISODate(range.endDate || todayStr);
    if (s.getMonth() === e.getMonth()) {
      return `${pad(s.getDate())} a ${pad(e.getDate())} ${MONTH_SHORT[e.getMonth()]}`;
    }
    return `${pad(s.getDate())} ${MONTH_SHORT[s.getMonth()]} - ${pad(e.getDate())} ${MONTH_SHORT[e.getMonth()]}`;
  }

  if (period === 'semana_passada') {
    const s = parseISODate(range.startDate);
    const e = parseISODate(range.endDate);
    return `${pad(s.getDate())} a ${pad(e.getDate())} ${MONTH_SHORT[e.getMonth()]}`;
  }

  if (period === 'mes_anterior') {
    const s = parseISODate(range.startDate);
    return `${MONTH_SHORT[s.getMonth()]}/${s.getFullYear()}`;
  }

  if (period === '30d') {
    return '30 Dias';
  }

  if (period === 'ano') {
    return `${now.getFullYear()}`;
  }

  if (period === 'total') {
    return 'Total';
  }

  if (period === 'custom' && customStart && customEnd) {
    const s = parseISODate(customStart);
    const e = parseISODate(customEnd);
    return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} - ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;
  }

  const d = parseISODate(range.startDate || todayStr);
  return `${pad(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
}
