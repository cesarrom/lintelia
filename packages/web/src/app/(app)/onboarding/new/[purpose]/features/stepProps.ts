import { Observable } from "rxjs";

export type StepProps = {
  applicationId: number;
  onApplicationCreated: (applicationId: number) => void;
  onDone: (lastStep: number) => void;
  purpose: string;
  currentStep: number;
}