'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { VariableInput } from '@/components/ui/variable-input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { DialogProps } from '../types';
import { ReviewNodeConfig } from '@repo/fintivio/schemas';
import { useNodeConfig } from '../../WorkflowContext';

export function ReviewNodeConfigDialog({
  open,
  onOpenChange,
  onSave,
  data: initialData
}: DialogProps) {
  const [data, setData] = useNodeConfig<ReviewNodeConfig>({
    title: 'Review',
    description: '',
    items: [],
    assignToRoles: [],
    timeoutInHours: 24,
    requireCommentOnReject: true,
    requireEvidenceOnReject: false,
    notifyOnAssignment: true,
    notifyOnCompletion: true
  });
  const [newItemAnswerId, setNewItemAnswerId] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [newRole, setNewRole] = useState('');

  const handleSave = () => {
    const updatedData = {
      ...initialData,
      config: data
    };
    onSave(updatedData);
    onOpenChange(false);
  };

  const addItem = () => {
    if (!newItemAnswerId) return;
    
    setData({
      ...data,
      items: [
        ...data.items,
        {
          answer_id: newItemAnswerId,
          label: newItemLabel || newItemAnswerId,
          required: newItemRequired,
          order: data.items.length
        }
      ]
    });
    
    setNewItemAnswerId('');
    setNewItemLabel('');
    setNewItemRequired(true);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...data.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    setData({
      ...data,
      items: updatedItems
    });
  };

  const removeItem = (index: number) => {
    const updatedItems = [...data.items];
    updatedItems.splice(index, 1);
    
    setData({
      ...data,
      items: updatedItems
    });
  };

  const handleRoleChange = (role: string) => {
    if (!role) return;
    
    if (!data.assignToRoles?.includes(role)) {
      setData({
        ...data,
        assignToRoles: [...(data.assignToRoles || []), role]
      });
    }
    
    setNewRole('');
  };

  const removeRole = (role: string) => {
    setData({
      ...data,
      assignToRoles: (data.assignToRoles || []).filter(r => r !== role)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Review Node</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="items">Review Items</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={data.title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                  placeholder="Review Title"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={data.description || ''}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                  placeholder="Describe the purpose of this review"
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Assign to Roles</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(data.assignToRoles || []).map((role, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {role}
                      <button 
                        type="button" 
                        onClick={() => removeRole(role)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Role name"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleRoleChange(newRole)}
                    disabled={!newRole}
                  >
                    Add Role
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="items" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Review Items</Label>
                <div className="space-y-3">
                  {data.items.map((item, index) => (
                    <Card key={index} className="relative">
                      <CardContent className="p-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <div className="grid gap-3">
                          <div className="grid gap-1">
                            <Label htmlFor={`item-answer-id-${index}`}>Answer ID</Label>
                            <VariableInput
                              value={item.answer_id}
                              onChange={(value) => updateItem(index, 'answer_id', value)}
                              placeholder="Enter answer ID or reference with {{}}"
                            />
                          </div>
                          
                          <div className="grid gap-1">
                            <Label htmlFor={`item-label-${index}`}>Label</Label>
                            <Input
                              id={`item-label-${index}`}
                              value={item.label || ''}
                              onChange={(e) => updateItem(index, 'label', e.target.value)}
                              placeholder="Display label (optional)"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`item-required-${index}`}
                              checked={item.required}
                              onCheckedChange={(checked) => updateItem(index, 'required', checked)}
                            />
                            <Label htmlFor={`item-required-${index}`}>Required</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Add New Item</h3>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="new-item-answer-id">Answer ID</Label>
                      <VariableInput
                        value={newItemAnswerId}
                        onChange={setNewItemAnswerId}
                        placeholder="Enter answer ID or reference with {{}}"
                      />
                    </div>
                    
                    <div className="grid gap-1">
                      <Label htmlFor="new-item-label">Label (optional)</Label>
                      <Input
                        id="new-item-label"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        placeholder="Display label"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        id="new-item-required"
                        checked={newItemRequired}
                        onCheckedChange={setNewItemRequired}
                      />
                      <Label htmlFor="new-item-required">Required</Label>
                    </div>
                    
                    <Button 
                      type="button" 
                      onClick={addItem}
                      disabled={!newItemAnswerId}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="timeout">Timeout (hours)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="0"
                  value={data.timeoutInHours || 0}
                  onChange={(e) => setData({ ...data, timeoutInHours: parseInt(e.target.value) || 0 })}
                  placeholder="Timeout in hours (0 for no timeout)"
                />
                <p className="text-sm text-muted-foreground">
                  Set to 0 for no timeout. If set, the review will automatically timeout after this many hours.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="require-comment-on-reject"
                    checked={data.requireCommentOnReject}
                    onCheckedChange={(checked) => setData({ ...data, requireCommentOnReject: checked })}
                  />
                  <Label htmlFor="require-comment-on-reject">Require comment on rejection</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="require-evidence-on-reject"
                    checked={data.requireEvidenceOnReject}
                    onCheckedChange={(checked) => setData({ ...data, requireEvidenceOnReject: checked })}
                  />
                  <Label htmlFor="require-evidence-on-reject">Require evidence on rejection</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="notify-on-assignment"
                    checked={data.notifyOnAssignment}
                    onCheckedChange={(checked) => setData({ ...data, notifyOnAssignment: checked })}
                  />
                  <Label htmlFor="notify-on-assignment">Notify on assignment</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="notify-on-completion"
                    checked={data.notifyOnCompletion}
                    onCheckedChange={(checked) => setData({ ...data, notifyOnCompletion: checked })}
                  />
                  <Label htmlFor="notify-on-completion">Notify on completion</Label>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 