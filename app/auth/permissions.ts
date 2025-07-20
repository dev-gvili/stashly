// Define permission types and roles
export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum Permission {
  // Workspace permissions
  CREATE_WORKSPACE = 'create:workspace',
  UPDATE_WORKSPACE = 'update:workspace',
  DELETE_WORKSPACE = 'delete:workspace',
  
  // Member permissions
  INVITE_MEMBER = 'invite:member',
  REMOVE_MEMBER = 'remove:member',
  UPDATE_MEMBER_ROLE = 'update:member:role',
  
  // File permissions
  CREATE_FILE = 'create:file',
  READ_FILE = 'read:file',
  UPDATE_FILE = 'update:file',
  DELETE_FILE = 'delete:file',
}

// Define permission mapping by role
export const rolePermissions: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission),
  [Role.ADMIN]: [
    Permission.UPDATE_WORKSPACE,
    Permission.INVITE_MEMBER,
    Permission.REMOVE_MEMBER,
    Permission.UPDATE_MEMBER_ROLE,
    Permission.CREATE_FILE,
    Permission.READ_FILE,
    Permission.UPDATE_FILE,
    Permission.DELETE_FILE,
  ],
  [Role.EDITOR]: [
    Permission.CREATE_FILE,
    Permission.READ_FILE,
    Permission.UPDATE_FILE,
    Permission.DELETE_FILE,
  ],
  [Role.VIEWER]: [
    Permission.READ_FILE,
  ],
}

