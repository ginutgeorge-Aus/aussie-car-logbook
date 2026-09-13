const FY_START_MONTH = 7; // July

function fyBounds(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  const startYear = m >= FY_START_MONTH ? y : y - 1;
  return { startYear };
}

export function financialYear(dateISO: string) {
  const { startYear } = fyBounds(dateISO);
  const endYear = startYear + 1;
  return {
    startISO: `${startYear}-07-01`,
    endISO: `${endYear}-06-30`,
    label: `${startYear}-${String(endYear).slice(2)}`,
  };
}

export function basQuarter(dateISO: string) {
  const fy = financialYear(dateISO);
  const m = Number(dateISO.slice(5, 7));
  // Jul(7)-Sep(9)=Q1, Oct-Dec=Q2, Jan-Mar=Q3, Apr-Jun=Q4
  const quarterMap: Record<number, 1 | 2 | 3 | 4> = {
    7: 1, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4,
  };
  const quarter = quarterMap[m];
  const startYear = Number(fy.startISO.slice(0, 4));
  const ranges: Record<1 | 2 | 3 | 4, [string, string]> = {
    1: [`${startYear}-07-01`, `${startYear}-09-30`],
    2: [`${startYear}-10-01`, `${startYear}-12-31`],
    3: [`${startYear + 1}-01-01`, `${startYear + 1}-03-31`],
    4: [`${startYear + 1}-04-01`, `${startYear + 1}-06-30`],
  };
  const [startISO, endISO] = ranges[quarter];
  return { quarter, startISO, endISO, label: `Q${quarter} ${fy.label}` };
}

export function fyQuarters(fyLabel: string) {
  const startYear = Number(fyLabel.slice(0, 4));
  const endYear = startYear + 1;
  const ranges: Array<{ quarter: 1 | 2 | 3 | 4; startISO: string; endISO: string }> = [
    { quarter: 1, startISO: `${startYear}-07-01`, endISO: `${startYear}-09-30` },
    { quarter: 2, startISO: `${startYear}-10-01`, endISO: `${startYear}-12-31` },
    { quarter: 3, startISO: `${endYear}-01-01`, endISO: `${endYear}-03-31` },
    { quarter: 4, startISO: `${endYear}-04-01`, endISO: `${endYear}-06-30` },
  ];
  return ranges.map((r) => ({ ...r, label: `Q${r.quarter} ${fyLabel}` }));
}

export function daysHeldInFy(dateISO: string, fyLabel: string): number {
  const startYear = Number(fyLabel.slice(0, 4));
  const fyStartISO = `${startYear}-07-01`;
  const fyEndISO = `${startYear + 1}-06-30`;
  if (dateISO > fyEndISO) return 0;
  const startISO = dateISO < fyStartISO ? fyStartISO : dateISO;
  const start = new Date(startISO + "T00:00:00Z").getTime();
  const end = new Date(fyEndISO + "T00:00:00Z").getTime();
  return Math.round((end - start) / 86400000) + 1; // inclusive
}
