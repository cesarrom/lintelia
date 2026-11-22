'use client';

import { XIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState } from "react";

export type InviteeListValue<T> = {
  [email: string]: T;
}
export function InviteeList<K extends Array<any>>(props: { title: string, values: K, onChange: (val: InviteeListValue<K[number]>) => unknown, value?: InviteeListValue<K[number]>, disabled?: boolean }) {
  const [currentEmail, setCurrentEmail] = useState<string>('');
  return <Card>
    <CardHeader>
      <CardTitle>{props.title}</CardTitle>
      <CardDescription>
        <div className="flex items-center space-x-2">
          <Input type="email" placeholder="Add email" disabled={!!props.disabled} name="currentEmail" onChange={e => setCurrentEmail(e.target.value)} value={currentEmail} />
          <Button variant="outline" type="button" disabled={props.disabled} onClick={() => {
            props.onChange({
              ...(props.value || {}),
              [currentEmail]: props.values[0],

            })
            setCurrentEmail('');
          }}>Add</Button>
        </div>
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {
        Object.entries(props.value || {}).map(([email, role], index) => {
          const person = { email, role };
          const initials = person.email.split('@')[0].slice(0, 2).toUpperCase();
          // externalize these values and add the roles and permissions from the document received
          const roles = Object.fromEntries(props.values.map((value) => [value, value]));

          return (
            <div className="flex items-center space-x-4" key={person.email}>
              <Avatar>
                <AvatarImage src="/placeholder-user.jpg" alt={person.email} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{person.email}</p>
              </div>
              <Select
                name={`invitee.${index}.role`}
                value={person.role}
                onValueChange={(value) => {
                  props.onChange({
                    ...(props.value || {}),
                    [person.email]: value,
                  });
                }}
                disabled={!!props.disabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roles).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {String(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                type="button"
                onClick={() => {
                  const obj = Object.assign({}, props.value || {});
                  delete obj[person.email];
                  props.onChange(obj);
                }}
                disabled={!!props.disabled}
              >
                <XIcon className="w-4 h-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          );
        })
      }
    </CardContent>
  </Card>
}