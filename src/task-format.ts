const labels: Record<string, string> = {
  todo: "To do",
  inProgress: "In progress",
  inReview: "In review",
  inQa: "In QA",
  done: "Done",
  blocked: "Blocked",
};
export function records(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["tasks", "projects", "items", "data", "result"]) {
      if (value[key]) {
        const found = records(value[key]);
        if (found.length || Array.isArray(value[key])) return found;
      }
    }
  }
  return [];
}
function name(value: any): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(name).filter(Boolean).join(", ");
  if (value && typeof value === "object")
    return name(
      value.name ?? value.displayName ?? value.email ?? value.title ?? "",
    );
  return "";
}
export function friendlyData(value: any, depth = 0): string {
  if (value == null) return "No information returned.";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "No items found.";
    if (
      value.every(
        (v) =>
          v &&
          typeof v === "object" &&
          typeof v.name === "string" &&
          "taskCount" in v,
      )
    ) {
      const cell = (v: unknown) =>
        String(v ?? "—")
          .replace(/\|/g, "\\|")
          .replace(/[\r\n]/g, " ");
      return `| Project | Status | Progress | Tasks |\n| --- | --- | --- | --- |\n${value
        .slice(0, 100)
        .map(
          (v) =>
            "| " +
            [
              v.name,
              v.status,
              v.progress != null ? v.progress + "%" : "—",
              v.taskCount,
            ]
              .map(cell)
              .join(" | ") +
            " |",
        )
        .join("\n")}`;
    }
    return value
      .slice(0, 40)
      .map((v) => "• " + friendlyData(v, depth + 1))
      .join("\n");
  }
  const title = name(value.title ?? value.name ?? value.summary);
  if (title && "taskCount" in value) {
    return `${title}\n${[value.status ? "Status: " + value.status : "", value.progress != null ? "Progress: " + value.progress + "%" : "", value.taskCount != null ? value.taskCount + " tasks" : ""].filter(Boolean).join(" · ")}`;
  }
  const fields = Object.entries(value).filter(
    ([k, v]) =>
      v != null &&
      !["title", "name", "summary", "members", "settings"].includes(k) &&
      !/(?:Id|^id$)/.test(k),
  );
  const details = fields
    .slice(0, 14)
    .map(([k, v]) => {
      const label = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
      return (
        label.charAt(0).toUpperCase() +
        label.slice(1) +
        ": " +
        (depth > 3
          ? name(v) || "Additional details available"
          : friendlyData(v, depth + 1))
      );
    })
    .join("\n");
  return [title, details].filter(Boolean).join("\n");
}
export function taskReport(
  groups: { project: string; tasks?: any; error?: string }[],
  person: string,
  date: Date,
  includeDone = false,
  showDetails = false,
): string {
  const visible = (value: any) =>
    records(value).filter(
      (t) =>
        includeDone || !/^(done|completed|closed)$/i.test(String(t.status)),
    );
  let total = 0,
    blocked = 0;
  const sections = groups
    .filter((g) => g.error || visible(g.tasks).length)
    .map((group) => {
      if (group.error)
        return `${group.project}\nCouldn’t retrieve this project’s tasks. Please check its access permissions.`;
      const tasks = visible(group.tasks);
      total += tasks.length;
      blocked += tasks.filter((t) => t.status === "blocked").length;
      const cell = (v: string) =>
        v.replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
      const rows = tasks.slice(0, 40).map((task) => {
        const title =
          name(task.title ?? task.name ?? task.summary) || "Untitled task";
        const status = name(task.status);
        const assignee =
          name(task.assignee ?? task.assignedTo ?? task.assignees) ||
          "Not assigned";
        const due =
          name(task.dueDate ?? task.dueAt ?? task.deadline) || "Not set";
        return `| ${[title, labels[status] ?? status ?? "Unknown", assignee, due].map(cell).join(" | ")} |`;
      });
      const details = showDetails
        ? tasks
            .slice(0, 40)
            .filter(
              (t) => typeof t.description === "string" && t.description.trim(),
            )
            .map(
              (t) =>
                `${name(t.title ?? t.name)}\n${t.description.trim().slice(0, 500)}`,
            )
            .join("\n\n")
        : "";
      return `### ${group.project}\n| Task | Status | Assigned to | Due date |\n| --- | --- | --- | --- |\n${rows.join("\n")}${tasks.length > 40 ? "\nShowing the first 40 tasks." : ""}${details ? "\n\n" + details : ""}`;
    });
  const heading =
    person === "me"
      ? "Here are the tasks visible to your Loom account."
      : `Here’s ${person}’s current task list.`;
  return `${heading}\n${total} ${includeDone ? "" : "open "}${total === 1 ? "task" : "tasks"} found. Checked ${groups.length} ${groups.length === 1 ? "project" : "projects"}${blocked ? " · " + blocked + " blocked" : ""}.\n\n${sections.join("\n\n──────────\n\n") || "No matching tasks were found."}\n\n${person === "me" ? "Loom has not provided your identity, so this includes everything your account can access.\n" : ""}These are current tasks. Loom’s tool does not filter by today’s date.\nUpdated ${date.toLocaleString()}`;
}
