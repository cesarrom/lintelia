import React, { useState, useEffect } from 'react';
import { EmailTemplate, TemplateVariable, SendEmailPayload, EmailRecipient } from './types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose, // Added DialogClose for explicit close buttons
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, Send, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // For displaying variable counts or tags
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const initialTemplates: EmailTemplate[] = [
  {
    id: 'tmpl_1',
    name: 'Welcome Email',
    subject: 'Welcome to Our Platform, {{userName}}!',
    body: 'Hello {{userName}},\n\nWelcome! We are excited to have you.\n\nThanks,\nThe Team',
    variables: [{ name: 'userName' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_2',
    name: 'Password Reset Request',
    subject: 'Password Reset for {{userEmail}}',
    body: 'Hi there,\n\nA password reset was requested for your account ({{userEmail}}).\nClick this link to reset: {{resetLink}}\n\nIf you did not request this, please ignore this email.\n\nRegards,\nSupport',
    variables: [{ name: 'userEmail' }, { name: 'resetLink' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Utility to extract variables like {{variableName}}
const extractVariables = (body: string): TemplateVariable[] => {
  const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const matches = [...body.matchAll(regex)];
  const uniqueVariables = Array.from(new Set(matches.map(match => match[1])));
  return uniqueVariables.map(name => ({ name }));
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [isCreateEditDialogOpen, setIsCreateEditDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  const [currentTemplate, setCurrentTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplateData, setEditingTemplateData] = useState<Partial<EmailTemplate>>({});
  const [detectedVariablesInForm, setDetectedVariablesInForm] = useState<TemplateVariable[]>([]);
  
  const [sendEmailData, setSendEmailData] = useState<Partial<SendEmailPayload>>({ recipients: [], variableValues: {} });
  const [sendToEmails, setSendToEmails] = useState(''); // Comma-separated string

  // Update detected variables when body changes in form
  useEffect(() => {
    if (editingTemplateData.body) {
      setDetectedVariablesInForm(extractVariables(editingTemplateData.body));
    }
  }, [editingTemplateData.body]);

  const handleOpenCreateDialog = () => {
    setCurrentTemplate(null);
    setEditingTemplateData({ name: '', subject: '', body: '' });
    setDetectedVariablesInForm([]);
    setIsCreateEditDialogOpen(true);
  };

  const handleOpenEditDialog = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setEditingTemplateData({ ...template });
    setDetectedVariablesInForm(template.variables);
    setIsCreateEditDialogOpen(true);
  };

  const handleOpenViewDialog = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setIsViewDialogOpen(true);
  };

  const handleCreateEditFormChange = (field: keyof Pick<EmailTemplate, 'name' | 'subject' | 'body'>, value: string) => {
    setEditingTemplateData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveTemplate = () => {
    if (!editingTemplateData.name || !editingTemplateData.subject || !editingTemplateData.body) {
      alert('Name, Subject, and Body are required.'); // Basic validation
      return;
    }
    const finalVariables = extractVariables(editingTemplateData.body || '');

    if (currentTemplate) { // Editing existing
      const updatedTemplate: EmailTemplate = {
        ...currentTemplate,
        ...editingTemplateData,
        variables: finalVariables,
        updatedAt: new Date().toISOString(),
      } as EmailTemplate;
      setTemplates(prev => prev.map(t => t.id === currentTemplate.id ? updatedTemplate : t));
    } else { // Creating new
      const newTemplate: EmailTemplate = {
        id: `tmpl_${Date.now()}`,
        name: editingTemplateData.name || '',
        subject: editingTemplateData.subject || '',
        body: editingTemplateData.body || '',
        variables: finalVariables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplates(prev => [...prev, newTemplate]);
    }
    setIsCreateEditDialogOpen(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const handleOpenSendDialog = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setSendEmailData({
      templateId: template.id,
      subject: template.subject,
      recipients: [],
      variableValues: template.variables.reduce((acc, v) => ({ ...acc, [v.name]: '' }), {}),
    });
    setSendToEmails('');
    setIsSendDialogOpen(true);
  };

  const handleSendFormChange = (field: keyof Pick<SendEmailPayload, 'subject'>, value: string) => {
    setSendEmailData(prev => ({ ...prev, [field]: value }));
  };

  const handleSendVariableChange = (variableName: string, value: string) => {
    setSendEmailData(prev => ({
      ...prev,
      variableValues: { ...(prev.variableValues || {}), [variableName]: value },
    }));
  };

  const handleActualSend = () => {
    if (!currentTemplate || !sendEmailData.subject || !sendToEmails.trim()) {
      alert('Subject and Recipient emails are required.');
      return;
    }
    const recipientsArray: EmailRecipient[] = sendToEmails.split(',').map(e => e.trim()).filter(e => e).map(email => ({ email }));
    if(recipientsArray.length === 0){
      alert('Please provide at least one recipient email.');
      return;
    }

    const finalPayload: SendEmailPayload = {
      templateId: currentTemplate.id,
      subject: sendEmailData.subject || '',
      recipients: recipientsArray,
      variableValues: sendEmailData.variableValues || {},
    };

    // Check if all variables are filled
    for (const variable of currentTemplate.variables) {
      if (!finalPayload.variableValues[variable.name]?.trim()) {
        alert(`Please fill in the value for {{${variable.name}}}.`);
        return;
      }
    }

    console.log('Sending email with payload:', finalPayload);
    alert('Email send process initiated (check console).'); // Placeholder for actual send logic
    setIsSendDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <Button onClick={handleOpenCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
        </Button>
      </div>

      {/* List Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>Manage your email templates here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-center">Variables</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No email templates created yet.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="truncate max-w-xs" title={template.subject}>{template.subject}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{template.variables.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" title="View" onClick={() => handleOpenViewDialog(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => handleOpenEditDialog(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Send" onClick={() => handleOpenSendDialog(template)}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Template Dialog */}
      <Dialog open={isCreateEditDialogOpen} onOpenChange={setIsCreateEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{currentTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>
              {currentTemplate ? 'Modify the details of your email template.' : 'Fill in the details to create a new email template. Use {{variableName}} for dynamic content.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="template-name" className="text-right">Name</Label>
              <Input id="template-name" value={editingTemplateData.name || ''} onChange={(e) => handleCreateEditFormChange('name', e.target.value)} className="col-span-3" placeholder="e.g., Welcome Email" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="template-subject" className="text-right">Subject</Label>
              <Input id="template-subject" value={editingTemplateData.subject || ''} onChange={(e) => handleCreateEditFormChange('subject', e.target.value)} className="col-span-3" placeholder="e.g., Welcome {{userName}}!" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="template-body" className="text-right pt-2">Body</Label>
              <Textarea id="template-body" value={editingTemplateData.body || ''} onChange={(e) => handleCreateEditFormChange('body', e.target.value)} className="col-span-3 min-h-[150px]" placeholder="Hello {{userName}},\n\nYour order {{orderId}} has been shipped."/>
            </div>
            {detectedVariablesInForm.length > 0 && (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-1">Detected Variables</Label>
                <div className="col-span-3 flex flex-wrap gap-2">
                  {detectedVariablesInForm.map(v => <Badge key={v.name} variant="outline">{v.name}</Badge>)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      {currentTemplate && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{currentTemplate.name}</DialogTitle>
              <DialogDescription>Viewing template details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label className="font-semibold">Subject</Label>
                <p className="text-sm text-muted-foreground p-2 border rounded-md bg-stone-50 dark:bg-stone-900">{currentTemplate.subject}</p>
              </div>
              <div>
                <Label className="font-semibold">Body</Label>
                <pre className="text-sm text-muted-foreground p-2 border rounded-md bg-stone-50 dark:bg-stone-900 whitespace-pre-wrap break-words">{currentTemplate.body}</pre>
              </div>
              {currentTemplate.variables.length > 0 && (
                <div>
                  <Label className="font-semibold">Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {currentTemplate.variables.map(v => <Badge key={v.name} variant="secondary">{v.name}</Badge>)}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Created: {new Date(currentTemplate.createdAt).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Last Updated: {new Date(currentTemplate.updatedAt).toLocaleString()}</p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Email Dialog */}
      {currentTemplate && (
        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Send Email: {currentTemplate.name}</DialogTitle>
              <DialogDescription>Fill in the recipient details and variables to send this email.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="send-subject">Subject</Label>
                <Input id="send-subject" value={sendEmailData.subject || ''} onChange={(e) => handleSendFormChange('subject', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="send-to">To (comma-separated emails)</Label>
                <Input id="send-to" value={sendToEmails} onChange={(e) => setSendToEmails(e.target.value)} placeholder="email1@example.com, email2@example.com" />
              </div>
              {currentTemplate.variables.map(variable => (
                <div key={variable.name}>
                  <Label htmlFor={`var-${variable.name}`}>Value for <Badge variant="outline">{`{{${variable.name}}}`}</Badge></Label>
                  <Input 
                    id={`var-${variable.name}`} 
                    value={sendEmailData.variableValues?.[variable.name] || ''} 
                    onChange={(e) => handleSendVariableChange(variable.name, e.target.value)} 
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                 <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleActualSend}><Send className="mr-2 h-4 w-4" /> Send Email</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
