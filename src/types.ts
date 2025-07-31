// Type definitions for Gmail API responses
interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{
    name: string;
    value: string;
  }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface EmailContent {
  text: string;
  html: string;
}
