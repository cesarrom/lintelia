'use client';
import { FormConfig } from "@/types/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { v4 as uuid } from 'uuid';

interface FormBuilderProps {
  value: FormConfig | null;
  onChange: (value: FormConfig) => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
] as const;

export function FormBuilder({ value, onChange }: FormBuilderProps) {
  const [form, setForm] = useState<FormConfig>(
    value || {
      name: "",
      description: "",
      fields: [],
      submitButtonText: "Submit",
      successMessage: "Form submitted successfully!",
    }
  );

  const updateForm = (updates: Partial<FormConfig>) => {
    const updatedForm = { ...form, ...updates };
    setForm(updatedForm);
    onChange(updatedForm);
  };

  const addField = () => {
    const newField = {
      id: uuid(),
      type: "text" as const,
      label: "",
      name: "",
      required: false,
    };
    updateForm({ fields: [...form.fields, newField] });
  };

  const updateField = (index: number, updates: Partial<FormConfig["fields"][0]>) => {
    const updatedFields = [...form.fields];
    updatedFields[index] = { ...updatedFields[index], ...updates };
    updateForm({ fields: updatedFields });
  };

  const removeField = (index: number) => {
    const updatedFields = form.fields.filter((_, i) => i !== index);
    updateForm({ fields: updatedFields });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label>Form Name</Label>
          <Input
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            placeholder="Enter form name"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description || ""}
            onChange={(e) => updateForm({ description: e.target.value })}
            placeholder="Enter form description"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Form Fields</Label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </div>

        {form.fields.map((field, index) => (
          <Card key={field.id}>
            <CardContent className="pt-6 grid gap-4">
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  <div>
                    <Label>Field Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value) =>
                        updateField(index, { type: value as typeof field.type })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Enter field label"
                    />
                  </div>

                  <div>
                    <Label>Name</Label>
                    <Input
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                      placeholder="Enter field name"
                    />
                  </div>

                  {(field.type === "select" || field.type === "radio") && (
                    <div>
                      <Label>Options</Label>
                      <div className="space-y-2">
                        {field.options?.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex gap-2">
                            <Input
                              value={option.label}
                              onChange={(e) => {
                                const updatedOptions = [...(field.options || [])];
                                updatedOptions[optionIndex] = {
                                  ...option,
                                  label: e.target.value,
                                  value: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                                };
                                updateField(index, { options: updatedOptions });
                              }}
                              placeholder="Option label"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updatedOptions = field.options?.filter(
                                  (_, i) => i !== optionIndex
                                );
                                updateField(index, { options: updatedOptions });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updatedOptions = [
                              ...(field.options || []),
                              { label: "", value: "" },
                            ];
                            updateField(index, { options: updatedOptions });
                          }}
                        >
                          Add Option
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeField(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <Label>Submit Button Text</Label>
          <Input
            value={form.submitButtonText || ""}
            onChange={(e) => updateForm({ submitButtonText: e.target.value })}
            placeholder="Enter submit button text"
          />
        </div>

        <div>
          <Label>Success Message</Label>
          <Input
            value={form.successMessage || ""}
            onChange={(e) => updateForm({ successMessage: e.target.value })}
            placeholder="Enter success message"
          />
        </div>
      </div>
    </div>
  );
} 