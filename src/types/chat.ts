export interface ChatAttachment {
  uri: string;
  type: 'image' | 'document';
  name: string;
  mimeType: string;
  size?: number;
}

export interface PendingAttachment extends ChatAttachment {
  localUri: string;
}
