import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { TriggerConfigProps } from "../../(workflows)/(components)/triggers/types";
import { QueryCondition, QueryConditionSchema } from "../types";
import { Input } from "@/components/ui/input";

const databaseEvents = [
  {
    id: "record.created",
    label: "Record Created", 
    description: "Triggered when a new record is created",
  },
  {
    id: "record.updated",
    label: "Record Updated",
    description: "Triggered when a record is updated",
  },
  {
    id: "record.deleted",
    label: "Record Deleted",
    description: "Triggered when a record is deleted",
  },
] as const;

// Operator types for conditions
const operators = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less Than or Equal" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
  { value: "in", label: "In" },
  { value: "notIn", label: "Not In" }
] as const;

const databaseConfigSchema = z.object({
  table: z.string().min(1, "Table is required"),
  events: z.array(z.enum(databaseEvents.map(e => e.id) as [string, ...string[]])).min(1, "Select at least one event"),
  conditions: z.array(QueryConditionSchema).optional(),
});

type DatabaseConfigSchema = z.infer<typeof databaseConfigSchema>;

export function DatabaseConfig({ onSubmit, initialConfig }: TriggerConfigProps<DatabaseConfigSchema>) {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTableColumns, setSelectedTableColumns] = useState<string[]>([]);

  const form = useForm<DatabaseConfigSchema>({
    resolver: zodResolver(databaseConfigSchema),
    defaultValues: {
      table: (initialConfig?.table as string) || "",
      events: (initialConfig?.events as string[]) || ["record.created"],
      conditions: (initialConfig?.conditions as QueryCondition[]) || [],
    },
  });

  // Fetch available tables
  useEffect(() => {
    // TODO: Implement API call to fetch tables
    setTables(["users", "orders", "products"]);
  }, []);

  const table = form.watch("table")

  // Fetch table columns when table is selected
  useEffect(() => {
    if (table) {
      // TODO: Implement API call to fetch table columns
      setSelectedTableColumns(["id", "name", "email", "created_at"]);
    }
  }, [table]);

  const handleSubmit = (data: DatabaseConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="table"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database Table</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the table to monitor for changes
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="events"
          render={() => (
            <FormItem>
              <FormLabel>Events</FormLabel>
              <FormDescription>
                Select which database events should trigger this workflow
              </FormDescription>
              <Card>
                <CardContent className="pt-6">
                  {databaseEvents.map((event) => (
                    <FormField
                      key={event.id}
                      control={form.control}
                      name="events"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={event.id}
                            className="flex flex-row items-start space-x-3 space-y-0 mb-4 last:mb-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(event.id)}
                                onCheckedChange={(checked) => {
                                  const events = field.value || [];
                                  return checked
                                    ? field.onChange([...events, event.id])
                                    : field.onChange(events.filter((value) => value !== event.id));
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{event.label}</FormLabel>
                              <FormDescription>
                                {event.description}
                              </FormDescription>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Conditions (Optional)</h4>
              <p className="text-sm text-muted-foreground">
                Add conditions to filter which records trigger the workflow
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
                  { field: "", operator: "eq", value: null },
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
                      <FormLabel>Field</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a field" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedTableColumns.map((column) => (
                            <SelectItem key={column} value={column}>
                              {column}
                            </SelectItem>
                          ))}
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
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
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
                        <Input
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