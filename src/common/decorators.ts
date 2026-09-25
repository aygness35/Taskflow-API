import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Role } from './enums';
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export type ResourceKind = 'workspace' | 'project' | 'task' | 'comment';
export const WorkspaceResource = (kind: ResourceKind, param = 'id') =>
  SetMetadata('resource', { kind, param });
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().user.sub,
);
export const CurrentAccess = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Access =>
    ctx.switchToHttp().getRequest().access,
);
export interface Access {
  workspaceId: string;
  userId: string;
  role: Role;
}
