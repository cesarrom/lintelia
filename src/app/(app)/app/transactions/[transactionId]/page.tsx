"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function Component() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [transaction, setTransaction] = useState({
    id: "TX123",
    date: "2023-04-15",
    amount: 250.0,
    description: "Monthly subscription",
    status: "Pending",
    comments: "",
    fromAccount: "Checking Account",
    toAccount: "Savings Account",
  })
  const handleApprove = () => {
    setTransaction((prev) => ({ ...prev, status: "Approved" }))
  }
  const handleReject = () => {
    setTransaction((prev) => ({ ...prev, status: "Rejected" }))
  }
  const handleRequestInfo = () => {
    setTransaction((prev) => ({ ...prev, status: "Under Review" }))
  }
  const handleCommentChange = (e: any) => {
    setTransaction((prev) => ({ ...prev, comments: e.target.value }))
  }
  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transaction Review</h1>
        <div className="flex items-center gap-2">
          <Button variant={isAdmin ? "outline" : "default"} onClick={() => setIsAdmin(false)}>
            Client View
          </Button>
          <Button variant={isAdmin ? "default" : "outline"} onClick={() => setIsAdmin(true)}>
            Admin View
          </Button>
        </div>
      </div>
      <div className="bg-background rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-muted-foreground">Transaction ID</div>
            <div className="text-lg font-medium">{transaction.id}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Date</div>
            <div className="text-lg font-medium">{transaction.date}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="text-lg font-medium">${transaction.amount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Description</div>
            <div className="text-lg font-medium">{transaction.description}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">From Account</div>
            <div className="text-lg font-medium">{transaction.fromAccount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">To Account</div>
            <div className="text-lg font-medium">{transaction.toAccount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div
              className={`text-lg font-medium ${transaction.status === "Approved"
                ? "text-green-500"
                : transaction.status === "Rejected"
                  ? "text-red-500"
                  : "text-yellow-500"
                }`}
            >
              {transaction.status}
            </div>
          </div>
          {isAdmin && (
            <div className="col-span-2">
              <div className="text-sm text-muted-foreground">Comments</div>
              <Textarea value={transaction.comments} onChange={handleCommentChange} className="w-full" />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={handleReject}>
                  Reject
                </Button>
                <Button variant="outline" onClick={handleRequestInfo}>
                  Request Info
                </Button>
                <Button onClick={handleApprove}>Approve</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}