import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TriggerConfigProps } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

const transactionsConfigSchema = z.object({
  userId: z.string().optional(),
  accountId: z.string().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  currency: z.string().optional(),
  type: z.enum(["credit", "debit", "both"]).optional(),
  status: z.enum(["pending", "completed", "failed"]).optional(),
});

type TransactionsConfigSchema = z.infer<typeof transactionsConfigSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function TransactionsConfig({ onSubmit, initialConfig }: TriggerConfigProps<TransactionsConfigSchema>) {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  const form = useForm<TransactionsConfigSchema>({
    resolver: zodResolver(transactionsConfigSchema),
    defaultValues: {
      userId: initialConfig?.userId || "",
      accountId: initialConfig?.accountId || "",
      minAmount: initialConfig?.minAmount,
      maxAmount: initialConfig?.maxAmount,
      currency: initialConfig?.currency || "",
      type: initialConfig?.type || "both",
      status: initialConfig?.status || "completed",
    },
  });

  // Fetch available users
  useEffect(() => {
    // TODO: Implement API call to fetch users
    setUsers([
      { id: "user1", name: "John Doe", email: "john@example.com" },
      { id: "user2", name: "Jane Smith", email: "jane@example.com" },
    ]);
  }, []);

  // Fetch available accounts
  useEffect(() => {
    // TODO: Implement API call to fetch accounts
    setAccounts([
      { id: "acc1", name: "Main Account", type: "checking" },
      { id: "acc2", name: "Savings Account", type: "savings" },
    ]);
  }, []);

  // Fetch available currencies
  useEffect(() => {
    // TODO: Implement API call to fetch supported currencies
    setCurrencies(["USD", "EUR", "GBP"]);
  }, []);

  const handleSubmit = (data: TransactionsConfigSchema) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6 grid gap-6">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Any User</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose a specific user or leave empty to trigger for any user
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Any Account</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose a specific account or leave empty to trigger for any account
                  </FormDescription>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Enter minimum amount"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Enter maximum amount"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Any Currency</SelectItem>
                      {currencies.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose a specific currency or leave empty to trigger for any currency
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="both">Both Credit & Debit</SelectItem>
                      <SelectItem value="credit">Credit Only</SelectItem>
                      <SelectItem value="debit">Debit Only</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit">Save Trigger</Button>
      </form>
    </Form>
  );
} 