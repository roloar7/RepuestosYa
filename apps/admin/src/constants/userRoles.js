export const USER_ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
}

export const USER_ROLE_LABELS = {
  [USER_ROLES.ADMIN]: "Administrador",
  [USER_ROLES.OPERATOR]: "Operador",
  [USER_ROLES.VIEWER]: "Solo lectura",
}

export const DEFAULT_USER_ROLE = USER_ROLES.VIEWER
