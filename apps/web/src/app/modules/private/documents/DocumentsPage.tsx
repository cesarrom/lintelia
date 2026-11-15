import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, Filter, Eye, Edit, MoreVertical } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PdfViewerDialog from './components/PdfViewerDialog';
import CreateTemplateDialog from './components/CreateTemplateDialog';

// Types
interface Document {
  id: string;
  name: string;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Completed' | 'Requires Action';
  assignee: string;
  targetUser: string;
  createdAt: string;
  updatedAt: string;
  templateId?: string;
  url?: string; // Added for PDF viewing
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Mock Data
const mockDocuments: Document[] = [
  {
    id: 'doc_1',
    name: 'NDA Agreement',
    status: 'Sent',
    assignee: 'legal@example.com',
    targetUser: 'client_a@example.com',
    createdAt: '2024-05-20T10:00:00Z',
    updatedAt: '2024-05-20T10:00:00Z',
    templateId: 'tpl_nda_v1',
    url: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf' // Placeholder PDF
  },
  {
    id: 'doc_2',
    name: 'Service Contract',
    status: 'Completed',
    assignee: 'sales@example.com',
    targetUser: 'client_b@example.com',
    createdAt: '2024-05-18T14:30:00Z',
    updatedAt: '2024-05-19T09:15:00Z',
    url: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf' // Placeholder PDF
  },
  {
    id: 'doc_3',
    name: 'Employee Handbook Update',
    status: 'Draft',
    assignee: 'hr@example.com',
    targetUser: 'all_employees@example.com',
    createdAt: '2024-05-22T11:00:00Z',
    updatedAt: '2024-05-22T11:00:00Z',
    templateId: 'tpl_handbook_v3',
    url: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf' // Placeholder PDF
  },
];

const mockTemplates: DocumentTemplate[] = [
  { id: 'tpl_nda_v1', name: 'Standard NDA', description: 'Non-Disclosure Agreement for new clients.', createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-01-15T00:00:00Z' },
  { id: 'tpl_handbook_v3', name: 'Employee Handbook V3', description: 'Latest version of the company employee handbook.', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-10T00:00:00Z' },
];

const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [templates, setTemplates] = useState<DocumentTemplate[]>(mockTemplates);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isSendDocumentOpen, setIsSendDocumentOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [selectedDocumentForViewing, setSelectedDocumentForViewing] = useState<Document | null>(null); // Changed state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const handleSendDocument = () => {
    // For now, just log and close. Later, implement sending logic.
    console.log('Sending document...');
    setIsSendDocumentOpen(false);
  };

  const openPdfViewer = (doc: Document) => { // Changed signature
    setSelectedDocumentForViewing(doc);
    setPageNumber(1); // Reset to first page
    setNumPages(null); // Reset numPages
    setIsPdfViewerOpen(true);
  };

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
    setNumPages(nextNumPages);
  };

  const goToPrevPage = () => setPageNumber(Math.max(1, pageNumber - 1));
  const goToNextPage = () => setPageNumber(Math.min(numPages || pageNumber, pageNumber + 1));

  const handleEditDocument = (documentId: string) => {
    console.log(`Editing document: ${documentId}`);
    // TODO: Implement actual edit logic (e.g., open edit dialog)
    setIsPdfViewerOpen(false); // Close viewer to open edit dialog, for example
  };

  const handleTemplateSave = (template: any) => {
    console.log('Template saved:', template);
    // TODO: Implement actual template save logic (e.g., API call to store template details)
    setIsCreateTemplateOpen(false); // Close the dialog after save
  };

  const handleSendReminder = (documentId: string) => {
    console.log(`Sending reminder for document: ${documentId}`);
    // TODO: Implement actual reminder logic (e.g., API call)
  };

  const handleRequestCorrection = (documentId: string) => {
    console.log(`Requesting correction for document: ${documentId}`);
    // TODO: Implement actual correction request logic (e.g., open dialog, API call)
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.targetUser.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PdfViewerDialog
        isOpen={isPdfViewerOpen}
        onOpenChange={setIsPdfViewerOpen}
        document={selectedDocumentForViewing} // Changed prop
        pageNumber={pageNumber}
        numPages={numPages}
        onDocumentLoadSuccess={onDocumentLoadSuccess}
        goToPrevPage={goToPrevPage}
        goToNextPage={goToNextPage}
        onEdit={handleEditDocument}
        onSendReminder={handleSendReminder}
        onRequestCorrection={handleRequestCorrection}
      />
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Documents Management</h1>
        <p className="text-muted-foreground">Manage, send, and track your documents.</p>
      </header>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          <CreateTemplateDialog 
            isOpen={isCreateTemplateOpen} 
            onOpenChange={setIsCreateTemplateOpen} 
            onTemplateSave={handleTemplateSave} 
          />

          <Dialog open={isSendDocumentOpen} onOpenChange={setIsSendDocumentOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="mr-2 h-4 w-4" /> Send Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Document</DialogTitle>
                <DialogDescription>
                  Select a template and recipients to send a document.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p>Document sending form would go here (select template, users, etc.).</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSendDocumentOpen(false)}>Cancel</Button>
                <Button onClick={handleSendDocument}>Send</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="search"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs w-full sm:w-auto"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4 inline-block" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="requires action">Requires Action</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Document List</h2>
        {filteredDocuments.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full 
                          ${doc.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            doc.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            doc.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                            doc.status === 'Viewed' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'}`}
                      >
                        {doc.status}
                      </span>
                    </TableCell>
                    <TableCell>{doc.assignee}</TableCell>
                    <TableCell>{doc.targetUser}</TableCell>
                    <TableCell>{new Date(doc.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {/* Actions: View, Edit, More */}
                      <Button variant="ghost" size="icon" title="View Document" onClick={() => doc.url && openPdfViewer(doc)} disabled={!doc.url}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit Document">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="More Actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSendReminder(doc.id)}>
                            Send Reminder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRequestCorrection(doc.id)}>
                            Request Correction
                          </DropdownMenuItem>
                          {/* Add more actions here if needed */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No documents found.</p>
        )}
      </div>
    </div>
    </>
  );
};

export default DocumentsPage;
