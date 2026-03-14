import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const REPO_ROOT = join(import.meta.dir, "..");
const SCRIPT = join(REPO_ROOT, "scripts", "vom-tidy.sh");

function writeTicket(dir: string, state: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "ticket.md"),
    `---
id: ${dir.split("/").pop()}
title: Test
state: ${state}
---
## Description
Test ticket.
`
  );
}

describe("vom-tidy.sh", () => {
  test("moves done and deleted tickets and leaves others in place", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vom-tidy-"));
    try {
      const ticketsDir = join(tmp, ".vom", "tickets");
      writeTicket(join(ticketsDir, "TKT-A"), "done");
      writeTicket(join(ticketsDir, "TKT-B"), "deleted");
      writeTicket(join(ticketsDir, "TKT-C"), "new");

      const proc = Bun.spawn(["bash", SCRIPT, tmp], {
        cwd: REPO_ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      if (stderr) expect(stderr).toBe("");

      expect(existsSync(join(ticketsDir, "done", "TKT-A"))).toBe(true);
      expect(existsSync(join(ticketsDir, "deleted", "TKT-B"))).toBe(true);
      expect(existsSync(join(ticketsDir, "TKT-C"))).toBe(true);
      expect(existsSync(join(ticketsDir, "TKT-A"))).toBe(false);
      expect(existsSync(join(ticketsDir, "TKT-B"))).toBe(false);

      expect(stdout).toContain("TKT-A");
      expect(stdout).toContain("TKT-B");
      expect(stdout).toContain("tickets/done");
      expect(stdout).toContain("tickets/deleted");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("reports no moves when no done or deleted tickets", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vom-tidy-"));
    try {
      const ticketsDir = join(tmp, ".vom", "tickets");
      writeTicket(join(ticketsDir, "TKT-X"), "new");
      writeTicket(join(ticketsDir, "TKT-Y"), "planning");

      const proc = Bun.spawn(["bash", SCRIPT, tmp], {
        cwd: REPO_ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      expect(stdout).toContain("No done or deleted tickets to move");
      expect(existsSync(join(ticketsDir, "TKT-X"))).toBe(true);
      expect(existsSync(join(ticketsDir, "TKT-Y"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
