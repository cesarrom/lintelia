export type ModuleAction = {
  id: string;
  name: string;
  description: string;
};

export type AppModule = {
  id: string;
  name: string;
  description: string;
  actions: ModuleAction[];
};

export type Permission = {
  moduleId: string;
  actions: string[]; // Array of action IDs
};

export type RolePermissions = {
  [moduleId: string]: string[]; // moduleId -> array of action IDs
};

// Type for checking permissions in components
export type PermissionCheck = {
  module: string;
  action: string;
}; 