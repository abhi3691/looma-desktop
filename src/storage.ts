import initSqlJs, { type Database } from "sql.js";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { defaults, settingsSchema, type Settings, type Entry } from "./shared";
export class Memory {
  private constructor(
    private db: Database,
    private file: string,
  ) {}
  static async open(file: string, wasm: string) {
    const SQL = await initSqlJs({ locateFile: () => wasm });
    mkdirSync(dirname(file), { recursive: true });
    const db = new SQL.Database(
      existsSync(file) ? readFileSync(file) : undefined,
    );
    db.run(
      "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT); CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT,time INTEGER,kind TEXT,text TEXT); CREATE TABLE IF NOT EXISTS usage (day TEXT, app TEXT, seconds INTEGER, PRIMARY KEY(day,app));",
    );
    return new Memory(db, file);
  }
  save() {
    writeFileSync(this.file + ".tmp", this.db.export(), { mode: 0o600 });
    renameSync(this.file + ".tmp", this.file);
  }
  settings(): Settings {
    const data = this.db.exec("SELECT data FROM settings WHERE id=1")[0]
      ?.values[0]?.[0];
    try {
      return settingsSchema.parse(JSON.parse(String(data)));
    } catch {
      return { ...defaults };
    }
  }
  set(s: Settings) {
    this.db.run("INSERT OR REPLACE INTO settings VALUES (1,?)", [
      JSON.stringify(s),
    ]);
    this.prune(s.retention);
    this.save();
  }
  add(kind: string, text: string) {
    this.db.run("INSERT INTO events(time,kind,text) VALUES (?,?,?)", [
      Date.now(),
      kind,
      text,
    ]);
    this.save();
  }
  entries(chat = false): Entry[] {
    const q = this.db.prepare(
      `SELECT id,time,kind,text FROM events WHERE kind ${chat ? "IN" : "NOT IN"} ('user','assistant') ORDER BY id DESC LIMIT 200`,
    );
    const a: Entry[] = [];
    while (q.step()) a.push(q.getAsObject() as Entry);
    q.free();
    return a;
  }
  usage(app: string) {
    this.db.run(
      "INSERT INTO usage(day,app,seconds) VALUES (?,?,5) ON CONFLICT(day,app) DO UPDATE SET seconds=seconds+5",
      [new Date().toLocaleDateString("en-CA"), app],
    );
    this.save();
  }
  todayUsage() {
    const q = this.db.prepare(
      "SELECT app,seconds FROM usage WHERE day=? ORDER BY seconds DESC",
    );
    q.bind([new Date().toLocaleDateString("en-CA")]);
    const rows: { app: string; seconds: number }[] = [];
    while (q.step()) {
      const r = q.getAsObject();
      rows.push({ app: String(r.app), seconds: Number(r.seconds) });
    }
    q.free();
    return rows;
  }
  dailyWork(): Entry[] {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const q = this.db.prepare(
      "SELECT id,time,kind,text FROM events WHERE kind='work' AND time>=? ORDER BY id DESC",
    );
    q.bind([d.getTime()]);
    const rows: Entry[] = [];
    while (q.step()) rows.push(q.getAsObject() as Entry);
    q.free();
    return rows;
  }
  counts() {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const q = this.db.prepare(
      "SELECT kind,COUNT(*) AS n FROM events WHERE time>=? GROUP BY kind",
    );
    q.bind([day.getTime()]);
    let activities = 0,
      warnings = 0;
    while (q.step()) {
      const r = q.getAsObject();
      if (r.kind === "activity") activities = Number(r.n);
      if (r.kind === "warning") warnings = Number(r.n);
    }
    q.free();
    return { activities, warnings };
  }
  prune(days: number) {
    this.db.run("DELETE FROM events WHERE time < ?", [
      Date.now() - days * 86400000,
    ]);
    this.db.run("DELETE FROM usage WHERE day < ?", [
      new Date(Date.now() - days * 86400000).toLocaleDateString("en-CA"),
    ]);
    this.save();
  }
  clear() {
    this.db.run("DELETE FROM events; DELETE FROM usage; VACUUM;");
    this.save();
  }
}
