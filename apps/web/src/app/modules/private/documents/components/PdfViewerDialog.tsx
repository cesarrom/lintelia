import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document as PdfDocument, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Assuming Document type is defined elsewhere and imported, or defined here if specific to this component
// For now, let's assume it will be imported from a shared types file or from the parent.
// If it's simple enough and only used here and in DocumentsPage, we might redefine it or pass specific props.
// For now, to keep it simple, I'll copy the Document interface here.
// TODO: Refactor Document type to a shared location if it becomes more widely used.
export interface Document {
  id: string;
  name: string;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Completed' | 'Requires Action';
  assignee: string;
  targetUser: string;
  createdAt: string;
  updatedAt: string;
  templateId?: string;
  url?: string;
}

export interface PdfViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  document: Document | null;
  pageNumber: number;
  numPages: number | null;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  onEdit: (documentId: string) => void;
  onSendReminder: (documentId: string) => void;
  onRequestCorrection: (documentId: string) => void;
}

const PdfViewerDialog: React.FC<PdfViewerDialogProps> = ({
  isOpen,
  onOpenChange,
  document,
  pageNumber,
  numPages,
  onDocumentLoadSuccess,
  goToPrevPage,
  goToNextPage,
  onEdit,
  onSendReminder,
  onRequestCorrection,
}) => {
  if (!document || !document.url) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex flex-row justify-between items-center">
          <DialogTitle>Document Preview: {document.name}</DialogTitle>
          {document && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(document.id)} title="Edit Document">
                <Edit className="h-4 w-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSendReminder(document.id)} title="Send Reminder">
                <Send className="h-4 w-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Reminder</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onRequestCorrection(document.id)} title="Request Correction">
                <Edit className="h-4 w-4 mr-1 sm:mr-2" /> {/* Using Edit icon as placeholder */}
                <span className="hidden sm:inline">Correction</span>
              </Button>
            </div>
          )}
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4 bg-gray-100 dark:bg-gray-800">
          <PdfDocument
            file={document.url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => console.error('Failed to load PDF:', error)}
            className="flex justify-center"
          >
            <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} />
          </PdfDocument>
        </div>
        {numPages && (
          <DialogFooter className="p-4 border-t flex justify-center items-center">
            <Button variant="outline" onClick={goToPrevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            <span className="mx-4 text-sm">
              Page {pageNumber} of {numPages}
            </span>
            <Button variant="outline" onClick={goToNextPage} disabled={pageNumber >= numPages}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerDialog;
