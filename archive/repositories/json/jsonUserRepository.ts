import * as path from "path";

import { JsonFileStore } from "./jsonFileStore";

import type {
  JsonUser
} from "./typesJsonRepositories.types";

class JsonUserRepository {
  private readonly store: JsonFileStore<JsonUser>;

  constructor(filePath = path.resolve("data/users.json")) {
    this.store = new JsonFileStore<JsonUser>(filePath);
  }

  async findById(userId: string): Promise<JsonUser | undefined> {
    const users = await this.store.readAll();

    return users.find((user) => {
      return user.userId === userId;
    });
  }

  async upsert(user: JsonUser): Promise<JsonUser> {
    const users = await this.store.readAll();
    const existingUserIndex = users.findIndex((candidate) => {
      return candidate.userId === user.userId;
    });

    if (existingUserIndex === -1) {
      await this.store.writeAll([...users, user]);
      return user;
    }

    const updatedUsers = [...users];
    updatedUsers[existingUserIndex] = user;
    await this.store.writeAll(updatedUsers);

    return user;
  }

  async list(): Promise<JsonUser[]> {
    return this.store.readAll();
  }
}

export {
  JsonUserRepository
};
