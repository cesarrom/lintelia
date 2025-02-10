import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TriggerConfigProps } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBuilder } from "@/components/form-builder";
import { FormConfig } from "@/types/form";

// Schema for a single condition
const conditionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: z.enum(["eq", "neq", "contains", "startsWith", "endsWith"]),
  value: z.string().min(1, "Value is required"),
});

const formsConfigSchema = z.object({
  formId: z.string().optional(),
  formConfig: z.custom<FormConfig>((val) => val !== undefined).optional(),
  conditions: z.array(conditionSchema).optional(),
});

type FormsConfigSchema = z.infer<typeof formsConfigSchema>;

export function FormsConfig({ onSubmit, initialConfig }: TriggerConfigProps<FormsConfigSchema>) {
  const [existingForms, setExistingForms] = useState<Array<{ id: string; name: string }>>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const form = useForm<FormsConfigSchema>({
    resolver: zodResolver(formsConfigSchema),
    defaultValues: {
      formId: (initialConfig?.formId as string) || "",
      formConfig: initialConfig?.formConfig || null,
      conditions: (initialConfig?.conditions as any[]) || [],
    },
  });

  // Fetch available forms
  useEffect(() => {
    // TODO: Implement API call to fetch forms
    setExistingForms([
      { id: "form1", name: "Contact Form" },
      { id: "form2", name: "Feedback Form" },
      { id: "form3", name: "Support Request" },
    ]);
  }, []);

  const handleSubmit = (data: FormsConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={mode} onValueChange={(value) => setMode(value as "existing" | "new")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Use Existing Form</TabsTrigger>
            <TabsTrigger value="new">Create New Form</TabsTrigger>
          </TabsList>

          <TabsContent value="existing">
            <Card>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="formId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Form</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a form" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {existingForms.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose an existing form to trigger this workflow
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="formConfig"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Builder</FormLabel>
                      <FormControl>
                        <FormBuilder
                          value={field.value as FormConfig}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        Create a new form that will trigger this workflow when submitted
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Response Conditions (Optional)</h4>
              <p className="text-sm text-muted-foreground">
                Add conditions to filter which form responses trigger the workflow
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const conditions = form.getValues("conditions") || [];
                form.setValue("conditions", [
                  ...conditions,
                  { field: "", operator: "eq" as const, value: "" },
                ]);
              }}
            >
              Add Condition
            </Button>
          </div>

          {form.watch("conditions")?.map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6 grid gap-4">
                <FormField
                  control={form.control}
                  name={`conditions.${index}.field`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Field</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a field" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* TODO: Get fields from selected form or form builder */}
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="message">Message</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`conditions.${index}.operator`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an operator" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="eq">Equals</SelectItem>
                          <SelectItem value="neq">Not Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="startsWith">Starts With</SelectItem>
                          <SelectItem value="endsWith">Ends With</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`conditions.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    const conditions = form.getValues("conditions") || [];
                    form.setValue(
                      "conditions",
                      conditions.filter((_, i) => i !== index)
                    );
                  }}
                >
                  Remove Condition
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button type="submit">Save Trigger</Button>
      </form>
    </Form>
  );
} 