import { z } from "zod";
import {
  createEmailMessage,
  createEmailWithNodemailer,
  encodeEmail,
  get_gmail_sdk,
} from "../utils.js";

export const schema = z.object({
  access_token: z.string().describe("OAuth2 access token"),
  to: z.array(z.string()).describe("List of recipient email addresses"),
  subject: z.string().describe("Email subject"),
  body: z
    .string()
    .describe(
      "Email body content (used for text/plain or when htmlBody not provided)"
    ),
  htmlBody: z.string().optional().describe("HTML version of the email body"),
  mimeType: z
    .enum(["text/plain", "text/html", "multipart/alternative"])
    .optional()
    .default("text/plain")
    .describe("Email content type"),
  cc: z.array(z.string()).optional().describe("List of CC recipients"),
  bcc: z.array(z.string()).optional().describe("List of BCC recipients"),
  threadId: z.string().optional().describe("Thread ID to reply to"),
  inReplyTo: z.string().optional().describe("Message ID being replied to"),
  attachments: z
    .array(z.string())
    .optional()
    .describe("List of file paths to attach to the email"),
});

export async function emailDraft(args: unknown) {
  const validatedArgs = schema.parse(args);

  const hasAttachments =
    validatedArgs.attachments !== undefined &&
    validatedArgs.attachments.length > 0;

  let message = hasAttachments
    ? await createEmailWithNodemailer(validatedArgs)
    : createEmailMessage(validatedArgs);

  const encodedMessage = encodeEmail(message);

  let gmail = await get_gmail_sdk(validatedArgs.access_token);

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encodedMessage,
        ...(validatedArgs.threadId && {
          threadId: validatedArgs.threadId,
        }),
      },
    },
  });

  if (response.status !== 200) {
    throw new Error(`Failed to create draft: ${response.statusText}`);
  }

  return {
    content: [
      {
        type: "text",
        text: `Email draft created successfully with ID: ${response.data.id}`,
      },
    ],
  };
}
