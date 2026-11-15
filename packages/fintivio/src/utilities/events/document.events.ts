import { createEvent } from './create-event';
import { Document, LogCategory, LogLevel } from '../../schemas';
import { BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all document-related events
 */
interface BaseDocumentEventData extends BaseEventData {
  // The ID of the document this event is about
  documentId: string;
  // The ID of the user who triggered the event
  userId: string;
  // The tenant this event belongs to
  tenantId: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Document lifecycle events
 */
export interface DocumentLifecycleEventData extends BaseDocumentEventData {
  // The name of the document
  name: string;
  // The type/category of the document
  type: string;
  // Optional size of the document in bytes
  size?: number;
  // Optional tags for the document
  tags?: string[];
}

/**
 * Document signing events
 */
export interface DocumentSigningEventData extends BaseDocumentEventData {
  // The IDs of the recipients
  recipients: string[];
  // Optional expiration date for the signing request
  expiresAt?: string;
  // Optional message for the signers
  message?: string;
}

/**
 * Document access events (view, download, etc.)
 */
export interface DocumentAccessEventData extends BaseDocumentEventData {
  // The ID of the user who accessed the document
  accessedBy: string;
  // The IP address of the user
  ipAddress?: string;
  // The user agent of the client
  userAgent?: string;
}

/**
 * Configuration for document event listeners
 */
export interface DocumentListenerConfig<T extends BaseDocumentEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType' | 'entityId'> {
  // Filter by document ID
  documentId?: string | string[] | RegExp;
  // Filter by document type
  documentType?: string | string[] | RegExp;
  // Filter by user ID
  userId?: string | string[];
  // Filter by tenant ID
  tenantId?: string | string[];
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a document event with proper entity references
 */
function createDocumentEvent<T extends BaseDocumentEventData>(
  name: string,
  category: LogCategory,
  level: LogLevel,
  getEntityId: (data: Document) => { documentId: string } | undefined = (data) => ({ documentId: data.id! })
) {
  return createEvent<Document, ListenerConfig<T>, { documentId: string }>({
    name,
    category,
    level,
    source: 'document-service',
    getEntityRef: getEntityId,
  });
}

export const DocumentEvents = {
  // Document Lifecycle
  DocumentCreated: createDocumentEvent<DocumentLifecycleEventData>(
    'document.created',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  DocumentUpdated: createDocumentEvent<DocumentLifecycleEventData & { changes: Record<string, unknown> }>(
    'document.updated',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  DocumentDeleted: createDocumentEvent<DocumentLifecycleEventData>(
    'document.deleted',
    'form' as LogCategory,
    'warning' as LogLevel
  ),
  
  DocumentViewed: createDocumentEvent<DocumentAccessEventData>(
    'document.viewed',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  DocumentDownloaded: createDocumentEvent<DocumentAccessEventData & { format: string }>(
    'document.downloaded',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  // Document Signing Events
  SigningRequested: createDocumentEvent<DocumentSigningEventData>(
    'document.signing.requested',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  SigningCompleted: createDocumentEvent<DocumentSigningEventData & { 
    status: 'signed' | 'declined' | 'expired'; 
    signedBy?: string[];
  }>(
    'document.signing.completed',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  SigningReminderSent: createDocumentEvent<DocumentSigningEventData & { 
    reminderType: 'first' | 'follow_up' | 'final';
  }>(
    'document.signing.reminder_sent',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  // Document Versioning Events
  NewVersionCreated: createDocumentEvent<DocumentLifecycleEventData & { 
    version: string; 
    previousVersion?: string;
  }>(
    'document.version.created',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  VersionRestored: createDocumentEvent<DocumentAccessEventData & { 
    version: string;
  }>(
    'document.version.restored',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  // Document Sharing Events
  Shared: createDocumentEvent<DocumentAccessEventData & { 
    sharedWith: string[]; 
    permission: 'view' | 'comment' | 'edit';
    expiresAt?: string;
  }>(
    'document.shared',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  ShareRevoked: createDocumentEvent<DocumentAccessEventData & { 
    userIds: string[]; 
  }>(
    'document.share_revoked',
    'form' as LogCategory,
    'warning' as LogLevel
  ),
  
  // Document Comment Events
  CommentAdded: createDocumentEvent<DocumentAccessEventData & { 
    commentId: string; 
    content: string;
  }>(
    'document.comment.added',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  CommentResolved: createDocumentEvent<DocumentAccessEventData & { 
    commentId: string; 
  }>(
    'document.comment.resolved',
    'form' as LogCategory,
    'info' as LogLevel
  ),
  
  CommentDeleted: createDocumentEvent<DocumentAccessEventData & { 
    commentId: string; 
  }>(
    'document.comment.deleted',
    'form' as LogCategory,
    'warning' as LogLevel
  ),
};
