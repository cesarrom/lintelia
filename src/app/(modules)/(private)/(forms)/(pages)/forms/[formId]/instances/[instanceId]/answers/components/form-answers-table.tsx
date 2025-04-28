'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, MessageSquare } from 'lucide-react';
import { FormConfig } from '@/app/(modules)/(private)/(forms)/(components)/form-builder/schemas';
import { useFormAnswers } from '../hooks/use-form-answers';
import { useRouter } from 'next/navigation';
import type { FormAnswer } from '@/lib/entities';

interface FormAnswersTableProps {
  formId: string;
  instanceId: string;
  formConfig: FormConfig;
}

export function FormAnswersTable({ formId, instanceId, formConfig }: FormAnswersTableProps) {
  const router = useRouter();
  const { answers, isLoading } = useFormAnswers(formId, instanceId);

  const handleViewAnswer = (answerId: string) => {
    router.push(`/forms/${formId}/instances/${instanceId}/answers/${answerId}`);
  };

  const handleCreateReview = (answerId: string) => {
    router.push(`/reviews/new?formId=${formId}&instanceId=${instanceId}&answerId=${answerId}`);
  };

  const getFieldLabel = (fieldId: string): string => {
    const component = formConfig.components.find(
      component => component.id === fieldId
    );
    return ((component?.config as any)?.label as string) || fieldId;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Answer</TableHead>
          <TableHead>Submitted By</TableHead>
          <TableHead>Submitted At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {answers.map((answer: FormAnswer) => (
          <TableRow key={answer.id}>
            <TableCell>{getFieldLabel(answer.fieldId)}</TableCell>
            <TableCell className="max-w-md truncate">
              {typeof answer.value === 'string' ? answer.value : JSON.stringify(answer.value)}
            </TableCell>
            <TableCell>{answer.createdBy}</TableCell>
            <TableCell>{new Date(answer.createdAt).toLocaleString()}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleViewAnswer(answer.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCreateReview(answer.id)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Create Review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 