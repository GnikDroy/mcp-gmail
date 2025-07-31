import { z } from "zod";
import { extractEmailContent, get_gmail_sdk } from "../utils.js";

export const schema = z.object({
  access_token: z.string().describe("OAuth2 access token"),
  messageId: z.string().describe("ID of the email message to retrieve"),
});

function processAttachmentParts(
  part: GmailMessagePart,
  path: string = ""
): EmailAttachment[] {
  const attachments: EmailAttachment[] = [];
  if (part.body && part.body.attachmentId) {
    const filename = part.filename || `attachment-${part.body.attachmentId}`;
    attachments.push({
      id: part.body.attachmentId,
      filename: filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body.size || 0,
    });
  }

  if (part.parts) {
    part.parts.forEach((subpart: GmailMessagePart) => {
      let result = processAttachmentParts(subpart, `${path}/parts`);
      attachments.push(...result);
    });
  }
  return attachments;
}

export async function emailGet(args: any) {
  const validatedArgs = schema.parse(args);

  const gmail = await get_gmail_sdk(validatedArgs.access_token);

  const response = await gmail.users.messages.get({
    userId: "me",
    id: validatedArgs.messageId,
    format: "full",
  });

  if (response.status !== 200) {
    throw new Error(`Failed to retrieve email: ${response.statusText}`);
  }

  const headers = response.data.payload?.headers || [];
  const subject =
    headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
  const from =
    headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
  const to = headers.find((h) => h.name?.toLowerCase() === "to")?.value || "";
  const date =
    headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
  const threadId = response.data.threadId || "";

  // Extract email content using the recursive function
  const { text, html } = extractEmailContent(
    (response.data.payload as GmailMessagePart) || {}
  );

  // Use plain text content if available, otherwise use HTML content
  // (optionally, you could implement HTML-to-text conversion here)
  let body = text || html || "";

  // If we only have HTML content, add a note for the user
  const contentTypeNote =
    !text && html
      ? "[Note: This email is HTML-formatted. Plain text version not available.]\n\n"
      : "";

  // Get attachment information
  let attachments: EmailAttachment[] = [];
  if (response.data.payload) {
    attachments = processAttachmentParts(
      response.data.payload as GmailMessagePart
    );
  }

  // Add attachment info to output if any are present
  const attachmentInfo =
    attachments.length > 0
      ? `\n\nAttachments (${attachments.length}):\n` +
        attachments
          .map(
            (a) =>
              `- ${a.filename} (${a.mimeType}, ${Math.round(
                a.size / 1024
              )} KB, ID: ${a.id})`
          )
          .join("\n")
      : "";

  return {
    structuredContent: response.data,
    content: [
      // OpenAI agents SDK doesn't yet support structured content directly,
      // so we return as serialized JSON. (Out of official spec for now)
      // {
      //   type: "text",
      //   text: `Thread ID: ${threadId}\nSubject: ${subject}\nFrom: ${from}\nTo: ${to}\nDate: ${date}\n\n${contentTypeNote}${body}${attachmentInfo}`,
      // },
      {
        type: "text",
        text: JSON.stringify(response.data),
      },
    ],
  };
}
