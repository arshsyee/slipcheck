import { describe, expect, it } from "vitest";
import { ansiToHtml, reportHtml } from "../scripts/report-html";

describe("HTML report export", () => {
  it("keeps the report's colours and escapes text", () => {
    expect(ansiToHtml("\x1b[31mN/A · no free source\x1b[0m <b>&")).toBe('<span class="r">N/A · no free source</span> &lt;b&gt;&amp;');
    expect(ansiToHtml("\x1b[1m\x1b[32mW\x1b[0m")).toBe('<span class="b"><span class="g">W</span></span>');
    // An unclosed colour is closed at the end.
    expect(ansiToHtml("\x1b[2mdim")).toBe('<span class="d">dim</span>');
  });

  it("puts each match in its own printable block", () => {
    const page = reportHtml(["\nArsenal v Leeds", "England v Spain"], new Date("2026-09-23T15:00:00Z"));
    expect(page.match(/<pre>/g)).toHaveLength(2);
    expect(page).toContain("page-break-after:always");
    expect(page).toContain("<pre>Arsenal v Leeds</pre>");
  });
});
