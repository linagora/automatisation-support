import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

class JsonFileStore<T extends object> {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async readAll(): Promise<T[]> {
    await this.ensureFile();

    const rawContent = await fs.readFile(this.filePath, "utf8");
    const parsedContent: unknown = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      throw new Error(`JSON store must contain an array: ${this.filePath}`);
    }

    return parsedContent as T[];
  }

  async writeAll(items: T[]): Promise<T[]> {
    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true
    });

    const temporaryFilePath = this.buildTemporaryFilePath();
    const serializedItems = `${JSON.stringify(items, null, 2)}\n`;

    await fs.writeFile(temporaryFilePath, serializedItems, "utf8");
    await fs.rename(temporaryFilePath, this.filePath);

    return items;
  }

  private async ensureFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true
    });

    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeAll([]);
    }
  }

  private buildTemporaryFilePath(): string {
    const directory = path.dirname(this.filePath);
    const basename = path.basename(this.filePath);

    return path.join(directory, `.${basename}.${process.pid}.${randomUUID()}.tmp`);
  }
}

export {
  JsonFileStore
};
