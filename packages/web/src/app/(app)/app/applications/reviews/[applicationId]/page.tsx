/**
 * v0 by Vercel.
 * @see https://v0.dev/t/3t2OW0rlXGm
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileIcon, PlusIcon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ApplicationReviewPage() {
  const additionalInfoRequests = [
    {
      id: 1,
      type: "text",
      request: "Please provide your current employment details.",
      status: "pending",
      response: null,
    },
    {
      id: 2,
      type: "number",
      request: "Please provide your monthly rental/mortgage payment amount.",
      status: "completed",
      response: "$1,500",
    },
    {
      id: 3,
      type: "file",
      request: "Please provide your most recent pay stubs.",
      status: "completed",
      response: "/placeholder.svg",
    },
    {
      id: 4,
      type: "text",
      request: "Please explain any gaps in your employment history.",
      status: "pending",
      response: null,
    },
  ]
  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 lg:p-10">
      <div className="grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value="John Doe" disabled />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value="john@example.com" disabled />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value="+1 (555) 555-5555" disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" rows={3} value="123 Main St, Anytown USA" disabled />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="credit-score">Credit Score</Label>
                    <Input id="credit-score" value="780" disabled />
                  </div>
                  <div>
                    <Label htmlFor="debt-to-income">Debt-to-Income Ratio</Label>
                    <Input id="debt-to-income" value="0.35" disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="employment-status">Employment Status</Label>
                    <Input id="employment-status" value="Employed" disabled />
                  </div>
                  <div>
                    <Label htmlFor="income">Annual Income</Label>
                    <Input id="income" value="$75,000" disabled />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Identity Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="driver-license">Driver's License</Label>
                    <img
                      src="/placeholder.svg"
                      width="300"
                      height="200"
                      alt="Driver's License"
                      className="rounded-md object-cover"
                      style={{ aspectRatio: "300/200", objectFit: "cover" }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="passport">Passport</Label>
                    <img
                      src="/placeholder.svg"
                      width="300"
                      height="200"
                      alt="Passport"
                      className="rounded-md object-cover"
                      style={{ aspectRatio: "300/200", objectFit: "cover" }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Document Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="bank-statements">Bank Statements</Label>
                    <img
                      src="/placeholder.svg"
                      width="300"
                      height="200"
                      alt="Bank Statements"
                      className="rounded-md object-cover"
                      style={{ aspectRatio: "300/200", objectFit: "cover" }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="tax-returns">Tax Returns</Label>
                    <img
                      src="/placeholder.svg"
                      width="300"
                      height="200"
                      alt="Tax Returns"
                      className="rounded-md object-cover"
                      style={{ aspectRatio: "300/200", objectFit: "cover" }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Additional Information Requests</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Application
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Additional Information Request</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="additional-info-type">Additional Information Type</Label>
                      <Select>
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
                      <Textarea id="additional-info" rows={3} placeholder="Enter any additional information or requests" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="ml-auto">Submit Request</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                            {request.type === "file" ? (
                              <a href={request.response || "#"} target="_blank">
                                <FileIcon className="h-4 w-4" />
                              </a>
                            ) : request.response}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}