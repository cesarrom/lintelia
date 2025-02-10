import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TriggerConfigProps } from "../types";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { RoleSelect } from "@/components/role-select";

const userEvents = [
  {
    id: "user.signup",
    label: "User Sign Up",
    description: "Triggered when a new user signs up",
  },
  {
    id: "user.signin",
    label: "User Sign In",
    description: "Triggered when a user signs in",
  },
  {
    id: "user.delete",
    label: "User Account Deletion",
    description: "Triggered when a user deletes their account",
  },
] as const;

const usersConfigSchema = z.object({
  events: z.array(z.enum(userEvents.map(e => e.id) as [string, ...string[]])).min(1, "Select at least one event"),
  userRoles: z.array(z.string()).optional(),
});

type UsersConfigSchema = z.infer<typeof usersConfigSchema>;

export function UsersConfig({ onSubmit, initialConfig }: TriggerConfigProps) {
  const form = useForm<UsersConfigSchema>({
    resolver: zodResolver(usersConfigSchema),
    defaultValues: {
      events: (initialConfig?.events as string[]) || ["user.signup"],
      userRoles: (initialConfig?.userRoles as string[]) || [],
    },
  });

  const handleSubmit = (data: UsersConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="events"
          render={() => (
            <FormItem>
              <FormLabel>Events</FormLabel>
              <FormDescription>
                Select which user events should trigger this workflow
              </FormDescription>
              <Card>
                <CardContent className="pt-6">
                  {userEvents.map((event) => (
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

        <FormField
          control={form.control}
          name="userRoles"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User Roles (Optional)</FormLabel>
              <FormControl>
                <RoleSelect
                  value={field.value}
                  onChange={field.onChange}
                  multiple
                />
              </FormControl>
              <FormDescription>
                Only trigger for users with these roles. Leave empty to trigger for all users.
              </FormDescription>
            </FormItem>
          )}
        />

        <Button type="submit">Save Trigger</Button>
      </form>
    </Form>
  );
} 