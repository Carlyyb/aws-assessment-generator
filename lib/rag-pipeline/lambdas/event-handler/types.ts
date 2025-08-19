// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Local type definitions to replace missing @project-lakechain packages
 */

export enum EventType {
  DOCUMENT_CREATED = 'DOCUMENT_CREATED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED'
}

export interface DocumentMetadata {
  [key: string]: any;
}

export interface DocumentData {
  bucket: string;
  key: string;
  etag: string;
  url?: string;
  metadata?: DocumentMetadata;
  contentType?: string;
  contentLength?: number;
}

export class Document {
  private data: DocumentData;
  private documentMetadata: DocumentMetadata;

  constructor(data: DocumentData, metadata: DocumentMetadata = {}) {
    this.data = data;
    this.documentMetadata = metadata;
  }

  static Builder = class {
    public data: Partial<DocumentData> = {};
    public documentMetadata: DocumentMetadata = {};

    url(url: string) {
      this.data.url = url;
      return this;
    }

    withUrl(url: string) {
      this.data.url = url;
      return this;
    }

    withEtag(etag: string) {
      this.data.etag = etag;
      return this;
    }

    withSize(size: number) {
      this.data.contentLength = size;
      return this;
    }

    withType(contentType: string) {
      this.data.contentType = contentType;
      return this;
    }

    metadata(metadata: DocumentMetadata) {
      this.documentMetadata = { ...this.documentMetadata, ...metadata };
      return this;
    }

    contentType(contentType: string) {
      this.data.contentType = contentType;
      return this;
    }

    contentLength(contentLength: number) {
      this.data.contentLength = contentLength;
      return this;
    }

    build(): Document {
      return new Document(this.data as DocumentData, this.documentMetadata);
    }
  };

  getData(): DocumentData {
    return this.data;
  }

  getMetadata(): DocumentMetadata {
    return this.documentMetadata;
  }
}

export interface S3DocumentDescriptorData {
  bucket: string;
  key: string;
  etag?: string;
}

export class S3DocumentDescriptor {
  private data: S3DocumentDescriptorData;

  constructor(data: S3DocumentDescriptorData) {
    this.data = data;
  }

  async resolve(): Promise<string> {
    return `s3://${this.data.bucket}/${this.data.key}`;
  }

  asUri(): string {
    return `s3://${this.data.bucket}/${this.data.key}`;
  }

  getBucket(): string {
    return this.data.bucket;
  }

  getKey(): string {
    return this.data.key;
  }

  getEtag(): string | undefined {
    return this.data.etag;
  }
}
