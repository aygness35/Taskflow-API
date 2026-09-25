import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from './access.service';
import { ResourceKind } from './decorators';
import { Role } from './enums';
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const resource = this.reflector.getAllAndOverride<{
      kind: ResourceKind;
      param: string;
    }>('resource', targets);
    if (!resource) return true;
    const req = ctx.switchToHttp().getRequest();
    const id = await new ParseUUIDPipe({ version: '4' }).transform(
      req.params[resource.param],
      { type: 'param' },
    );
    req.access = await this.access.resolve(resource.kind, id, req.user.sub);
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', targets);
    if (roles && !roles.includes(req.access.role))
      throw new ForbiddenException('Insufficient workspace role');
    return true;
  }
}
