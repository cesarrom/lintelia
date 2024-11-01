"use client"

import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ValidationFeature } from "@/actions/forms"

interface FeatureToggleProps {
  features: ValidationFeature[]
  value?: string[]
  onChange?: (activeFeatures: string[]) => void
  disabled?: boolean
}

export default function FormFeatures({
  features,
  value = [],
  onChange,
  disabled = false
}: FeatureToggleProps) {
  console.log({ value })
  const [activeFeatures, setActiveFeatures] = useState<string[]>(value)

  useEffect(() => {
    setActiveFeatures(value)
  }, [value])

  const handleToggle = (featureId: string) => {
    const updatedFeatures = activeFeatures.includes(featureId)
      ? activeFeatures.filter(id => id !== featureId)
      : [...activeFeatures, featureId]
    
    setActiveFeatures(updatedFeatures)
    onChange?.(updatedFeatures)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Feature Toggle</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="flex items-start space-x-3 space-y-0 rounded-md border p-4"
          >
            <Checkbox
              id={`feature-${feature.id}`}
              checked={activeFeatures.includes(feature.id)}
              onCheckedChange={() => handleToggle(feature.id)}
              disabled={disabled}
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor={`feature-${feature.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {feature.id}
              </Label>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}