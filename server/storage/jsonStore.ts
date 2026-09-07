import fs from "fs";

export function loadJSON(filePath: string, fallback: any = {}): any {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`Error loading ${filePath}:`, e);
  }
  return fallback;
}

export function saveJSON(filePath: string, data: any) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, filePath);
  } catch (e) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {}
    console.error(`Error saving ${filePath}:`, e);
    throw e;
  }
}
