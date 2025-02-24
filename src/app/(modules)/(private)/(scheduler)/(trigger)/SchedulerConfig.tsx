import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TriggerConfigProps } from "../../(workflows)/(components)/triggers/types";

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
] as const;

const schedulerConfigSchema = z.object({
  schedule: z.string().min(1, "Schedule is required"),
  timezone: z.enum(timezones),
});

type SchedulerConfigSchema = z.infer<typeof schedulerConfigSchema>;

export function SchedulerConfig({ onSubmit, initialConfig }: TriggerConfigProps) {
  const form = useForm<SchedulerConfigSchema>({
    resolver: zodResolver(schedulerConfigSchema),
    defaultValues: {
      schedule: (initialConfig?.schedule as string) || "0 0 * * *",
      timezone: (initialConfig?.timezone as SchedulerConfigSchema["timezone"]) || "UTC",
    },
  });

  const handleSubmit = (data: SchedulerConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="schedule"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Schedule (Cron Expression)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="0 0 * * *" />
              </FormControl>
              <FormDescription>
                Enter a cron expression to define when the workflow should be triggered.
                For example, {`"0 0 * * *"`} means daily at midnight.
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a timezone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timezones.map((timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the timezone for the schedule.
              </FormDescription>
            </FormItem>
          )}
        />

        <Button type="submit">Save Trigger</Button>
      </form>
    </Form>
  );
} 