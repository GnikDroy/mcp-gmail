import { zodToJsonSchema } from "zod-to-json-schema";

import { emailSend, schema as SendEmailSchema } from "./email_send";
import { emailDraft, schema as DraftEmailSchema } from "./email_draft";
import { emailGet, schema as ReadEmailSchema } from "./email_get";
import { emailList, schema as ListEmailsSchema } from "./email_list";
import {
  schema as DownloadAttachmentSchema,
  emailAttachmentDownload,
} from "./email_attachment_download";

export let tools = [
  {
    name: "send_email",
    description: "Sends a new email",
    inputSchema: zodToJsonSchema(SendEmailSchema),
    handler: emailSend,
  },
  {
    name: "draft_email",
    description: "Draft a new email",
    inputSchema: zodToJsonSchema(DraftEmailSchema),
    handler: emailDraft,
  },
  {
    name: "read_email",
    description: "Retrieves the content of a specific email",
    inputSchema: zodToJsonSchema(ReadEmailSchema),
    handler: emailGet,
  },
  {
    name: "list_emails",
    description: "Lists emails while filtering using Gmail search syntax",
    inputSchema: zodToJsonSchema(ListEmailsSchema),
    handler: emailList,
  },
  {
    name: "download_attachment",
    description: "Downloads an email attachment to a specified location",
    inputSchema: zodToJsonSchema(DownloadAttachmentSchema),
    handler: emailAttachmentDownload,
  },
];
