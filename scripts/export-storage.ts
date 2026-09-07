import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const outputRoot = path.resolve(process.argv[2] || "");
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
if (!process.argv[2] || !supabaseUrl || !serviceKey) {
  throw new Error("Usage: tsx scripts/export-storage.ts <output-dir>; Supabase credentials are required");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeObjectPath(bucketDir: string, objectName: string) {
  const resolved = path.resolve(bucketDir, objectName);
  if (!resolved.startsWith(`${bucketDir}${path.sep}`)) {
    throw new Error(`Unsafe Storage object path: ${objectName}`);
  }
  return resolved;
}

async function listObjects(bucketName: string, prefix = ""): Promise<string[]> {
  const names: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    for (const item of data || []) {
      const objectName = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) names.push(objectName);
      else names.push(...await listObjects(bucketName, objectName));
    }
    if (!data || data.length < pageSize) break;
  }
  return names;
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw bucketError;

  const manifest: Array<{ bucket: string; object: string; bytes: number }> = [];
  for (const bucket of buckets || []) {
    const bucketDir = path.join(outputRoot, bucket.id);
    const objects = await listObjects(bucket.id);
    for (const objectName of objects) {
      const { data, error } = await supabase.storage.from(bucket.id).download(objectName);
      if (error || !data) throw error || new Error(`Unable to download ${bucket.id}/${objectName}`);
      const buffer = Buffer.from(await data.arrayBuffer());
      const destination = safeObjectPath(bucketDir, objectName);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      fs.writeFileSync(destination, buffer, { mode: 0o600 });
      manifest.push({ bucket: bucket.id, object: objectName, bytes: buffer.length });
    }
  }

  fs.writeFileSync(
    path.join(outputRoot, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), files: manifest }, null, 2),
    { mode: 0o600 },
  );
  console.log(`Exported ${manifest.length} Storage objects`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
