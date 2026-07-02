import * as fs from "fs/promises";
import * as path from "path";

import type {
  MessagingAttachment,
  MessagingEvent
} from "../../support-automation/buffer/typesMessaging.types";
import type {
  MatrixClientLike
} from "./typesMatrixChannel.types";

const DEFAULT_MATRIX_ATTACHMENT_DIRECTORY = path.resolve(
  "data/attachments/matrix"
);

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getExtensionFromFilename(filename: string | undefined): string {
  if (!filename) {
    return "";
  }

  const extension = path.extname(filename);

  return extension.length > 0 ? extension : "";
}

function buildAttachmentPath(params: {
  directoryPath: string;
  messageId: string;
  attachment: MessagingAttachment;
}): string {
  const extension = getExtensionFromFilename(params.attachment.filename);
  const basename = sanitizeFilePart(
    `${params.messageId}_${params.attachment.id}`
  );

  return path.join(params.directoryPath, `${basename}${extension}`);
}

async function downloadMatrixAttachment(params: {
  client: MatrixClientLike;
  messagingEvent: MessagingEvent;
  attachment: MessagingAttachment;
  directoryPath: string;
}): Promise<MessagingAttachment> {
  if (!params.attachment.matrixMxcUrl) {
    return params.attachment;
  }

  if (typeof params.client.downloadContent !== "function") {
    console.warn({
      eventName: "matrix.attachment.download_not_implemented",
      roomId: params.messagingEvent.roomId,
      messageId: params.messagingEvent.messageId,
      attachmentId: params.attachment.id
    });
    return params.attachment;
  }

  try {
    const downloadedContent = await params.client.downloadContent(
      params.attachment.matrixMxcUrl,
      true
    );
    const localPath = buildAttachmentPath({
      directoryPath: params.directoryPath,
      messageId: params.messagingEvent.messageId,
      attachment: params.attachment
    });

    await fs.mkdir(path.dirname(localPath), {
      recursive: true
    });
    await fs.writeFile(localPath, downloadedContent.data);

    const httpUrl =
      typeof params.client.mxcToHttp === "function"
        ? params.client.mxcToHttp(params.attachment.matrixMxcUrl)
        : undefined;

    console.log({
      eventName: "matrix.attachment.downloaded",
      roomId: params.messagingEvent.roomId,
      messageId: params.messagingEvent.messageId,
      attachmentId: params.attachment.id,
      path: localPath,
      contentType: downloadedContent.contentType,
      sizeBytes: downloadedContent.data.byteLength
    });

    return {
      ...params.attachment,
      path: localPath,
      ...(httpUrl ? { accessUrl: httpUrl, url: httpUrl } : {}),
      mimeType: params.attachment.mimeType ?? downloadedContent.contentType,
      sizeInBytes:
        params.attachment.sizeInBytes ?? downloadedContent.data.byteLength,
      sizeBytes:
        params.attachment.sizeBytes ??
        params.attachment.sizeInBytes ??
        downloadedContent.data.byteLength
    };
  } catch (error) {
    console.error({
      eventName: "matrix.attachment.download_failed",
      roomId: params.messagingEvent.roomId,
      messageId: params.messagingEvent.messageId,
      attachmentId: params.attachment.id,
      error: error instanceof Error ? error.message : "unknown_error"
    });

    return params.attachment;
  }
}

async function downloadMatrixEventAttachments(params: {
  client: MatrixClientLike;
  messagingEvent: MessagingEvent;
  directoryPath?: string;
}): Promise<MessagingEvent> {
  if (
    params.messagingEvent.attachments === undefined ||
    params.messagingEvent.attachments.length === 0
  ) {
    return params.messagingEvent;
  }

  const directoryPath =
    params.directoryPath ?? DEFAULT_MATRIX_ATTACHMENT_DIRECTORY;
  const attachments = await Promise.all(
    params.messagingEvent.attachments.map((attachment) => {
      return downloadMatrixAttachment({
        client: params.client,
        messagingEvent: params.messagingEvent,
        attachment,
        directoryPath
      });
    })
  );

  return {
    ...params.messagingEvent,
    attachments
  };
}

export {
  downloadMatrixEventAttachments
};
