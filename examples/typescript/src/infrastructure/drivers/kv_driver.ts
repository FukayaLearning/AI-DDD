import fs from "node:fs/promises";
import path from "node:path";

export interface KeyValueStorageDriver {
  put(key: string, jsonPayload: string): Promise<void>;
  get(key: string): Promise<string>;
}

export class FileKvDriver implements KeyValueStorageDriver {
  private readonly dirPath: string;

  constructor(dirPath: string) {
    this.dirPath = dirPath;
  }

  async put(key: string, jsonPayload: string): Promise<void> {
    await fs.mkdir(this.dirPath, { recursive: true });
    await fs.writeFile(path.join(this.dirPath, `${key}.json`), jsonPayload, "utf8");
  }

  async get(key: string): Promise<string> {
    return fs.readFile(path.join(this.dirPath, `${key}.json`), "utf8");
  }
}
