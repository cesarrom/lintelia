import { Button } from "@/components/ui/button";
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TriggerBuilder } from "@repo/fintivio/utilities";
import { useWorkflow } from "../../WorkflowContext";
import { useTrigger } from "../../nodes/TriggerContext";
import { TriggerInputsWrapper } from "../../nodes/TriggerInputsWrapper";

const userEvents = [
  {
    id: TriggerBuilder.Events.USER_SIGNUP,
    label: "User Sign Up",
    description: "Triggered when a new user signs up",
  },
  {
    id: TriggerBuilder.Events.USER_SIGNIN,
    label: "User Sign In",
    description: "Triggered when a user signs in",
  },
  {
    id: TriggerBuilder.Events.USER_DELETE,
    label: "User Account Deletion",
    description: "Triggered when a user deletes their account",
  },
] as const;

export function UsersConfig() {
  const { workflow } = useWorkflow();
  const { currentTrigger, save, setEditing: setIsEditing, editing: isEditing } = useTrigger();
  const [selectedEvent, setSelectedEvent] = useState<string>(
    currentTrigger?.action?.inputs?.eventName as string || TriggerBuilder.Events.USER_SIGNUP
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trigger = TriggerBuilder.fromJSON(currentTrigger)
      .description(`Trigger on ${selectedEvent} event`)
      .matchMessage(null as unknown as string)
      .matchCategory(TriggerBuilder.Categories.SECURITY)
      .matchSource(TriggerBuilder.Sources.AUTH)
      .matchMetadata(['metadata', 'eventName'], selectedEvent)
      .invokeWorkflow(workflow.id!, {
        ...(currentTrigger?.action?.inputs || {}),
        eventName: selectedEvent,
      })
      .build();

    save(trigger);
    setIsEditing(false);
  };

  return (
    <TriggerInputsWrapper>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <Label>Select Event</Label>
          <RadioGroup
            value={selectedEvent}
            onValueChange={(value) => setSelectedEvent(value as string)}
          >
            {userEvents.map((event) => (
              <div key={event.id} className="flex items-center space-x-2">
                <RadioGroupItem value={event.id} id={event.id} />
                <Label htmlFor={event.id}>{event.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Button type="submit">{isEditing ? 'Update' : 'Add'} Trigger</Button>
      </form>
    </TriggerInputsWrapper>
  );
} 