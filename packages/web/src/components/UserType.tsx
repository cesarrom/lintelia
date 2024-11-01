"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface UserTypeSelectionProps {
  userTypes: string[]
  onSubmit?: (selectedType: string) => void
}

export default function UserTpe({ 
  userTypes, 
  onSubmit = (type) => console.log(`Selected type: ${type}`) 
}: UserTypeSelectionProps) {
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedType) {
      onSubmit(selectedType)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Select User Type</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <RadioGroup value={selectedType} onValueChange={setSelectedType} className="space-y-4">
              {userTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={type} />
                  <Label htmlFor={type}>{type}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button type="submit" className="w-full mt-6" disabled={!selectedType}>
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}