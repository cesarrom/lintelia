'use client';

import { useState, useEffect, useTransition } from "react";
/**
 * v0 by Vercel.
 * @see https://v0.dev/t/3t2OW0rlXGm
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileIcon, PlusIcon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addAdditionalRequest, AdditionalRequest } from "@/actions/applications";
import { Application } from "@/actions/applications";
import dynamic from 'next/dynamic';
import { Input } from "@/components/ui/input";
import { uploadFile } from "@/actions/files";

const FileViewer = dynamic(() => import("../../FileViewer/FileViewer").then(m => m.FileViewer), { ssr: false });

export default function AdditionalInfo({ application, domain, additionalRequests = [] }: { additionalRequests: AdditionalRequest[]; application: Application, domain: string }) {
  const applicationId = application.id;
  const disabled = application.status !== 'pending';
  const [additionalInfoRequests, setAdditionalInfoRequests] = useState<AdditionalRequest[]>(additionalRequests);
  const [_, startTransition] = useTransition();
  const  [files, setFiles] = useState<File[]>([]);
  const [newRequest, setNewRequest] = useState<{
    type: string;
    request: string;
  } | null>(null);

  const handleTypeChange = (value: string) => {
    setNewRequest(prev => ({ ...prev, type: value }));
  };

  const handleRequestChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewRequest(prev => ({ ...prev, request: event.target.value }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      if (newRequest.type && newRequest.request) {
        const fileUploads = await Promise.all(files.map(async file => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result as string;
              resolve(base64String.split(',')[1]);
            };
            reader.readAsDataURL(file);
          });
          
          return uploadFile(domain, base64, file.name);
        }));

        const req = await addAdditionalRequest(domain, applicationId, {
          type: newRequest.type,
          request: newRequest.request,
          status: 'pending',
          response: '',
          attachments: fileUploads,
        });

        setAdditionalInfoRequests(prev => [...prev, req]);

        setNewRequest(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Information Requests</CardTitle>
        <Button onClick={() => setNewRequest({ type: '', request: '' })} disabled={disabled}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Request
        </Button>
        {
          newRequest ?
            <Dialog open={!!newRequest} onOpenChange={open => { !open && setNewRequest(null) }}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Additional Information Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="additional-info-type">Additional Information Type</Label>
                    <Select onValueChange={handleTypeChange} value={newRequest.type}>
                      <SelectTrigger id="additional-info-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="additional-info">Request Description</Label>
                    <Textarea
                      id="additional-info"
                      rows={3}
                      placeholder="Enter any additional information or requests"
                      value={newRequest.request}
                      onChange={handleRequestChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="attachments">Attachments (Optional)</Label>
                    <Input
                      id="attachments"
                      type="file"
                      multiple
                      className="cursor-pointer"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setFiles(files);
                      }}
                    />
                  </div>

                </div>
                <DialogFooter>
                  <Button className="ml-auto" onClick={handleSubmit}>Submit Request</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog> :
            null
        }
      </CardHeader>
      <CardContent>
        <div className="flex-1 bg-background p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {additionalInfoRequests.map(request => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {request.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.request}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{request.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {request.response ? request.type === "file" ? (
                        <FileViewer
                          fileKeys={[request.response]}
                          domain={domain}
                        />
                      ) : request.response : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}