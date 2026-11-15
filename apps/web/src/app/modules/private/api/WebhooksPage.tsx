import React, { useState } from 'react';
import { HttpHeader, WebhookEvent, OutgoingWebhookConfiguration } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';

const mockSystemEvents: WebhookEvent[] = [
  { id: 'event.created', name: 'Event Created', description: 'Triggered when a new event is created.' },
  { id: 'event.updated', name: 'Event Updated', description: 'Triggered when an event is updated.' },
  { id: 'user.login', name: 'User Login', description: 'Triggered upon successful user login.' },
  { id: 'payment.succeeded', name: 'Payment Succeeded', description: 'Triggered when a payment is successful.' },
  { id: 'payment.failed', name: 'Payment Failed', description: 'Triggered when a payment fails.' },
];

const mockWebhooks: OutgoingWebhookConfiguration[] = [
  {
    id: 'wh_1',
    name: 'Notify Slack on Payment Success',
    url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
    secretHeaders: [{ id: 'h1', name: 'Content-Type', value: 'application/json' }],
    subscribedEvents: ['payment.succeeded'],
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wh_2',
    name: 'Log all events to Datadog',
    url: 'https://api.datadoghq.com/api/v1/logs',
    secretHeaders: [
      { id: 'h1', name: 'DD-API-KEY', value: 'your_datadog_api_key' },
      { id: 'h2', name: 'Content-Type', value: 'application/json' },
    ],
    subscribedEvents: ['event.created', 'event.updated', 'user.login', 'payment.succeeded', 'payment.failed'],
    isEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<OutgoingWebhookConfiguration[]>(mockWebhooks);
  const [selectedWebhook, setSelectedWebhook] = useState<OutgoingWebhookConfiguration | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Partial<OutgoingWebhookConfiguration>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const handleAddNewWebhook = () => {
    setSelectedWebhook(null);
    setEditingWebhook({ name: '', url: '', secretHeaders: [], subscribedEvents: [], isEnabled: true });
    setIsFormOpen(true);
  };

  const handleEditWebhook = (webhook: OutgoingWebhookConfiguration) => {
    setSelectedWebhook(webhook);
    setEditingWebhook({ ...webhook });
    setIsFormOpen(true);
  };

  const handleDeleteWebhook = (webhookId: string) => {
    setWebhooks(prev => prev.filter(wh => wh.id !== webhookId));
    // In a real app, call API to delete
  };

  const handleFormChange = (field: keyof OutgoingWebhookConfiguration, value: any) => {
    setEditingWebhook(prev => ({ ...prev, [field]: value }));
  };
  
  const handleHeaderChange = (index: number, field: keyof HttpHeader, value: string) => {
    const updatedHeaders = [...(editingWebhook.secretHeaders || [])];
    updatedHeaders[index] = { ...updatedHeaders[index], [field]: value, id: updatedHeaders[index]?.id || `h_${Date.now()}` };
    setEditingWebhook(prev => ({ ...prev, secretHeaders: updatedHeaders }));
  };

  const addHeaderField = () => {
    const newHeader: HttpHeader = { id: `h_${Date.now()}`, name: '', value: '' };
    setEditingWebhook(prev => ({ ...prev, secretHeaders: [...(prev.secretHeaders || []), newHeader] }));
  };

  const removeHeaderField = (index: number) => {
    setEditingWebhook(prev => ({ 
      ...prev, 
      secretHeaders: (prev.secretHeaders || []).filter((_, i) => i !== index) 
    }));
  };

  const handleEventToggle = (eventId: string) => {
    const currentEvents = editingWebhook.subscribedEvents || [];
    const newEvents = currentEvents.includes(eventId)
      ? currentEvents.filter(id => id !== eventId)
      : [...currentEvents, eventId];
    setEditingWebhook(prev => ({ ...prev, subscribedEvents: newEvents }));
  };

  const handleSaveWebhook = () => {
    if (!editingWebhook.name || !editingWebhook.url) {
      alert('Webhook Name and URL are required.'); // Simple validation
      return;
    }
    if (selectedWebhook) {
      // Update existing
      const updatedWebhook = { ...selectedWebhook, ...editingWebhook, updatedAt: new Date().toISOString() } as OutgoingWebhookConfiguration;
      setWebhooks(prev => prev.map(wh => wh.id === selectedWebhook.id ? updatedWebhook : wh));
    } else {
      // Add new
      const newWebhook: OutgoingWebhookConfiguration = {
        id: `wh_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...editingWebhook,
        updatedAt: new Date().toISOString(),
      } as OutgoingWebhookConfiguration;
      setWebhooks(prev => [...prev, newWebhook]);
    }
    setIsFormOpen(false);
    setSelectedWebhook(null);
    setEditingWebhook({});
    // In a real app, call API to save
  };

  const toggleDetails = (webhookId: string) => {
    setExpandedDetails(prev => ({ ...prev, [webhookId]: !prev[webhookId] }));
  };

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Outgoing Webhooks</h1>
        <Button onClick={handleAddNewWebhook}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Webhook
        </Button>
      </div>

      {isFormOpen && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{selectedWebhook ? 'Edit Webhook' : 'Add New Webhook'}</CardTitle>
            <CardDescription>
              Configure the URL, secret headers, and events for your webhook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="webhook-name">Webhook Name</Label>
              <Input 
                id="webhook-name" 
                placeholder="e.g., Notify Slack on Payment Success"
                value={editingWebhook.name || ''} 
                onChange={(e) => handleFormChange('name', e.target.value)} 
              />
            </div>
            <div>
              <Label htmlFor="webhook-url">URL</Label>
              <Input 
                id="webhook-url" 
                placeholder="https://your-endpoint.com/webhook"
                value={editingWebhook.url || ''} 
                onChange={(e) => handleFormChange('url', e.target.value)} 
              />
            </div>
            
            <div>
              <Label>Secret Headers (Optional)</Label>
              {(editingWebhook.secretHeaders || []).map((header, index) => (
                <div key={header.id || index} className="flex items-center space-x-2 mt-1">
                  <Input 
                    placeholder="Header Name (e.g., Authorization)" 
                    value={header.name} 
                    onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    placeholder="Header Value (e.g., Bearer your_token)" 
                    value={header.value} 
                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeHeaderField(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addHeaderField} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Header
              </Button>
            </div>

            <div>
              <Label>Subscribed Events</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2 p-4 border rounded-md">
                {mockSystemEvents.map(event => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Switch 
                      id={`event-${event.id}`}
                      checked={(editingWebhook.subscribedEvents || []).includes(event.id)}
                      onCheckedChange={(checked: boolean) => handleEventToggle(event.id)}
                    />
                    <Label htmlFor={`event-${event.id}`} className="cursor-pointer">
                      {event.name}
                      {event.description && <p className="text-xs text-muted-foreground font-normal">{event.description}</p>}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="webhook-enabled"
                checked={editingWebhook.isEnabled === undefined ? true : editingWebhook.isEnabled}
                onCheckedChange={(checked: boolean) => handleFormChange('isEnabled', checked)}
              />
              <Label htmlFor="webhook-enabled">Enable Webhook</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWebhook}>Save Webhook</Button>
          </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing Webhooks</CardTitle>
          <CardDescription>Manage your configured outgoing webhooks.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead> {/* For expand icon */}
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Events</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No webhooks configured yet.
                  </TableCell>
                </TableRow>
              )}
              {webhooks.map(webhook => (
                <React.Fragment key={webhook.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => toggleDetails(webhook.id)}>
                        {expandedDetails[webhook.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="truncate max-w-xs" title={webhook.url}>{webhook.url}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${webhook.isEnabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {webhook.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell>{webhook.subscribedEvents.length}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditWebhook(webhook)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhook(webhook.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedDetails[webhook.id] && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 space-y-3">
                          <p className="text-sm font-semibold">Details for: {webhook.name}</p>
                          <div>
                            <p className="text-xs text-muted-foreground">URL:</p>
                            <p className="text-sm break-all">{webhook.url}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Subscribed Events ({webhook.subscribedEvents.length}):</p>
                            <ul className="list-disc list-inside text-sm">
                              {webhook.subscribedEvents.map(eventId => {
                                const eventDetail = mockSystemEvents.find(e => e.id === eventId);
                                return <li key={eventId}>{eventDetail ? eventDetail.name : eventId}</li>;
                              })}
                            </ul>
                          </div>
                          {webhook.secretHeaders.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Secret Headers:</p>
                              <ul className="list-disc list-inside text-sm">
                                {webhook.secretHeaders.map(header => (
                                  <li key={header.id}>{header.name}: ********</li> // Mask value for display
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Created: {new Date(webhook.createdAt).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Last Updated: {new Date(webhook.updatedAt).toLocaleString()}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}