import {HttpSupportRagClient} from "./httpSupportRagClient";

import type {SupportRagClient} from "./supportRagClient";

function createDefaultSupportRagClient(): SupportRagClient {
  const baseUrl = process.env.SUPPORT_RAG_API_URL;
  const apiKey = process.env.SUPPORT_RAG_API_KEY;
  const model = process.env.SUPPORT_RAG_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("support_rag_client_missing_env");
  }

  return new HttpSupportRagClient({
    baseUrl,
    apiKey,
    model
  });
}

export {
  createDefaultSupportRagClient
};
