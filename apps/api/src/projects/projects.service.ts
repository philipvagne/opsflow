import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProjectDto } from './dto/update-project.dto';


@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: orgId,
        userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed in this organization');
    }

    return membership;
  }

  private requireProjectManager(role: Role) {
    const projectManagerRoles: Role[] = [Role.OWNER, Role.ADMIN];

    if (!projectManagerRoles.includes(role)) {
      throw new ForbiddenException(
        'Only organization owners or admins can manage projects',
      );
    }
  }

  private async getTaskCounts(projectId: string) {
    const now = new Date();

    const [totalActive, done, overdue] = await Promise.all([
      this.prisma.task.count({
        where: {
          projectId,
          archivedAt: null,
        },
      }),
      this.prisma.task.count({
        where: {
          projectId,
          archivedAt: null,
          status: TaskStatus.DONE,
        },
      }),
      this.prisma.task.count({
        where: {
          projectId,
          archivedAt: null,
          status: {
            not: TaskStatus.DONE,
          },
          dueDate: {
            lt: now,
          },
        },
      }),
    ]);

    return {
      totalActive,
      done,
      overdue,
    };
  }

  private async withTaskCounts(project: any) {
    const [recentTask, recentNote] = await Promise.all([
      this.prisma.task.findFirst({
        where: {
          projectId: project.id,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          updatedAt: true,
        },
      }),
      this.prisma.note.findFirst({
        where: {
          projectId: project.id,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          updatedAt: true,
        },
      }),
    ]);

    const recentActivityAtTimestamp =
      [recentTask?.updatedAt, recentNote?.updatedAt]
        .filter(
          (value): value is NonNullable<typeof value> => value !== undefined,
        )
        .map((value) => value.getTime())
        .sort((left, right) => right - left)[0] ?? null;

    return {
      ...project,
      taskCounts: await this.getTaskCounts(project.id),
      recentActivityAt: recentActivityAtTimestamp
        ? new Date(recentActivityAtTimestamp)
        : null,
    };
  }

  async createProject(
    orgId: string,
    userId: string,
    name: string,
    description?: string,
  ) {
    const membership = await this.requireMembership(orgId, userId);
    this.requireProjectManager(membership.role);

    const trimmedName = name?.trim();

    if (!trimmedName) {
      throw new BadRequestException('Project name is required');
    }

    const project = await this.prisma.project.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        organizationId: orgId,
      },
    });

    return this.withTaskCounts(project);
  }

  async getProjects(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);

    const projects = await this.prisma.project.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Promise.all(
      projects.map((project) => this.withTaskCounts(project)),
    );
  }

  async getProjectById(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    await this.requireMembership(project.organizationId, userId);

    return this.withTaskCounts(project);
  }

  async updateProject(
    projectId: string,
    userId: string,
    body: UpdateProjectDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    const membership = await this.requireMembership(
      project.organizationId,
      userId,
    );
    this.requireProjectManager(membership.role);

    const data: { name?: string; description?: string | null } = {};

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();

      if (!trimmedName) {
        throw new BadRequestException('Project name is required');
      }

      data.name = trimmedName;
    }

    if (body.description !== undefined) {
      data.description = body.description.trim() || null;
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data,
    });

    return this.withTaskCounts(updatedProject);
  }
}
