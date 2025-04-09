import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Submit Form Answers',
  description: 'Submit your answers for this form',
};

export default function NewAnswerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 