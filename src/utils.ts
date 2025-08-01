import fs from "fs";
import path from "path";

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";

export function log(msg: string) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const logPath = path.resolve(dir, "server.log");
  fs.appendFileSync(logPath, msg);
}

export async function get_gmail_sdk(access_token: string) {
  let oauth2Client: OAuth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: access_token });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Helper function to encode email headers containing non-ASCII characters
 * according to RFC 2047 MIME specification
 */
function encodeEmailHeader(text: string): string {
  // Only encode if the text contains non-ASCII characters
  if (/[^\x00-\x7F]/.test(text)) {
    // Use MIME Words encoding (RFC 2047)
    return "=?UTF-8?B?" + Buffer.from(text).toString("base64") + "?=";
  }
  return text;
}

export function encodeEmail(text: string): string {
  // Encode the text to base64url format
  return Buffer.from(text)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function createEmailMessage(validatedArgs: any): string {
  const encodedSubject = encodeEmailHeader(validatedArgs.subject);
  // Determine content type based on available content and explicit mimeType
  let mimeType = validatedArgs.mimeType || "text/plain";

  // If htmlBody is provided and mimeType isn't explicitly set to text/plain,
  // use multipart/alternative to include both versions
  if (validatedArgs.htmlBody && mimeType !== "text/plain") {
    mimeType = "multipart/alternative";
  }

  // Generate a random boundary string for multipart messages
  const boundary = `----=_NextPart_${Math.random().toString(36).substring(2)}`;

  // Validate email addresses
  (validatedArgs.to as string[]).forEach((email) => {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  });

  // Common email headers
  const emailParts = [
    "From: me",
    `To: ${validatedArgs.to.join(", ")}`,
    validatedArgs.cc ? `Cc: ${validatedArgs.cc.join(", ")}` : "",
    validatedArgs.bcc ? `Bcc: ${validatedArgs.bcc.join(", ")}` : "",
    `Subject: ${encodedSubject}`,
    // Add thread-related headers if specified
    validatedArgs.inReplyTo ? `In-Reply-To: ${validatedArgs.inReplyTo}` : "",
    validatedArgs.inReplyTo ? `References: ${validatedArgs.inReplyTo}` : "",
    "MIME-Version: 1.0",
  ].filter(Boolean);

  // Construct the email based on the content type
  if (mimeType === "multipart/alternative") {
    // Multipart email with both plain text and HTML
    emailParts.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    );
    emailParts.push("");

    // Plain text part
    emailParts.push(`--${boundary}`);
    emailParts.push("Content-Type: text/plain; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(validatedArgs.body);
    emailParts.push("");

    // HTML part
    emailParts.push(`--${boundary}`);
    emailParts.push("Content-Type: text/html; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(validatedArgs.htmlBody || validatedArgs.body); // Use body as fallback
    emailParts.push("");

    // Close the boundary
    emailParts.push(`--${boundary}--`);
  } else if (mimeType === "text/html") {
    // HTML-only email
    emailParts.push("Content-Type: text/html; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(validatedArgs.htmlBody || validatedArgs.body);
  } else {
    // Plain text email (default)
    emailParts.push("Content-Type: text/plain; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(validatedArgs.body);
  }

  return emailParts.join("\r\n");
}

export async function createEmailWithNodemailer(
  validatedArgs: any
): Promise<string> {
  // Validate email addresses
  (validatedArgs.to as string[]).forEach((email) => {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  });

  // Create a nodemailer transporter (we won't actually send, just generate the message)
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });

  // Prepare attachments for nodemailer
  const attachments = [];
  for (const filePath of validatedArgs.attachments) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const fileName = path.basename(filePath);

    attachments.push({
      filename: fileName,
      path: filePath,
    });
  }

  const mailOptions = {
    from: "me", // Gmail API will replace this with the authenticated user
    to: validatedArgs.to.join(", "),
    cc: validatedArgs.cc?.join(", "),
    bcc: validatedArgs.bcc?.join(", "),
    subject: validatedArgs.subject,
    text: validatedArgs.body,
    html: validatedArgs.htmlBody,
    attachments: attachments,
    inReplyTo: validatedArgs.inReplyTo,
    references: validatedArgs.inReplyTo,
  };

  // Generate the raw message
  const info = await transporter.sendMail(mailOptions);
  const rawMessage = info.message.toString();

  return rawMessage;
}

/**
 * Recursively extract email body content from MIME message parts
 * Handles complex email structures with nested parts
 */
export function extractEmailContent(
  messagePart: GmailMessagePart
): EmailContent {
  // Initialize containers for different content types
  let textContent = "";
  let htmlContent = "";

  // If the part has a body with data, process it based on MIME type
  if (messagePart.body && messagePart.body.data) {
    const content = Buffer.from(messagePart.body.data, "base64").toString(
      "utf8"
    );

    // Store content based on its MIME type
    if (messagePart.mimeType === "text/plain") {
      textContent = content;
    } else if (messagePart.mimeType === "text/html") {
      htmlContent = content;
    }
  }

  // If the part has nested parts, recursively process them
  if (messagePart.parts && messagePart.parts.length > 0) {
    for (const part of messagePart.parts) {
      const { text, html } = extractEmailContent(part);
      if (text) textContent += text;
      if (html) htmlContent += html;
    }
  }

  // Return both plain text and HTML content
  return { text: textContent, html: htmlContent };
}
