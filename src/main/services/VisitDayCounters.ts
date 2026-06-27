import type { DailyVisit } from "../../shared/types";

export function uniqueVisitDates(visits: DailyVisit[], predicate: (visit: DailyVisit) => boolean = () => true): string[] {
  return Array.from(new Set(visits.filter(predicate).map((visit) => visit.visitDate))).sort();
}

export function monthlyVisitDayOrdinal(visits: DailyVisit[], visitDate: string, predicate: (visit: DailyVisit) => boolean = () => true): number {
  const dates = uniqueVisitDates(visits, predicate);
  return dates.findIndex((date) => date === visitDate) + 1;
}

export function weeklyVisitDayOrdinal(visits: DailyVisit[], visitDate: string, predicate: (visit: DailyVisit) => boolean = () => true): number {
  const weekStart = startOfWeek(visitDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const dates = uniqueVisitDates(visits, predicate).filter((date) => {
    const target = new Date(`${date}T00:00:00`);
    return target >= weekStart && target <= weekEnd;
  });
  return dates.findIndex((date) => date === visitDate) + 1;
}

export function countEligibleBeforeOrOn(visits: DailyVisit[], visitDate: string, predicate: (visit: DailyVisit) => boolean): number {
  return uniqueVisitDates(visits, predicate).filter((date) => date <= visitDate).length;
}

export function weeklyEligibleOrdinal(visits: DailyVisit[], visitDate: string, predicate: (visit: DailyVisit) => boolean): number {
  const weekStart = startOfWeek(visitDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return uniqueVisitDates(visits, predicate).filter((date) => {
    const target = new Date(`${date}T00:00:00`);
    return date <= visitDate && target >= weekStart && target <= weekEnd;
  }).length;
}

function startOfWeek(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return date;
}
