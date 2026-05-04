import zlib from "zlib";

export type AssExport = {
  gzipSnapshot: string;
};

export type BaseSnapshotItem = {
  schema?: {
    data?: {
      table?: {
        fieldMap?: Record<string, any>;
        meta?: any;
      };
      recordMap?: Record<string, Record<string, any>>;
      recordMeta?: any;
    };
  };
};

export type BaseSnapshot = BaseSnapshotItem[];

export function decodeAssSnapshot(input: AssExport): BaseSnapshot {
  const b64 = typeof input?.gzipSnapshot === "string" ? input.gzipSnapshot : "";
  if (!b64) throw new Error("gzipSnapshot is required");
  const raw = Buffer.from(b64, "base64");
  const json = zlib.gunzipSync(raw).toString("utf-8");
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("invalid snapshot format");
  return parsed as BaseSnapshot;
}

export function extractTableSnapshot(snapshot: BaseSnapshot) {
  let best: BaseSnapshotItem | null = null;
  let bestCount = -1;
  for (const item of snapshot) {
    const recordMap = item?.schema?.data?.recordMap;
    const count = recordMap ? Object.keys(recordMap).length : 0;
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  const fieldMap = best?.schema?.data?.table?.fieldMap;
  const recordMap = best?.schema?.data?.recordMap;
  if (!fieldMap || !recordMap) throw new Error("snapshot missing fieldMap/recordMap");
  return {
    fieldMap: fieldMap as Record<string, any>,
    recordMap: recordMap as Record<string, Record<string, any>>,
    recordMeta: best?.schema?.data?.recordMeta,
    tableMeta: best?.schema?.data?.table?.meta
  };
}

export function makeFieldResolver(fieldMap: Record<string, any>) {
  const fieldIdByName = new Map<string, string>();
  const optionsByFieldId = new Map<string, Map<string, string>>();

  for (const [fid, f] of Object.entries(fieldMap)) {
    const name = typeof (f as any)?.name === "string" ? String((f as any).name).trim() : "";
    if (name) fieldIdByName.set(name, fid);
    const opts = Array.isArray((f as any)?.property?.options) ? (f as any).property.options : [];
    if (opts.length) {
      const m = new Map<string, string>();
      for (const o of opts) {
        if (typeof o?.id === "string" && typeof o?.name === "string") m.set(o.id, o.name);
      }
      optionsByFieldId.set(fid, m);
    }
  }

  const getFieldId = (fieldName: string) => fieldIdByName.get(fieldName.trim()) ?? null;

  const readText = (record: Record<string, any>, fieldName: string) => {
    const fid = getFieldId(fieldName);
    if (!fid) return "";
    const cell = record?.[fid];
    if (!cell || typeof cell !== "object") return "";
    const value = (cell as any).value;
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (!Array.isArray(value)) return "";
    return value
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string" || typeof x === "number") return String(x);
        if (typeof x.text === "string") return x.text;
        return "";
      })
      .join("")
      .trim();
  };

  const readSingleSelect = (record: Record<string, any>, fieldName: string) => {
    const fid = getFieldId(fieldName);
    if (!fid) return "";
    const cell = record?.[fid];
    if (!cell || typeof cell !== "object") return "";
    const id = (cell as any).value;
    if (typeof id !== "string") return "";
    const map = optionsByFieldId.get(fid);
    return (map?.get(id) ?? "").trim();
  };

  const readMultiSelect = (record: Record<string, any>, fieldName: string) => {
    const fid = getFieldId(fieldName);
    if (!fid) return [] as string[];
    const cell = record?.[fid];
    if (!cell || typeof cell !== "object") return [] as string[];
    const ids = (cell as any).value;
    if (!Array.isArray(ids)) return [] as string[];
    const map = optionsByFieldId.get(fid);
    return ids
      .map((id) => (map?.get(String(id)) ?? "").trim())
      .filter(Boolean);
  };

  return { getFieldId, readText, readSingleSelect, readMultiSelect };
}

