'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ReviewsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assignedTo') || '');
  const [fromDate, setFromDate] = useState<Date | undefined>(
    searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined
  );
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [view, setView] = useState(searchParams.get('view') || 'all');

  useEffect(() => {
    setView(searchParams.get('view') || 'all');
    setStatus(searchParams.get('status') || '');
    setAssignedTo(searchParams.get('assignedTo') || '');
    setFromDate(searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined);
    setToDate(searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined);
  }, [searchParams]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (view) params.set('view', view);
    if (status) params.set('status', status);
    if (assignedTo) params.set('assignedTo', assignedTo);
    if (fromDate) params.set('fromDate', fromDate.toISOString().split('T')[0]);
    if (toDate) params.set('toDate', toDate.toISOString().split('T')[0]);
    
    router.push(`/reviews?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(`/reviews?view=${view}`);
  };

  const hasActiveFilters = assignedTo || fromDate || toDate || (status && view !== 'pending' && view !== 'in_progress' && view !== 'completed');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="additional_data_requested">Additional Data Requested</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Input
              id="assignedTo"
              placeholder="User ID or email"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromDate">From Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="fromDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="toDate">To Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="toDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
          <Button size="sm" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 