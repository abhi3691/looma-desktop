import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import Ajv from "ajv";
import { taskReport, friendlyData } from "./task-format";
export type Connection = {
  id: string;
  name: string;
  url: string;
  token: string;
  tool?: string;
  args?: string;
  autoConnect?: boolean;
};
export type ToolInfo = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
};
export const connectionSchema = z
  .object({
    id: z.string().uuid(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-zA-Z0-9 _-]+$/),
    url: z.string().url().max(2048),
    token: z.string().max(4096),
    tool: z.string().max(200).optional(),
    args: z.string().max(16000).optional(),
    autoConnect: z.boolean().optional(),
  })
  .strict();
export function safeURL(value: string) {
  const u = new URL(value);
  if (u.username || u.password || u.hash)
    throw Error("Use a URL without embedded credentials or fragment");
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    )
  )
    throw Error("Use HTTPS, or HTTP on localhost");
  return u;
}
export function isReadTool(t: ToolInfo) {
  return (
    t.annotations?.destructiveHint !== true &&
    (t.name === "whoami" ||
      t.annotations?.readOnlyHint === true ||
      (/(?:^|[_.-])(get|list|search|query|read|fetch|find)(?:[_.-]|$)/i.test(
        t.name,
      ) &&
        !/(?:delete|create|update|send|write|remove|edit|execute)/i.test(
          t.name,
        )))
  );
}
export function argumentsFor(template: string, query: string, date: string) {
  const candidate =
    query.match(
      /(?:show|check|get|for|about)\s+([\p{L}]+)(?:['’]s)?\s+tasks?\b/iu,
    )?.[1] ??
    query.match(/([\p{L}]+)(?:['’]s)?\s+tasks?\b/iu)?.[1] ??
    "me";
  const assignee =
    /^(my|me|our|the|all|today|current|open|completed|done)$/i.test(candidate)
      ? "me"
      : candidate;
  const raw = JSON.parse(template);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Arguments must be a JSON object");
  const visit = (v: any): any =>
    typeof v === "string"
      ? v
          .replaceAll("{{query}}", query)
          .replaceAll("{{date}}", date)
          .replaceAll("{{assignee}}", assignee)
      : Array.isArray(v)
        ? v.map(visit)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x)]))
          : v;
  return visit(raw) as Record<string, unknown>;
}
export class Connections {
  private clients = new Map<string, Client>();
  private tools = new Map<string, ToolInfo[]>();
  private errors = new Map<string, string>();
  constructor(
    private configs: Connection[],
    private persist: (c: Connection[]) => void,
  ) {}
  list() {
    return this.configs.map(({ token, ...c }) => ({
      ...c,
      hasToken: !!token,
      connected: this.clients.has(c.id),
      error: this.errors.get(c.id),
      tools: this.tools.get(c.id) ?? [],
    }));
  }
  private hasTaskTools(id: string) {
    const tools = this.tools.get(id) || [];
    return (
      tools.some((t) => t.name === "list_projects") &&
      tools.some((t) => t.name === "list_tasks")
    );
  }
  readyCount() {
    return this.configs.filter(
      (c) =>
        this.clients.has(c.id) &&
        ((c.tool && c.args) || this.hasTaskTools(c.id)),
    ).length;
  }
  async restore() {
    await Promise.allSettled(
      this.configs
        .filter((c) => c.autoConnect !== false)
        .map((c) => this.connect(c.id)),
    );
  }
  async pause(id: string) {
    await this.disconnect(id);
    const c = this.configs.find((c) => c.id === id);
    if (c) {
      c.autoConnect = false;
      this.persist(this.configs);
    }
  }
  async save(value: unknown) {
    const c = connectionSchema.parse(value);
    safeURL(c.url);
    if (
      this.configs.some(
        (x) => x.id !== c.id && x.name.toLowerCase() === c.name.toLowerCase(),
      )
    )
      throw Error("Use a unique connection name");
    if (this.configs.length >= 10 && !this.configs.some((x) => x.id === c.id))
      throw Error("Up to ten connections supported");
    await this.disconnect(c.id);
    this.configs = this.configs.filter((x) => x.id !== c.id).concat(c);
    this.persist(this.configs);
    return this.connect(c.id);
  }
  async connect(id: string) {
    const c = this.configs.find((x) => x.id === id);
    if (!c) throw Error("Connection not found");
    await this.disconnect(id);
    const client = new Client(
      { name: "careless-ai", version: "0.1.0" },
      { capabilities: {} },
    );
    const url = safeURL(c.url);
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: c.token ? { Authorization: "Bearer " + c.token } : {},
        redirect: "error",
      },
      fetch: async (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            AbortSignal.timeout(20000),
          ]),
        }),
    });
    try {
      await client.connect(transport);
      const all: ToolInfo[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const result = await client.listTools(cursor ? { cursor } : undefined);
        all.push(...(result.tools as ToolInfo[]));
        cursor = result.nextCursor;
        if (++pages >= 10 && cursor) throw Error("Too many tool pages");
      } while (cursor);
      this.clients.set(id, client);
      this.tools.set(id, all.filter(isReadTool));
      this.errors.delete(id);
      c.autoConnect = true;
      if (
        !c.tool &&
        this.tools.get(id)?.some((t) => t.name === "list_projects")
      ) {
        c.tool = "list_projects";
        c.args = "{}";
      }
      if (c.tool === "list_projects") c.args = "{}";
      this.persist(this.configs);
      return this.list();
    } catch (e) {
      await client.close().catch(() => {});
      this.errors.set(
        id,
        "Connection failed. Check URL, authentication, and Streamable HTTP support.",
      );
      throw Error(this.errors.get(id));
    }
  }
  async disconnect(id: string) {
    const client = this.clients.get(id);
    this.clients.delete(id);
    this.tools.delete(id);
    if (client) await client.close().catch(() => {});
  }
  async remove(id: string) {
    await this.disconnect(id);
    this.configs = this.configs.filter((c) => c.id !== id);
    this.persist(this.configs);
  }
  configure(id: string, tool: string, args: string) {
    const c = this.configs.find((x) => x.id === id);
    const t = this.tools.get(id)?.find((x) => x.name === tool);
    if (!c || !t || !isReadTool(t))
      throw Error("Choose an available read-only tool");
    argumentsFor(args, "example", "2026-01-01");
    c.tool = tool;
    c.args = args;
    this.persist(this.configs);
  }
  private async projectTasks(
    client: Client,
    selected: Connection,
    projectsTool: ToolInfo,
    tasksTool: ToolInfo,
    query: string,
    now: Date,
    ownerName: string,
  ) {
    const invoke = async (tool: ToolInfo, args: Record<string, unknown>) => {
      const validate = new Ajv({
        strict: false,
        validateFormats: false,
      }).compile(tool.inputSchema);
      if (!validate(args))
        throw Error(
          "Discovered task tool requires additional arguments. Configure it in Connections.",
        );
      const result = await client.callTool(
        { name: tool.name, arguments: args },
        undefined,
        { timeout: 30000 },
      );
      if (result.isError)
        throw Error(
          "Task service could not retrieve data. Check account access.",
        );
      const texts = Array.isArray(result.content)
        ? result.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
        : [];
      if (result.structuredContent) return result.structuredContent;
      for (const text of texts) {
        try {
          return JSON.parse(text);
        } catch {}
      }
      throw Error(
        "Project lookup returned unstructured text. Configure a task tool with a project ID in Connections.",
      );
    };
    const result = await invoke(projectsTool, {});
    const findProjects = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        for (const key of ["projects", "data", "items", "result"]) {
          if (value[key]) {
            const found = findProjects(value[key]);
            if (found.length) return found;
          }
        }
      }
      return [];
    };
    const projects = findProjects(result).filter(
      (p) => typeof (p.id ?? p.projectId) === "string",
    );
    if (!projects.length)
      return `Source: ${selected.name} · list_projects\nNo accessible projects returned for this account.`;
    const named = projects.filter(
      (p) =>
        typeof p.name === "string" &&
        query.toLowerCase().includes(p.name.toLowerCase()),
    );
    const scope = named.length ? named : projects;
    let assignee = argumentsFor(
      '{"assignee":"{{assignee}}"}',
      query,
      "",
    ).assignee;
    if (assignee === "me" && ownerName) assignee = ownerName;
    if (assignee === "me") {
      const identityTool = this.tools
        .get(selected.id)
        ?.find((t) => t.name === "whoami");
      if (identityTool) {
        const identity = await invoke(identityTool, {});
        assignee = identity.name ?? identity.user?.name ?? "me";
      }
    }
    const results: { project: string; tasks?: any; error?: string }[] = [];
    const queue = scope.filter((p) => !p.deletedAt).slice();
    const workers = Array.from(
      { length: Math.min(4, queue.length) },
      async () => {
        while (queue.length) {
          const project = queue.shift()!;
          const args: Record<string, unknown> = {
            projectId: project.id ?? project.projectId,
          };
          const properties = tasksTool.inputSchema.properties as
            Record<string, unknown> | undefined;
          if (assignee !== "me" && properties?.assignee)
            args.assignee = assignee;
          if (properties?.detail) args.detail = true;
          try {
            results.push({
              project: project.name ?? project.id,
              tasks: await invoke(tasksTool, args),
            });
          } catch (e) {
            results.push({
              project: project.name ?? project.id,
              error: String(e),
            });
          }
        }
      },
    );
    await Promise.all(workers);
    results.sort((a, b) => a.project.localeCompare(b.project));
    return `Source: ${selected.name}\n\n${taskReport(results, String(assignee), now, /completed|done|finished|all tasks/i.test(query), /details|description|explain/i.test(query))}`;
  }

  async query(query: string, id?: string, ownerName = "") {
    const available = this.configs.filter(
      (c) =>
        this.clients.has(c.id) &&
        ((c.tool && c.args) || this.hasTaskTools(c.id)),
    );
    const selected = id
      ? available.find(
          (c) => c.id === id || c.name.toLowerCase() === id.toLowerCase(),
        )
      : available.length === 1
        ? available[0]
        : undefined;
    if (!selected)
      return available.length > 1
        ? "Choose a connection in the chat source menu, or use /tasks @ConnectionName your question."
        : "No task connection is ready. Add a server in Connections, connect it, then configure a read-only task tool.";
    const client = this.clients.get(selected.id)!;
    const tool = this.tools
      .get(selected.id)
      ?.find((t) => t.name === (selected.tool || "list_projects"));
    if (!tool || !isReadTool(tool)) throw Error("Read-only tool unavailable");
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const taskTool = this.tools
      .get(selected.id)
      ?.find((t) => t.name === "list_tasks");
    const projectTool = this.tools
      .get(selected.id)
      ?.find((t) => t.name === "list_projects");
    if (
      taskTool &&
      projectTool &&
      /task|work today|today.*work|ജോലി|ടാസ്ക്/i.test(query)
    ) {
      return this.projectTasks(
        client,
        selected,
        projectTool,
        taskTool,
        query,
        now,
        ownerName,
      );
    }
    const args = argumentsFor(selected.args!, query, date);
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(
      tool.inputSchema,
    );
    if (!validate(args))
      throw Error(
        "Task arguments do not match the tool schema. Update its argument template in Connections.",
      );
    const result = await client.callTool(
      { name: tool.name, arguments: args },
      undefined,
      { timeout: 30000 },
    );
    if (result.isError)
      throw Error(
        "The task service returned an error. Check your permissions and argument template.",
      );
    const content = Array.isArray(result.content)
      ? result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n")
      : "";
    let output = content;
    if (result.structuredContent)
      output = friendlyData(result.structuredContent);
    else {
      try {
        output = friendlyData(JSON.parse(content));
      } catch {}
    }
    return `Source: ${selected.name} · ${tool.name}\nUpdated ${now.toLocaleString()}\n\n${output.slice(0, 24000)}${output.length > 24000 ? "\n[More results available]" : ""}`;
  }
}
