import { Observable } from "rxjs";

export type StepProps = {
  applicationId: number;
  onApplicationCreated: (applicationId: number) => void;
  onDone: () => void;
  purpose: string;
}