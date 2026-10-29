/**
 * @deprecated Código huérfano de un diseño de schema anterior: asumía un
 * modelo `Role` en base de datos. En el schema real los roles son el enum
 * `RoleName` directamente en `User` (ver prisma/schema.prisma) — no hay una
 * tabla de roles que sembrar. El seed vigente es prisma/seed.ts.
 *
 * Se dejó como stub vacío porque esta sesión no tuvo acceso a shell en tu
 * máquina para borrar el archivo directamente. Puedes borrarlo cuando quieras:
 *   Remove-Item src\seed\seedRoles.ts
 */
export {};
