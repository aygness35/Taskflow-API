import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginated, pagination } from '../common/pagination.dto';
import { CreateProjectDto, ListProjectsDto, UpdateProjectDto } from './dto/project.dto';
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  create(workspaceId: string, dto: CreateProjectDto) { return this.prisma.project.create({ data: { ...dto, workspaceId } }); }
  async list(workspaceId: string, q: ListProjectsDto) {
    const where = { workspaceId, status: q.status };
    const [data, total] = await this.prisma.$transaction([this.prisma.project.findMany({ where, ...pagination(q), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }), this.prisma.project.count({ where })]);
    return paginated(data, total, q);
  }
  get(id: string) { return this.prisma.project.findUniqueOrThrow({ where: { id } }); }
  update(id: string, dto: UpdateProjectDto) { return this.prisma.project.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.prisma.project.delete({ where: { id } }); }
}
