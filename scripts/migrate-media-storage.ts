import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const apply = process.argv.includes("--apply");
const deleteLegacy = process.argv.includes("--delete-legacy");
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const legacyBucketName = "media";
const imageBucketName = "funnel-images";
const privateBucketName = "project-media-private";
const oldPublicPrefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${legacyBucketName}/`;
const privateReferencePrefix = "/api/admin/media/private/";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(scriptDir, "../data/backups");

function isImage(mimeType: string, filename: string) {
  return mimeType.startsWith("image/")
    || /\.(?:jpe?g|png|gif|webp)$/i.test(filename);
}

function replaceLegacyReferences(value: any, replacements: Map<string, string>): { value: any; changed: boolean } {
  if (typeof value === "string") {
    let next = value;
    for (const [oldUrl, newUrl] of replacements) {
      next = next.split(oldUrl).join(newUrl);
    }
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = replaceLegacyReferences(item, replacements);
      changed ||= result.changed;
      return result.value;
    });
    return { value: next, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next = Object.fromEntries(Object.entries(value).map(([key, nested]) => {
      const result = replaceLegacyReferences(nested, replacements);
      const replacedKey = replaceLegacyReferences(key, replacements);
      changed ||= result.changed || replacedKey.changed;
      return [replacedKey.value, result.value];
    }));
    return { value: next, changed };
  }
  return { value, changed: false };
}

async function main() {
  const { data: objects, error: listError } = await supabase.storage.from(legacyBucketName).list("", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (listError) throw listError;

  const files = (objects || []).filter((item) => item.id);
  const { data: funnels, error: funnelsError } = await supabase.from("funnels").select("id,data");
  if (funnelsError) throw funnelsError;

  const replacements = new Map<string, string>();
  for (const file of files) {
    const mimeType = String(file.metadata?.mimetype || file.metadata?.contentType || "application/octet-stream");
    const targetBucket = isImage(mimeType, file.name) ? imageBucketName : privateBucketName;
    const newReference = targetBucket === imageBucketName
      ? supabase.storage.from(imageBucketName).getPublicUrl(file.name).data.publicUrl
      : `${privateReferencePrefix}${encodeURIComponent(file.name)}`;
    replacements.set(`${oldPublicPrefix}${file.name}`, newReference);
  }

  const changedFunnels = (funnels || []).flatMap((funnel) => {
    const result = replaceLegacyReferences(funnel.data, replacements);
    return result.changed ? [{ id: funnel.id, data: result.value }] : [];
  });

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    legacyObjects: files.length,
    imageObjects: files.filter((file) => isImage(String(file.metadata?.mimetype || ""), file.name)).length,
    privateObjects: files.filter((file) => !isImage(String(file.metadata?.mimetype || ""), file.name)).length,
    funnelsToUpdate: changedFunnels.length,
  }, null, 2));

  if (!apply) return;

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `security-media-migration-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ funnels }, null, 2), { mode: 0o600 });

  for (const file of files) {
    const mimeType = String(file.metadata?.mimetype || file.metadata?.contentType || "application/octet-stream");
    const targetBucket = isImage(mimeType, file.name) ? imageBucketName : privateBucketName;
    const { data: body, error: downloadError } = await supabase.storage.from(legacyBucketName).download(file.name);
    if (downloadError || !body) throw downloadError || new Error(`Unable to download ${file.name}`);

    const { error: uploadError } = await supabase.storage.from(targetBucket).upload(
      file.name,
      Buffer.from(await body.arrayBuffer()),
      {
        contentType: mimeType,
        metadata: { migratedFrom: legacyBucketName },
        upsert: true,
      },
    );
    if (uploadError) throw uploadError;
  }

  for (const funnel of changedFunnels) {
    const { error } = await supabase.from("funnels").update({
      data: funnel.data,
      updated_at: new Date().toISOString(),
    }).eq("id", funnel.id);
    if (error) throw error;
  }

  const { data: verifiedFunnels, error: verifyError } = await supabase
    .from("funnels")
    .select("id,data");
  if (verifyError) throw verifyError;
  const remainingLegacyReferences = (verifiedFunnels || []).filter((funnel) =>
    JSON.stringify(funnel.data).includes(oldPublicPrefix)
  );
  if (remainingLegacyReferences.length > 0) {
    throw new Error(`Legacy media references remain in ${remainingLegacyReferences.length} funnels`);
  }

  const { data: legacyBucket, error: bucketError } = await supabase.storage.getBucket(legacyBucketName);
  if (bucketError) throw bucketError;
  if (legacyBucket?.public) {
    const { error: updateError } = await supabase.storage.updateBucket(legacyBucketName, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska",
        "application/pdf",
      ],
    });
    if (updateError) throw updateError;
  }

  if (deleteLegacy && files.length > 0) {
    const { error: deleteError } = await supabase.storage
      .from(legacyBucketName)
      .remove(files.map((file) => file.name));
    if (deleteError) throw deleteError;
  }

  console.log(JSON.stringify({
    migrated: true,
    backupPath,
    checkedFunnels: verifiedFunnels?.length || 0,
    legacyBucketPublic: false,
    legacyObjectsDeleted: deleteLegacy ? files.length : 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
