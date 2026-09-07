import express from "express";
import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type multer from "multer";
import { processVideoNoteToSquare, validateUploadedMedia } from "../services/media";

const PUBLIC_IMAGE_BUCKET = "funnel-images";
const PRIVATE_MEDIA_BUCKET = "project-media-private";
const PUBLIC_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const PRIVATE_MEDIA_MIME_TYPES = [
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska", "application/pdf",
];

interface MediaRoutesContext {
  getFunnels: () => any[];
  imagesDir: string;
  mediaDir: string;
  mediaUpload: multer.Multer;
  getSupabase: () => SupabaseClient | null;
  getTgCache: () => Record<string, any>;
  getUseSupabase: () => boolean;
  isProduction?: boolean;
}

export function registerMediaRoutes(app: express.Express, ctx: MediaRoutesContext) {
  interface MediaManifestEntry {
    originalName: string;
    uploadedAt: string;
    mimeType: string;
    size: number;
  }

  interface MediaLibraryItem {
    id: string;
    filename: string;
    name: string;
    url: string;
    type: "image" | "video" | "pdf";
    mimeType: string;
    size: number;
    createdAt: string;
    source: "project" | "upload" | "cloud";
    usedIn: Array<{ id: string; title: string; type?: string }>;
  }

  const manifestPath = path.join(path.dirname(ctx.mediaDir), "media-library.json");
  let mediaManifest: Record<string, MediaManifestEntry> = {};

  try {
    if (fs.existsSync(manifestPath)) {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) mediaManifest = parsed;
    }
  } catch (error) {
    console.warn("Failed to read media manifest:", error);
  }

  function saveMediaManifest() {
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(mediaManifest, null, 2));
    } catch (error) {
      // В облаке исходное имя дополнительно хранится в metadata объекта.
      // Ошибка локального manifest не должна превращать успешную загрузку в неуспешную.
      console.warn("Failed to save media manifest:", error);
    }
  }

  function inferMediaType(filename: string, mimeType = ""): MediaLibraryItem["type"] | null {
    const extension = path.extname(filename).toLowerCase();
    if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) return "image";
    if (mimeType.startsWith("video/") || [".mp4", ".mov", ".avi", ".webm", ".mkv"].includes(extension)) return "video";
    if (mimeType === "application/pdf" || extension === ".pdf") return "pdf";
    return null;
  }

  function inferMimeType(filename: string) {
    const extension = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".pdf": "application/pdf",
    };
    return mimeTypes[extension] || "application/octet-stream";
  }

  function getUsage(filename: string, url: string): MediaLibraryItem["usedIn"] {
    return ctx.getFunnels()
      .filter(funnel => {
        const serialized = JSON.stringify(funnel);
        return serialized.includes(filename) || serialized.includes(url);
      })
      // Вид воронки едет вместе с ней: галерея умеет отбирать файлы не только
      // по конкретной воронке, но и по виду оффера.
      .map(funnel => ({ id: funnel.id, title: funnel.title || funnel.id, type: funnel.type }));
  }

  async function listDirectory(
    directory: string,
    urlPrefix: string,
    source: MediaLibraryItem["source"]
  ): Promise<MediaLibraryItem[]> {
    if (!fs.existsSync(directory)) return [];
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries
      .filter(entry => entry.isFile() && !entry.name.startsWith("."))
      .map(async entry => {
        const filePath = path.join(directory, entry.name);
        const stats = await fs.promises.stat(filePath);
        const manifest = mediaManifest[entry.name];
        const mimeType = manifest?.mimeType || inferMimeType(entry.name);
        const type = inferMediaType(entry.name, mimeType);
        if (!type) return null;
        const url = `${urlPrefix}/${encodeURIComponent(entry.name)}`;

        return {
          id: `${source}:${entry.name}`,
          filename: entry.name,
          name: manifest?.originalName || entry.name,
          url,
          type,
          mimeType,
          size: manifest?.size || stats.size,
          createdAt: manifest?.uploadedAt || stats.birthtime.toISOString(),
          source,
          usedIn: getUsage(entry.name, url),
        } satisfies MediaLibraryItem;
      }));
    return files.filter((file): file is MediaLibraryItem => Boolean(file));
  }

  async function ensureBucket(
    supabase: SupabaseClient,
    bucketName: string,
    options: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number },
  ) {
    const { data: existing } = await supabase.storage.getBucket(bucketName);
    if (existing) {
      const { error } = await supabase.storage.updateBucket(bucketName, options);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.storage.createBucket(bucketName, options);
    if (error) throw error;
  }

  async function listCloudBucket(
    supabase: SupabaseClient,
    bucketName: string,
    isPublic: boolean,
  ): Promise<MediaLibraryItem[]> {
    const bucket = supabase.storage.from(bucketName);
    let objects: any[] = [];

    if (typeof (bucket as any).listV2 === "function") {
      try {
        const { data, error } = await (bucket as any).listV2({ prefix: "", limit: 1000 });
        if (error) throw error;
        objects = Array.isArray(data?.objects) ? data.objects : [];
      } catch (error: any) {
        console.warn(`Supabase Storage ${bucketName} listV2 failed, using list():`, error?.message || error);
      }
    }

    if (objects.length === 0) {
      const { data, error } = await bucket.list("", {
        limit: 1000,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      objects = Array.isArray(data) ? data.filter(file => file.id) : [];
    }

    return (await Promise.all(objects.map(async (file) => {
      const manifest = mediaManifest[file.name];
      const mimeType = file.metadata?.mimetype
        || file.metadata?.contentType
        || manifest?.mimeType
        || inferMimeType(file.name);
      const type = inferMediaType(file.name, mimeType);
      if (!type) return null;

      let url: string;
      if (isPublic) {
        url = bucket.getPublicUrl(file.name).data.publicUrl;
      } else {
        const { data, error } = await bucket.createSignedUrl(file.name, 15 * 60);
        if (error || !data?.signedUrl) return null;
        url = data.signedUrl;
      }

      const stableReference = isPublic
        ? url
        : `/api/admin/media/private/${encodeURIComponent(file.name)}`;
      return {
        id: `${bucketName}:${file.name}`,
        filename: file.name,
        name: file.metadata?.originalName || manifest?.originalName || file.name,
        url,
        type,
        mimeType,
        size: Number(file.metadata?.size || manifest?.size || 0),
        createdAt: file.created_at || file.updated_at || manifest?.uploadedAt || new Date(0).toISOString(),
        source: "cloud",
        usedIn: getUsage(file.name, stableReference),
      } satisfies MediaLibraryItem;
    }))).filter(Boolean) as MediaLibraryItem[];
  }

  async function listCloudMedia(): Promise<MediaLibraryItem[]> {
    const supabase = ctx.getSupabase();
    if (!ctx.getUseSupabase() || !supabase) return [];

    try {
      const [publicImages, privateMedia] = await Promise.all([
        listCloudBucket(supabase, PUBLIC_IMAGE_BUCKET, true),
        listCloudBucket(supabase, PRIVATE_MEDIA_BUCKET, false),
      ]);
      return [...publicImages, ...privateMedia];
    } catch (error: any) {
      console.warn("Failed to list Supabase media, using local files:", error?.message || error);
      return [];
    }
  }

  app.use("/api/images", express.static(ctx.imagesDir));
  app.get("/api/media/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(path.extname(filename).toLowerCase())) {
      return res.sendStatus(404);
    }
    return res.sendFile(path.join(ctx.mediaDir, filename));
  });

  const receiveSingleMedia: express.RequestHandler = (req, res, next) => {
    ctx.mediaUpload.single("file")(req, res, (error: any) => {
      if (!error) return next();
      const message = error?.code === "LIMIT_FILE_SIZE"
        ? "Файл превышает лимит 50 МБ"
        : error?.message || "Файл не принят";
      return res.status(400).json({ error: message });
    });
  };

  app.post("/api/media/upload", receiveSingleMedia, async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    try {
      req.file.mimetype = await validateUploadedMedia(req.file.path, req.file.originalname);
    } catch (error: any) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: error?.message || "Файл не прошёл проверку" });
    }

    const mediaType = inferMediaType(req.file.filename, req.file.mimetype);
    const isPublicImage = mediaType === "image";
    let fileUrl = isPublicImage
      ? `/api/media/${req.file.filename}`
      : `/api/admin/media/private/${encodeURIComponent(req.file.filename)}`;

    if (req.body.type === 'videoNote' && req.file.mimetype.startsWith('video/')) {
      const inputPath = req.file.path;
      const tempOutFilename = `proc-vn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
      const tempOutPath = path.join(ctx.mediaDir, tempOutFilename);

      console.log(`📹 Starting ffmpeg transcoding for videoNote. Input: ${inputPath}, Temp Output: ${tempOutPath}`);
      const success = await processVideoNoteToSquare(inputPath, tempOutPath);
      if (success && fs.existsSync(tempOutPath)) {
        try {
          fs.unlinkSync(inputPath);
          fs.renameSync(tempOutPath, inputPath);
          const stats = fs.statSync(inputPath);
          req.file.size = stats.size;
          console.log(`✅ videoNote processed successfully. New size: ${req.file.size}`);
        } catch (err) {
          console.error("❌ Error replacing original file with processed videoNote:", err);
        }
      } else {
        console.warn("⚠️ videoNote processing failed, rejecting upload to avoid sending a regular video.");
        if (fs.existsSync(tempOutPath)) {
          try { fs.unlinkSync(tempOutPath); } catch (_) {}
        }
        if (fs.existsSync(inputPath)) {
          try { fs.unlinkSync(inputPath); } catch (_) {}
        }
        return res.status(500).json({
          error: "Не удалось подготовить видео-кружок. Проверьте, что на сервере установлен ffmpeg/ffprobe, и загрузите видео ещё раз.",
        });
      }
    }

    const supabase = ctx.getSupabase();
    if (ctx.getUseSupabase() && supabase) {
      try {
        const bucketName = isPublicImage ? PUBLIC_IMAGE_BUCKET : PRIVATE_MEDIA_BUCKET;
        await ensureBucket(supabase, bucketName, {
          public: isPublicImage,
          allowedMimeTypes: isPublicImage ? PUBLIC_IMAGE_MIME_TYPES : PRIVATE_MEDIA_MIME_TYPES,
          fileSizeLimit: 50 * 1024 * 1024,
        });

        const fileBuffer = fs.readFileSync(req.file.path);
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(req.file.filename, fileBuffer, {
            contentType: req.file.mimetype || 'video/mp4',
            metadata: {
              originalName: req.file.originalname,
              uploadedAt: new Date().toISOString(),
            },
            upsert: true
          });

        if (error) {
          if (ctx.isProduction) throw error;
          console.error("❌ Supabase Storage upload failed, using local fallback:", error);
        } else {
          if (isPublicImage) {
            fileUrl = supabase.storage.from(bucketName).getPublicUrl(req.file.filename).data.publicUrl;
          }
          console.log("✅ Media successfully saved to protected Storage bucket");
        }
      } catch (err) {
        if (ctx.isProduction) {
          await fs.promises.unlink(req.file.path).catch(() => undefined);
          console.error("❌ Supabase Storage upload failed:", err);
          return res.status(503).json({ error: "Облачное хранилище временно недоступно. Попробуйте ещё раз." });
        }
        console.error("❌ Exception during Supabase upload, using local fallback:", err);
      }
    }

    mediaManifest[req.file.filename] = {
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      mimeType: req.file.mimetype || inferMimeType(req.file.filename),
      size: req.file.size,
    };
    saveMediaManifest();

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });

  app.get("/api/admin/media/private/:filename", async (req, res) => {
    const filename = path.basename(req.params.filename);
    const supabase = ctx.getSupabase();
    if (ctx.getUseSupabase() && supabase) {
      const { data, error } = await supabase.storage
        .from(PRIVATE_MEDIA_BUCKET)
        .createSignedUrl(filename, 5 * 60);
      if (!error && data?.signedUrl) {
        res.setHeader("Cache-Control", "private, no-store");
        return res.redirect(302, data.signedUrl);
      }
    }

    const localPath = path.join(ctx.mediaDir, filename);
    if (!fs.existsSync(localPath)) return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    return res.sendFile(localPath);
  });

  app.get("/api/admin/media/library", async (_req, res) => {
    try {
      const [localMedia, projectImages, cloudMedia] = await Promise.all([
        listDirectory(ctx.mediaDir, "/api/media", "upload"),
        listDirectory(ctx.imagesDir, "/api/images", "project"),
        listCloudMedia(),
      ]);

      const itemsByFilename = new Map<string, MediaLibraryItem>();
      for (const item of [...localMedia, ...cloudMedia]) {
        const existing = itemsByFilename.get(item.filename);
        itemsByFilename.set(item.filename, existing
          ? {
              ...existing,
              ...item,
              name: mediaManifest[item.filename]?.originalName || item.name || existing.name,
              size: item.size || existing.size,
              createdAt: item.createdAt === new Date(0).toISOString() ? existing.createdAt : item.createdAt,
              usedIn: item.usedIn.length > 0 ? item.usedIn : existing.usedIn,
            }
          : item);
      }

      const items = [...projectImages, ...itemsByFilename.values()]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      res.json({ items });
    } catch (error: any) {
      console.error("Failed to build media library:", error?.message || error);
      res.status(500).json({ error: "Не удалось загрузить медиагалерею" });
    }
  });

  app.delete("/api/admin/media/library", async (req, res) => {
    const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    const separatorIndex = id.indexOf(":");
    const source = separatorIndex > 0 ? id.slice(0, separatorIndex) : "";
    const filename = separatorIndex > 0 ? id.slice(separatorIndex + 1) : "";
    const allowedSources = new Set([
      "upload",
      PUBLIC_IMAGE_BUCKET,
      PRIVATE_MEDIA_BUCKET,
    ]);

    if (!source || !filename || path.basename(filename) !== filename || !allowedSources.has(source)) {
      return res.status(400).json({ error: "Некорректный идентификатор медиафайла" });
    }

    const usage = getUsage(filename, filename);
    if (usage.length > 0) {
      return res.status(409).json({
        error: "Файл используется в воронке. Сначала удалите его из этапов воронки.",
        usedIn: usage,
      });
    }

    try {
      if (source === PUBLIC_IMAGE_BUCKET || source === PRIVATE_MEDIA_BUCKET) {
        const supabase = ctx.getSupabase();
        if (!ctx.getUseSupabase() || !supabase) {
          return res.status(503).json({ error: "Облачное хранилище сейчас недоступно" });
        }

        const { error } = await supabase.storage.from(source).remove([filename]);
        if (error) throw error;
      }

      const localPath = path.join(ctx.mediaDir, filename);
      await fs.promises.unlink(localPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });

      delete mediaManifest[filename];
      saveMediaManifest();
      return res.json({ deleted: true, id });
    } catch (error: any) {
      console.error("Failed to delete media:", error?.message || error);
      return res.status(500).json({ error: "Не удалось удалить медиафайл" });
    }
  });

  app.get("/api/admin/media/cache", (_req, res) => {
    res.json(ctx.getTgCache());
  });

  app.use("/images", express.static(ctx.imagesDir));
}
