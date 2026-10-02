import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Connections } from "../src/mcp";
test("task questions discover project and task tools even when a different read tool was configured", async () => {
  const calls: string[] = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let body = "";
    for await (const part of req) body += part;
    const q = JSON.parse(body);
    if (q.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    let result: any;
    if (q.method === "initialize")
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "Loom test", version: "1" },
      };
    if (q.method === "tools/list")
      result = {
        tools: ["list_projects", "list_tasks", "get_bug"].map((name) => ({
          name,
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: true },
        })),
      };
    if (q.method === "tools/call") {
      calls.push(q.params.name);
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              q.params.name === "list_projects"
                ? [{ id: "project-1", name: "Project" }]
                : [
                    {
                      title: "Review task",
                      assignee: "Abhinand",
                      status: "open",
                    },
                  ],
            ),
          },
        ],
      };
    }
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: q.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  const id = randomUUID();
  const manager = new Connections([], () => {});
  try {
    await manager.save({
      id,
      name: "Loom",
      url: `http://127.0.0.1:${port}`,
      token: "",
      tool: "get_bug",
    });
    assert.equal(manager.readyCount(), 1);
    await manager.query(
      "What are Abhinand tasks today?",
      undefined,
      "Abhinand",
    );
    assert.ok(calls.includes("list_projects"));
    assert.ok(calls.includes("list_tasks"));
    assert.ok(!calls.includes("get_bug"));
  } finally {
    await manager.disconnect(id);
    await new Promise<void>((r) => server.close(() => r()));
  }
});
