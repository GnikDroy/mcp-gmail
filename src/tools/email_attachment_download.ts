import { z } from "zod";
import { get_gmail_sdk } from "../utils.js";

export const schema = z.object({
  access_token: z.string().describe("OAuth2 access token"),
  messageId: z
    .string()
    .describe("ID of the email message containing the attachment"),
  attachmentId: z.string().describe("ID of the attachment to download"),
});

export async function emailAttachmentDownload(args: unknown) {
  const validatedArgs = schema.parse(args);

  const gmail = await get_gmail_sdk(validatedArgs.access_token);

  // Get the attachment data from Gmail API
  const attachmentResponse = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: validatedArgs.messageId,
    id: validatedArgs.attachmentId,
  });

  if (attachmentResponse.status !== 200) {
    throw new Error(
      `Failed to download attachment: ${attachmentResponse.statusText}`
    );
  }

  if (!attachmentResponse.data.data) {
    throw new Error("No attachment data received");
  }

  // Decode the base64 data
  const data = attachmentResponse.data.data;
  const buffer = Buffer.from(data, "base64url");

  return {
    structuredContent: buffer.toString(),
    content: [
      {
        type: "text",
        text: buffer.toString(),
      },
    ],
  };
}
