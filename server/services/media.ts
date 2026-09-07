import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import multer from "multer";

const execPromise = promisify(exec);

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp4", ".mov", ".avi", ".webm", ".mkv", ".pdf",
]);

export function ensureMediaDirectories(...dirs: string[]) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function createMediaUpload(mediaDir: string) {
  const mediaStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp4';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    }
  });

  return multer({
    storage: mediaStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MEDIA_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Неподдерживаемый формат файла'));
      }
    }
  });
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export async function validateUploadedMedia(filePath: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  if (!ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
    throw new Error("Неподдерживаемый формат файла");
  }

  const handle = await fs.promises.open(filePath, "r");
  const header = Buffer.alloc(32);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const ascii = header.toString("ascii");
  const detected = startsWith(header, [0xff, 0xd8, 0xff]) ? "image/jpeg"
    : startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? "image/png"
      : ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a") ? "image/gif"
        : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP" ? "image/webp"
          : ascii.startsWith("%PDF-") ? "application/pdf"
            : ascii.startsWith("RIFF") && ascii.slice(8, 11) === "AVI" ? "video/x-msvideo"
              : ascii.slice(4, 8) === "ftyp" ? (extension === ".mov" ? "video/quicktime" : "video/mp4")
                : startsWith(header, [0x1a, 0x45, 0xdf, 0xa3])
                  ? (extension === ".mkv" ? "video/x-matroska" : "video/webm")
                  : "";

  const expectedExtensions: Record<string, Set<string>> = {
    "image/jpeg": new Set([".jpg", ".jpeg"]),
    "image/png": new Set([".png"]),
    "image/gif": new Set([".gif"]),
    "image/webp": new Set([".webp"]),
    "application/pdf": new Set([".pdf"]),
    "video/mp4": new Set([".mp4"]),
    "video/quicktime": new Set([".mov"]),
    "video/x-msvideo": new Set([".avi"]),
    "video/webm": new Set([".webm"]),
    "video/x-matroska": new Set([".mkv"]),
  };

  if (!detected || !expectedExtensions[detected]?.has(extension)) {
    throw new Error("Содержимое файла не соответствует его расширению");
  }

  return detected;
}

async function hasAudioStream(filePath: string): Promise<boolean> {
  try {
    const cmd = `ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout } = await execPromise(cmd);
    return stdout.trim().length > 0;
  } catch (e) {
    console.error("Error checking audio stream with ffprobe:", e);
    return false;
  }
}

export async function processVideoNoteToSquare(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    const hasAudio = await hasAudioStream(inputPath);
    console.log(`📹 Processing video note: hasAudio=${hasAudio}`);

    let cmd: string;
    if (hasAudio) {
      cmd = `ffmpeg -y -i "${inputPath}" -vf "crop='min(iw,ih)':'min(iw,ih)',scale=480:480" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -r 30 -c:a aac -ac 1 -b:a 64k -t 60 "${outputPath}"`;
    } else {
      cmd = `ffmpeg -y -i "${inputPath}" -f lavfi -i anullsrc -filter_complex "[0:v]crop='min(iw,ih)':'min(iw,ih)',scale=480:480[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -r 30 -c:a aac -ac 1 -b:a 64k -shortest -t 60 "${outputPath}"`;
    }

    console.log("📹 Executing ffmpeg command:", cmd);
    await execPromise(cmd);
    console.log("✅ ffmpeg processing completed successfully.");
    return true;
  } catch (e) {
    console.error("❌ ffmpeg processing failed:", e);
    return false;
  }
}
