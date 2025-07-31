import { z } from "zod";
import { get_gmail_sdk } from "../utils";

export const schema = z.object({
  access_token: z.string().describe("OAuth2 access token"),
  query: z
    .string()
    .describe("Gmail search query (e.g., 'from:example@gmail.com')"),
  maxResults: z
    .number()
    .optional()
    .describe("Maximum number of results to return"),
});

export async function emailList(args: unknown) {
  const validatedArgs = schema.parse(args);
  const gmail = await get_gmail_sdk(validatedArgs.access_token);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: validatedArgs.query,
    maxResults: validatedArgs.maxResults || 10,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to retrieve emails: ${response.statusText}`);
  }

  const messages = response.data.messages ?? [];

  return {
    structuredContent: messages,
    content: {
      type: "text",
      text: JSON.stringify(messages),
    },
  };
}
