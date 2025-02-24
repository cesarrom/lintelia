import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TriggerConfigProps } from "../../(workflows)/(components)/triggers/types";

// Schema for a single parameter
const paramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean(),
});

// Schema for a single header
const headerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  value: z.string().min(1, "Value is required"),
});

const apiConfigSchema = z.object({
  apiKeyId: z.string().optional(),
  requiredParams: z.array(paramSchema).optional(),
  requiredHeaders: z.array(headerSchema).optional(),
});

type ApiConfigSchema = z.infer<typeof apiConfigSchema>;

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
}

export function ApiConfig({ onSubmit, initialConfig }: TriggerConfigProps<ApiConfigSchema>) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const form = useForm<ApiConfigSchema>({
    resolver: zodResolver(apiConfigSchema),
    defaultValues: {
      apiKeyId: initialConfig?.apiKeyId || "",
      requiredParams: initialConfig?.requiredParams || [],
      requiredHeaders: initialConfig?.requiredHeaders || [],
    },
  });

  // Fetch available API keys
  useEffect(() => {
    // TODO: Implement API call to fetch API keys
    setApiKeys([
      { id: "key1", name: "Development Key", createdAt: new Date().toISOString() },
      { id: "key2", name: "Production Key", createdAt: new Date().toISOString() },
    ]);
  }, []);

  const handleSubmit = (data: ApiConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="apiKeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an API key" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {apiKeys.map((key) => (
                        <SelectItem key={key.id} value={key.id}>
                          {key.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose an API key to secure this endpoint
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Required Parameters</h4>
              <p className="text-sm text-muted-foreground">
                Add parameters that must be included in the request
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const params = form.getValues("requiredParams") || [];
                form.setValue("requiredParams", [
                  ...params,
                  { name: "", type: "string", required: true },
                ]);
              }}
            >
              Add Parameter
            </Button>
          </div>

          {form.watch("requiredParams")?.map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6 grid gap-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <FormField
                      control={form.control}
                      name={`requiredParams.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parameter Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter parameter name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`requiredParams.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`requiredParams.${index}.required`}
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Required</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      const params = form.getValues("requiredParams") || [];
                      form.setValue(
                        "requiredParams",
                        params.filter((_, i) => i !== index)
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Required Headers</h4>
              <p className="text-sm text-muted-foreground">
                Add headers that must be included in the request
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const headers = form.getValues("requiredHeaders") || [];
                form.setValue("requiredHeaders", [
                  ...headers,
                  { name: "", value: "" },
                ]);
              }}
            >
              Add Header
            </Button>
          </div>

          {form.watch("requiredHeaders")?.map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6 grid gap-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <FormField
                      control={form.control}
                      name={`requiredHeaders.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter header name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`requiredHeaders.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter header value" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      const headers = form.getValues("requiredHeaders") || [];
                      form.setValue(
                        "requiredHeaders",
                        headers.filter((_, i) => i !== index)
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button type="submit">Save Trigger</Button>
      </form>
    </Form>
  );
} 