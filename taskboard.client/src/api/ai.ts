import { api } from "./client";

export type AiChatMessage = { role: "user" | "assistant"; text: string };

type AiChatResponse = { reply: string };

export const aiApi = {
  /** 使い方ガイドに会話履歴を送り、応答テキストを受け取る。 */
  chat: (messages: AiChatMessage[]) =>
    api
      .post<AiChatResponse>("/ai/chat", { messages })
      .then((res) => res.reply),
};
