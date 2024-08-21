/**
 * v0 by Vercel.
 * @see https://v0.dev/t/jh2FuzKx9EK
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    tenantName: "",
    tenantDescription: "",
    bankName: "",
    bankAddress: "",
    bankEmail: "",
    bankPhone: "",
    bankWebsite: "",
    currency: "",
    allowedPaymentMethods: [],
    feesAndLimits: {},
  })
  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const handleCheckboxChange = (e: any) => {
    const { value, checked } = e.target
    const allowedPaymentMethods = checked
      ? [...formData.allowedPaymentMethods, value]
      : formData.allowedPaymentMethods.filter((method: any) => method !== value)
    setFormData({ ...formData, allowedPaymentMethods })
  }
  const handleSubmit = (e: any) => {
    e.preventDefault()
    console.log(formData)
  }
  const handleNextStep = () => {
    setStep(step + 1)
  }
  const handlePrevStep = () => {
    setStep(step - 1)
  }
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>New Tenant Setup</CardTitle>
        <CardDescription>Follow the steps below to create a new tenant for our banking platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
            >
              1
            </div>
            <span>Tenant Information</span>
          </div>
          <div className="flex items-center space-x-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
            >
              2
            </div>
            <span>Bank Details</span>
          </div>
          <div className="flex items-center space-x-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
            >
              3
            </div>
            <span>Configuration</span>
          </div>
        </div>
        {step === 1 && (
          <div>
            <div className="grid gap-4 mb-6">
              <div className="grid gap-2">
                <Label htmlFor="tenantName">Tenant Name</Label>
                <Input id="tenantName" name="tenantName" value={formData.tenantName} onChange={handleChange} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tenantDescription">Tenant Description</Label>
                <Textarea
                  id="tenantDescription"
                  name="tenantDescription"
                  value={formData.tenantDescription}
                  onChange={handleChange}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleNextStep}>Next</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="grid gap-4 mb-6">
              <div className="grid gap-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input id="bankName" name="bankName" value={formData.bankName} onChange={handleChange} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bankAddress">Bank Address</Label>
                <Input
                  id="bankAddress"
                  name="bankAddress"
                  value={formData.bankAddress}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bankEmail">Bank Email</Label>
                <Input
                  id="bankEmail"
                  name="bankEmail"
                  type="email"
                  value={formData.bankEmail}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bankPhone">Bank Phone</Label>
                <Input id="bankPhone" name="bankPhone" value={formData.bankPhone} onChange={handleChange} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bankWebsite">Bank Website</Label>
                <Input
                  id="bankWebsite"
                  name="bankWebsite"
                  value={formData.bankWebsite}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                Previous
              </Button>
              <Button onClick={handleNextStep}>Next</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="grid gap-4 mb-6">
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" value={formData.currency} required onValueChange={handleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Allowed Payment Methods</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <Checkbox
                      id="credit-card"
                      value="credit-card"
                      checked={formData.allowedPaymentMethods.includes("credit-card")}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="credit-card" className="ml-2">
                      Credit Card
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox
                      id="debit-card"
                      value="debit-card"
                      checked={formData.allowedPaymentMethods.includes("debit-card")}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="debit-card" className="ml-2">
                      Debit Card
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox
                      id="bank-transfer"
                      value="bank-transfer"
                      checked={formData.allowedPaymentMethods.includes("bank-transfer")}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="bank-transfer" className="ml-2">
                      Bank Transfer
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox
                      id="mobile-wallet"
                      value="mobile-wallet"
                      checked={formData.allowedPaymentMethods.includes("mobile-wallet")}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="mobile-wallet" className="ml-2">
                      Mobile Wallet
                    </Label>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Fees and Limits</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="transaction-fee">Transaction Fee (%)</Label>
                    <Input
                      id="transaction-fee"
                      name="feesAndLimits.transactionFee"
                      type="number"
                      value={formData.feesAndLimits.transactionFee || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="daily-limit">Daily Limit</Label>
                    <Input
                      id="daily-limit"
                      name="feesAndLimits.dailyLimit"
                      type="number"
                      value={formData.feesAndLimits.dailyLimit || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="monthly-limit">Monthly Limit</Label>
                    <Input
                      id="monthly-limit"
                      name="feesAndLimits.monthlyLimit"
                      type="number"
                      value={formData.feesAndLimits.monthlyLimit || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transaction-limit">Transaction Limit</Label>
                    <Input
                      id="transaction-limit"
                      name="feesAndLimits.transactionLimit"
                      type="number"
                      value={formData.feesAndLimits.transactionLimit || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                Previous
              </Button>
              <Button onClick={handleSubmit}>Submit</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}