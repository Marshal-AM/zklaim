const OPFS_ROOT = "zklaim";

async function getRootDir() {
  if (!navigator.storage?.getDirectory) {
    throw new Error("OPFS not supported in this browser");
  }
  return navigator.storage.getDirectory();
}

async function getFileHandle(name: string, create = false) {
  const root = await getRootDir();
  const dir = await root.getDirectoryHandle(OPFS_ROOT, { create: true });
  return dir.getFileHandle(name, { create });
}

export async function opfsReadJson<T>(name: string): Promise<T | null> {
  try {
    const handle = await getFileHandle(name);
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function opfsWriteJson(name: string, data: unknown): Promise<void> {
  const handle = await getFileHandle(name, true);
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function opfsDelete(name: string): Promise<void> {
  try {
    const root = await getRootDir();
    const dir = await root.getDirectoryHandle(OPFS_ROOT);
    await dir.removeEntry(name);
  } catch {
    // ignore missing
  }
}
