import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private taskListInclude() {
    return {
      project: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    } as const;
  }

  private getRecentActivityAt(task: {
    updatedAt: Date;
    notes?: { createdAt: Date }[];
    updates?: { createdAt: Date }[];
  }) {
    const timestamps = [
      task.updatedAt?.getTime() || 0,
      ...(task.notes || []).map((note) => new Date(note.createdAt).getTime()),
      ...(task.updates || []).map((update) =>
        new Date(update.createdAt).getTime(),
      ),
    ];

    const latestTimestamp = Math.max(...timestamps);
    return latestTimestamp ? new Date(latestTimestamp) : task.updatedAt;
  }

  private isRecentlyActive(recentActivityAt: Date | null) {
    if (!recentActivityAt) {
      return false;
    }

    return (
      recentActivityAt.getTime() >
      Date.now() - 1000 * 60 * 60 * 24
    );
  }

  private async getTaskUpdateRecipientIds(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    return memberships.map((membership) => membership.userId);
  }

  private async getTaskAssignedUserIds(taskId: string) {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { taskId },
      select: { userId: true },
    });

    return [...new Set(assignments.map((assignment) => assignment.userId))];
  }

  private async getTaskWithMembership(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed');
    }

    return task;
  }

  private async buildTaskPayloadForUser(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ...this.taskListInclude(),
        notes: {
          select: {
            id: true,
            createdAt: true,
            createdById: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        updates: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        noteReadStates: {
          where: {
            userId,
          },
          select: {
            lastSeenAt: true,
          },
          take: 1,
        },
      },
    });

    if (!task) {
      throw new ForbiddenException('Task not found after update');
    }

    const lastSeenAt = task.noteReadStates[0]?.lastSeenAt || null;
    const unreadNoteCount = task.notes.filter((note) => {
      if (note.createdById === userId) {
        return false;
      }

      if (!lastSeenAt) {
        return true;
      }

      return new Date(note.createdAt).getTime() > lastSeenAt.getTime();
    }).length;
    const recentNoteActivityAt = task.notes[0]?.createdAt || null;
    const recentActivityAt = this.getRecentActivityAt(task);

    return {
      task,
      payload: {
        taskId: task.id,
        status: task.status,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        archivedAt: task.archivedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        project: task.project,
        assignments: task.assignments,
        unreadNoteCount,
        hasUnreadNotes: unreadNoteCount > 0,
        recentNoteActivityAt,
        recentActivityAt,
        isRecentlyActive: this.isRecentlyActive(recentActivityAt),
      },
    };
  }

  private async emitTaskUpdatedForUsers(taskId: string, userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds)];

    for (const userId of uniqueUserIds) {
      const { payload } = await this.buildTaskPayloadForUser(taskId, userId);
      this.notificationsGateway.emitTaskUpdatedToUser(userId, payload);
    }
  }

  private async notifyAssignedUsersExceptActor(
    taskId: string,
    actorUserId: string,
    type: string,
    message: string,
  ) {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        taskId,
        userId: {
          not: actorUserId,
        },
      },
      select: {
        userId: true,
      },
    });

    const recipientIds = [
      ...new Set(assignments.map((assignment) => assignment.userId)),
    ];

    for (const recipientId of recipientIds) {
      const notification = await this.prisma.notification.create({
        data: {
          type,
          message,
          userId: recipientId,
          taskId,
        },
      });

      this.notificationsGateway.sendNotification(recipientId, {
        type,
        message,
        taskId,
        notificationId: notification.id,
      });
    }
  }

  private async getTaskUpdatePayload(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: this.taskListInclude(),
    });

    if (!task) {
      throw new ForbiddenException('Task not found after update');
    }

    return {
      task,
      payload: {
        taskId: task.id,
        status: task.status,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        archivedAt: task.archivedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        project: task.project,
        assignments: task.assignments,
        unreadNoteCount: 0,
        hasUnreadNotes: false,
        recentNoteActivityAt: null,
        recentActivityAt: task.updatedAt,
        isRecentlyActive: this.isRecentlyActive(task.updatedAt),
      },
    };
  }

  async markTaskNotesSeen(userId: string, taskId: string) {
    await this.getTaskWithMembership(taskId, userId);

    const readState = await this.prisma.taskNoteReadState.upsert({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
      update: {
        lastSeenAt: new Date(),
      },
      create: {
        taskId,
        userId,
        lastSeenAt: new Date(),
      },
    });

    const { payload } = await this.buildTaskPayloadForUser(taskId, userId);

    return {
      ...readState,
      unreadNoteCount: payload.unreadNoteCount,
      recentNoteActivityAt: payload.recentNoteActivityAt,
      recentActivityAt: payload.recentActivityAt,
    };
  }

  async createTask(
    orgId: string,
    projectId: string,
    userId: string,
    title: string,
    description?: string,
    dueDate?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed in this project');
    }

    return this.prisma.task.create({
      data: {
        title,
        description,
        projectId,
        createdById: userId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: this.taskListInclude(),
    });
  }

  async getTasks(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed in this project');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        ...this.taskListInclude(),
        notes: {
          select: {
            createdAt: true,
            createdById: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        updates: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        noteReadStates: {
          where: {
            userId,
          },
          select: {
            lastSeenAt: true,
          },
          take: 1,
        },
      },
    });

    return tasks.map((task) => {
      const lastSeenAt = task.noteReadStates[0]?.lastSeenAt || null;
      const unreadNoteCount = task.notes.filter((note) => {
        if (note.createdById === userId) {
          return false;
        }

        if (!lastSeenAt) {
          return true;
        }

        return new Date(note.createdAt).getTime() > lastSeenAt.getTime();
      }).length;
      const recentActivityAt = this.getRecentActivityAt(task);

      return {
        ...task,
        unreadNoteCount,
        hasUnreadNotes: unreadNoteCount > 0,
        recentNoteActivityAt: task.notes[0]?.createdAt || null,
        recentActivityAt,
        isRecentlyActive: this.isRecentlyActive(recentActivityAt),
      };
    });
  }

  async updateTask(userId: string, taskId: string, data: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed to update this task');
    }

    const updateData: Prisma.TaskUpdateInput = {
      ...data,
    };

    if ('dueDate' in data) {
      if (data.dueDate) {
        const nextDueDate = new Date(data.dueDate);

        if (Number.isNaN(nextDueDate.getTime())) {
          throw new BadRequestException('Invalid due date');
        }

        updateData.dueDate = nextDueDate;
      } else {
        updateData.dueDate = null;
      }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: this.taskListInclude(),
    });

    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    await this.emitTaskUpdatedForUsers(taskId, recipientIds);

    if (data.status && data.status !== task.status) {
      await this.prisma.activityLog.create({
        data: {
          action: 'TASK_STATUS_CHANGED',
          oldValue: task.status,
          newValue: data.status,
          userId,
          taskId: task.id,
        },
      });
    }

    if ('dueDate' in data) {
      const previousDueDate = task.dueDate?.getTime() ?? null;
      const nextDueDate = updatedTask.dueDate?.getTime() ?? null;

      if (previousDueDate !== nextDueDate) {
        let notificationType = 'TASK_DUE_DATE_CHANGED';
        let notificationMessage = `Due date changed on "${task.title}"`;

        if (!task.dueDate && updatedTask.dueDate) {
          notificationType = 'TASK_DUE_DATE_ADDED';
          notificationMessage = `Due date added to "${task.title}"`;
        }

        if (task.dueDate && !updatedTask.dueDate) {
          notificationType = 'TASK_DUE_DATE_CLEARED';
          notificationMessage = `Due date cleared on "${task.title}"`;
        }

        await this.notifyAssignedUsersExceptActor(
          task.id,
          userId,
          notificationType,
          notificationMessage,
        );
      }
    }

    const assignees = await this.prisma.taskAssignment.findMany({
      where: { taskId: task.id },
    });

    if (data.status && data.status !== task.status) {
      for (const assignee of assignees) {
        const notification = await this.prisma.notification.create({
          data: {
            type: 'TASK_STATUS_CHANGED',
            message: `Task "${task.title}" moved from ${task.status} to ${data.status}`,
            userId: assignee.userId,
            taskId: task.id,
          },
        });

        this.notificationsGateway.sendNotification(assignee.userId, {
          type: 'TASK_STATUS_CHANGED',
          message: `Task "${task.title}" moved from ${task.status} to ${data.status}`,
          taskId: task.id,
          notificationId: notification.id,
        });
      }
    }

    return updatedTask;
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed to delete this task');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { message: 'Task deleted successfully' };
  }

  async assignTask(userId: string, taskId: string, assigneeId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    if (!task.project) {
      throw new ForbiddenException('Task has no project attached');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed');
    }

    const assigneeMembership = await this.prisma.membership.findFirst({
      where: {
        userId: assigneeId,
        organizationId: task.project.organizationId,
      },
    });

    if (!assigneeMembership) {
      throw new ForbiddenException('Assignee is not in this organization');
    }

    const notification = await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.upsert({
        where: {
          taskId_userId: {
            taskId,
            userId: assigneeId,
          },
        },
        update: {},
        create: {
          taskId,
          userId: assigneeId,
        },
      });

      return tx.notification.create({
        data: {
          type: 'TASK_ASSIGNED',
          message: `You were assigned to "${task.title}"`,
          userId: assigneeId,
          taskId: task.id,
        },
      });
    });

    const { task: updatedTask } = await this.getTaskUpdatePayload(taskId);
    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    this.notificationsGateway.sendNotification(assigneeId, {
      type: 'TASK_ASSIGNED',
      message: `You were assigned to "${task.title}"`,
      taskId: task.id,
      notificationId: notification.id,
    });

    await this.emitTaskUpdatedForUsers(taskId, recipientIds);

    return updatedTask;
  }

  async removeAssignee(userId: string, taskId: string, assigneeId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed');
    }

    const notification = await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.deleteMany({
        where: {
          taskId,
          userId: assigneeId,
        },
      });

      return tx.notification.create({
        data: {
          type: 'TASK_UNASSIGNED',
          message: `You were removed from "${task.title}"`,
          userId: assigneeId,
          taskId: task.id,
        },
      });
    });

    const { task: updatedTask } = await this.getTaskUpdatePayload(taskId);

    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    this.notificationsGateway.sendNotification(assigneeId, {
      type: 'TASK_UNASSIGNED',
      message: `You were removed from "${task.title}"`,
      taskId: task.id,
      notificationId: notification.id,
    });

    await this.emitTaskUpdatedForUsers(taskId, [...recipientIds, assigneeId]);

    return updatedTask;
  }

  async getMyTasks(
    userId: string,
    status?: string,
    projectId?: string,
    page = 1,
    limit = 10,
  ) {
    const where: Prisma.TaskWhereInput = {
      archivedAt: null,
      assignments: {
        some: {
          userId,
        },
      },
    };

    if (status) {
      where.status = status as TaskStatus;
    }

    if (projectId) {
      where.projectId = projectId.trim();
    }

    const skip = (page - 1) * limit;

    const total = await this.prisma.task.count({ where });

    const tasks = await this.prisma.task.findMany({
      where,
      skip,
      take: limit,
      include: {
        ...this.taskListInclude(),
        notes: {
          select: {
            createdAt: true,
            createdById: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        updates: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        noteReadStates: {
          where: {
            userId,
          },
          select: {
            lastSeenAt: true,
          },
          take: 1,
        },
      },
    });

    return {
      data: tasks.map((task) => {
        const lastSeenAt = task.noteReadStates[0]?.lastSeenAt || null;
        const unreadNoteCount = task.notes.filter((note) => {
          if (note.createdById === userId) {
            return false;
          }

          if (!lastSeenAt) {
            return true;
          }

          return new Date(note.createdAt).getTime() > lastSeenAt.getTime();
        }).length;

        return {
          ...task,
          unreadNoteCount,
          hasUnreadNotes: unreadNoteCount > 0,
          recentNoteActivityAt: task.notes[0]?.createdAt || null,
          recentActivityAt: this.getRecentActivityAt(task),
          isRecentlyActive: this.isRecentlyActive(this.getRecentActivityAt(task)),
        };
      }),
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }

  async archiveTask(userId: string, taskId: string) {
    const task = await this.getTaskWithMembership(taskId, userId);

    if (task.status !== TaskStatus.DONE) {
      throw new BadRequestException('Only completed tasks can be archived');
    }

    if (task.archivedAt) {
      const { task: archivedTask } = await this.getTaskUpdatePayload(taskId);
      return archivedTask;
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'TASK_ARCHIVED',
        oldValue: null,
        newValue: 'ARCHIVED',
        userId,
        taskId,
      },
    });

    await this.notifyAssignedUsersExceptActor(
      taskId,
      userId,
      'TASK_ARCHIVED',
      `Task "${task.title}" was archived`,
    );

    const { task: archivedTask } = await this.getTaskUpdatePayload(taskId);
    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    await this.emitTaskUpdatedForUsers(taskId, recipientIds);

    return archivedTask;
  }

  async restoreTask(userId: string, taskId: string) {
    const task = await this.getTaskWithMembership(taskId, userId);

    if (!task.archivedAt) {
      const { task: restoredTask } = await this.getTaskUpdatePayload(taskId);
      return restoredTask;
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: null },
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'TASK_RESTORED',
        oldValue: 'ARCHIVED',
        newValue: null,
        userId,
        taskId,
      },
    });

    const { task: restoredTask } = await this.getTaskUpdatePayload(taskId);
    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    await this.emitTaskUpdatedForUsers(taskId, recipientIds);

    return restoredTask;
  }

  async getArchivedTasks(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        archivedAt: {
          not: null,
        },
        assignments: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        archivedAt: 'desc',
      },
      include: {
        ...this.taskListInclude(),
        notes: {
          select: {
            createdAt: true,
            createdById: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        updates: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        noteReadStates: {
          where: {
            userId,
          },
          select: {
            lastSeenAt: true,
          },
          take: 1,
        },
      },
    });

    return tasks.map((task) => {
      const lastSeenAt = task.noteReadStates[0]?.lastSeenAt || null;
      const unreadNoteCount = task.notes.filter((note) => {
        if (note.createdById === userId) {
          return false;
        }

        if (!lastSeenAt) {
          return true;
        }

        return new Date(note.createdAt).getTime() > lastSeenAt.getTime();
      }).length;

      return {
        ...task,
        unreadNoteCount,
        hasUnreadNotes: unreadNoteCount > 0,
        recentNoteActivityAt: task.notes[0]?.createdAt || null,
        recentActivityAt: this.getRecentActivityAt(task),
        isRecentlyActive: this.isRecentlyActive(this.getRecentActivityAt(task)),
      };
    });
  }

  async getTaskActivity(
    userId: string,
    taskId: string,
    page = 1,
    limit = 20,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: task.project.organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not allowed');
    }

    const skip = (page - 1) * limit;
    const total = await this.prisma.activityLog.count({
      where: { taskId },
    });

    const events = await this.prisma.activityLog.findMany({
      where: { taskId },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return {
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        oldValue: event.oldValue,
        newValue: event.newValue,
        createdAt: event.createdAt,
        user: event.user,
      })),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async getTaskUpdates(userId: string, taskId: string) {
    await this.getTaskWithMembership(taskId, userId);

    return this.prisma.taskUpdate.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async createTaskUpdate(userId: string, taskId: string, message?: string) {
    const trimmedMessage = message?.trim();

    if (!trimmedMessage) {
      throw new BadRequestException('Update message is required');
    }

    const task = await this.getTaskWithMembership(taskId, userId);

    const update = await this.prisma.taskUpdate.create({
      data: {
        taskId,
        userId,
        message: trimmedMessage,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
      },
    });

    const authorName =
      update.user.fullName || update.user.username || update.user.email;

    await this.notifyAssignedUsersExceptActor(
      taskId,
      userId,
      'TASK_UPDATE_POSTED',
      `${authorName} posted an update on "${task.title}"`,
    );

    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    await this.emitTaskUpdatedForUsers(taskId, recipientIds);
    this.notificationsGateway.emitTaskUpdateCreated(recipientIds, {
      taskId,
      update,
    });

    return update;
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ForbiddenException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not allowed');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
      },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ForbiddenException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not allowed');
    }

    if (!notification.isRead) {
      throw new ForbiddenException('Only read notifications can be deleted');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted successfully' };
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
}
