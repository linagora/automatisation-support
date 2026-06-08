import * as path from "path";

import { JsonFileStore } from "./jsonFileStore";

import type {
  JsonStoredMessage
} from "./typesJsonRepositories.types";

class JsonMessageRepository {
  private readonly store: JsonFileStore<JsonStoredMessage>;

  constructor(filePath = path.resolve("data/messages.json")) {
    this.store = new JsonFileStore<JsonStoredMessage>(filePath);
  }

  async append(message: JsonStoredMessage): Promise<JsonStoredMessage> {
    const messages = await this.store.readAll();

    await this.store.writeAll([...messages, message]);

    return message;
  }

  async findByRoomId(roomId: string): Promise<JsonStoredMessage[]> {
    const messages = await this.store.readAll();

    return messages.filter((message) => {
      return message.roomId === roomId;
    });
  }

  async findByTicketId(ticketId: string): Promise<JsonStoredMessage[]> {
    const messages = await this.store.readAll();

    return messages.filter((message) => {
      return message.ticketId === ticketId;
    });
  }

  async findByMessageId(
    messageId: string
  ): Promise<JsonStoredMessage | undefined> {
    const messages = await this.store.readAll();

    return messages.find((message) => {
      return message.messageId === messageId;
    });
  }

  async list(): Promise<JsonStoredMessage[]> {
    return this.store.readAll();
  }
}

export {
  JsonMessageRepository
};
