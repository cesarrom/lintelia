import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface RoleSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RoleSelect({ value, onChange, placeholder = "Select a role", disabled }: RoleSelectProps) {
  const [roles, setRoles] = useState<Role[]>([]);

  // Fetch available roles
  useEffect(() => {
    // TODO: Implement API call to fetch roles
    setRoles([
      { id: "admin", name: "Administrator", description: "Full system access" },
      { id: "user", name: "User", description: "Standard user access" },
      { id: "guest", name: "Guest", description: "Limited access" },
    ]);
  }, []);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem
            key={role.id}
            value={role.id}
            title={role.description}
          >
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 