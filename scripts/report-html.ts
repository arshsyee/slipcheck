/** The terminal report as a standalone HTML page (colours kept, one match per printed page). Open it and "Save as PDF". */

const CLASS: Record<string, string> = { "1": "b", "2": "d", "31": "r", "32": "g", "33": "y" };
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** ANSI colour codes → <span class>. Unknown codes are dropped; text is escaped. */
export function ansiToHtml(text: string): string {
  let open = 0;
  const out = text.split(/(\x1b\[[0-9;]*m)/).map((part) => {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (!m) return escape(part);
    if (m[1] === "0" || m[1] === "") {
      const close = "</span>".repeat(open);
      open = 0;
      return close;
    }
    open++;
    return `<span class="${CLASS[m[1]] ?? ""}">`;
  });
  return out.join("") + "</span>".repeat(open);
}

/** `blocks`: one terminal report per match. */
export function reportHtml(blocks: string[], builtAt: Date): string {
  const when = builtAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlipCheck report</title>
<style>
:root{--bg:#fff;--fg:#1a1d21;--dim:#6b7280;--red:#c62828;--green:#1b7f3b;--yellow:#a15c00}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1217;--fg:#e8eef5;--dim:#8b98a8;--red:#ff5c6c;--green:#2ee07f;--yellow:#ffb547}}
body{background:var(--bg);color:var(--fg);margin:0;padding:16px;font:12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
header{font-family:system-ui,sans-serif;margin-bottom:12px} h1{font-size:18px;margin:0 0 4px} header p{margin:0;color:var(--dim);font-size:13px}
pre{white-space:pre;overflow-x:auto;margin:0 0 24px}
.b{font-weight:700}.d{color:var(--dim)}.r{color:var(--red)}.g{color:var(--green)}.y{color:var(--yellow)}
@media print{:root{--bg:#fff;--fg:#000}body{padding:0;font-size:9px}pre{page-break-after:always;overflow:visible}pre:last-child{page-break-after:auto}@page{size:A4 landscape;margin:10mm}}
</style></head><body>
<header><h1>SlipCheck report</h1><p>Built ${escape(when)} from free public sources. <span class="r">N/A · no free source</span> = no free source has it; nothing is guessed.</p></header>
${blocks.map((b) => `<pre>${ansiToHtml(b.replace(/^\n+/, ""))}</pre>`).join("\n")}
</body></html>
`;
}
