export interface CollectorRow {
  enabled: boolean;
  value: string;
}

/** Execute selector collectors on the current document */
export function runCollectors(rows: CollectorRow[], _tabUrl?: string) {
  try {
    const lines: string[] = [];
    for (const row of rows) {
      if (!row?.enabled) continue;
      const value = row.value || '';
      if (!value) continue;

      const parts = value.split('|');
      let domainGlob = '', selector = '', mode = '';
      if (parts.length === 1) {
        selector = parts[0].trim();
      } else if (parts.length === 2) {
        domainGlob = parts[0].trim();
        selector = parts[1].trim();
      } else if (parts.length >= 3) {
        domainGlob = parts[0].trim();
        selector = parts[1].trim();
        mode = parts[2].trim();
      }
      if (!selector) continue;
      if (domainGlob && !urlMatches(domainGlob)) continue;

      const els = Array.from(document.querySelectorAll(selector));
      for (const el of els) {
        let out = '';
        if (!mode || mode === '') out = (el as HTMLElement).outerHTML;
        else if (mode === 'inner') out = (el as HTMLElement).innerHTML;
        else if (mode === 'inner:strip') out = el.textContent || '';
        else if (mode.startsWith('attr:')) {
          const name = mode.slice(5).trim();
          if (!name) { lines.push('[attr error] missing attribute name'); continue; }
          const v = (el as HTMLElement).getAttribute(name);
          if (v == null) continue;
          out = String(v);
        } else { lines.push(`[mode error] unsupported mode "${mode}"`); continue; }

        out = String(out).replace(/\r?\n+/g, ' ').trim();
        lines.push(out);
      }
    }
    return { result: lines };
  } catch (e: any) {
    return { error: e.message };
  }
}

function urlMatches(glob: string) {
  const target = location.host + location.pathname;
  const re = new RegExp('^' + glob.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(target);
}
