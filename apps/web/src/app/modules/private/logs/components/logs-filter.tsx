'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useNavigate, useSearchParams } from 'react-router';
import { LogCategory, LogLevel } from '@repo/lintelia/schemas';

interface LogsFilterForm {
  search: string;
  level: string;
  category: string;
  acknowledged: string;
  startDate: Date | null;
  endDate: Date | null;
  view: string;
}

export default function LogsFilter() {
  const router = useNavigate();
  const [searchParams] = useSearchParams();

  // Initialize form with values from URL
  const form = useForm<LogsFilterForm>({
    defaultValues: {
      search: searchParams.get('search') || '',
      level: searchParams.get('level') || '',
      category: searchParams.get('category') || '',
      acknowledged: searchParams.get('acknowledged') || '',
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : null,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : null,
      view: searchParams.get('view') || 'analytics'
    }
  });

  // Update URL when form values change
  const updateUrl = (values: LogsFilterForm) => {
    const params = new URLSearchParams();

    // Always preserve the view parameter
    const currentView = searchParams.get('view') || 'analytics';
    params.set('view', currentView);

    // Only add parameters that have values
    if (values.search.toString().trim()) params.set('search', values.search.toString().trim());
    if (values.level.toString().trim()) params.set('level', values.level.toString().trim());
    if (values.category.toString().trim()) params.set('category', values.category.toString().trim());
    if (values.acknowledged.toString().trim()) params.set('acknowledged', values.acknowledged.toString().trim());
    if (values.startDate?.toISOString().trim()) params.set('startDate', values.startDate.toISOString().trim());
    if (values.endDate?.toISOString().trim()) {
      // Set to end of day for inclusive filtering
      const endOfDay = new Date(values.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      params.set('endDate', endOfDay.toISOString().trim());
    }

    router(`/logs?${params.toString()}`);
  };

  // Handle form submission
  const onSubmit = (values: LogsFilterForm) => {
    updateUrl(values);
  };

  // Update URL when form values change (debounced)
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Use setTimeout to debounce updates
      updateUrl(value as LogsFilterForm);

    });

    return () => subscription.unsubscribe();
  }, [form.watch]);

  const handleClearFilters = () => {
    form.reset({
      search: '',
      level: '',
      category: '',
      acknowledged: '',
      startDate: null,
      endDate: null,
      view: searchParams.get('view') || 'analytics'
    });

    // Keep only the view parameter
    const viewParam = searchParams.get('view') || 'analytics';
    router(`/logs?view=${viewParam}`);
  };

  const levels: LogLevel[] = ['info', 'warning', 'error', 'debug'];
  const categories: LogCategory[] = ['system', 'workflow', 'user', 'form', 'security', 'integration'];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="search"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Search logs..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=" ">All Levels</SelectItem>
                        {levels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=" ">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acknowledged"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=" ">All Status</SelectItem>
                        <SelectItem value="true">Acknowledged</SelectItem>
                        <SelectItem value="false">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Start Date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>End Date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
} 