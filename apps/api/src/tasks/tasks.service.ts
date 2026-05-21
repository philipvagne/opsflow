import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TaskStatus } from '@prisma/client';
import { UpdateTaskDto } from './dto/update-task.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class TasksService {
  constructor(
  private prisma: PrismaService,
  private notificationsGateway: NotificationsGateway,
) {}

private async getTaskUpdateRecipientIds(organizationId: string) {
  const memberships = await this.prisma.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });

  return memberships.map((membership) => membership.userId);
}

private async getTaskUpdatePayload(taskId: string) {
  const task = await this.prisma.task.findUnique({
    where: { id: taskId },
    include: {
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
    },
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
      dueDate: task.dueDate,
      assignments: task.assignments,
    },
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

    return this.prisma.task.findMany({
      where: { projectId },
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
      const dueDate = new Date(data.dueDate);

      if (Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid due date');
      }

      updateData.dueDate = dueDate;
    } else {
      updateData.dueDate = null;
    }
  }

  const updatedTask = await this.prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
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
    },
  });

    const recipientIds = await this.getTaskUpdateRecipientIds(
      task.project.organizationId,
    );

    this.notificationsGateway.emitTaskUpdated(recipientIds, {
      taskId: updatedTask.id,
      status: updatedTask.status,
      title: updatedTask.title,
      dueDate: updatedTask.dueDate,
      assignments: updatedTask.assignments,
    });


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


const assignees = await this.prisma.taskAssignment.findMany({
  where: { taskId: task.id },
});

if (data.status && data.status !== task.status) {
  for (const a of assignees) {
    const notification = await this.prisma.notification.create({
      data: {
        type: 'TASK_STATUS_CHANGED',
        message: `Task "${task.title}" moved from ${task.status} to ${data.status}`,
        userId: a.userId,
        taskId: task.id,
      },
    });

    this.notificationsGateway.sendNotification(a.userId, {
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

  const { task: updatedTask, payload } = await this.getTaskUpdatePayload(taskId);
  const recipientIds = await this.getTaskUpdateRecipientIds(
    task.project.organizationId,
  );

  this.notificationsGateway.sendNotification(assigneeId, {
    type: 'TASK_ASSIGNED',
    message: `You were assigned to "${task.title}"`,
    taskId: task.id,
    notificationId: notification.id,
  });

  this.notificationsGateway.emitTaskUpdated(recipientIds, payload);

  return updatedTask;
}

async removeAssignee(
  userId: string,
  taskId: string,
  assigneeId: string,
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

  const { task: updatedTask, payload } = await this.getTaskUpdatePayload(taskId);

  const recipientIds = await this.getTaskUpdateRecipientIds(
    task.project.organizationId,
  );

  this.notificationsGateway.sendNotification(assigneeId, {
    type: 'TASK_UNASSIGNED',
    message: `You were removed from "${task.title}"`,
    taskId: task.id,
    notificationId: notification.id,
  });

  this.notificationsGateway.emitTaskUpdated(
    [...recipientIds, assigneeId],
    payload,
  );

  return updatedTask;
}


async getMyTasks(userId: string, status?: string, projectId?: string, page = 1, limit = 10) {

  const where: Prisma.TaskWhereInput = {
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
    },
  });

  return {
    data: tasks,
    total,
    page,
    limit,
    lastPage: Math.ceil(total / limit),
  };
}

async getTaskActivity(
  userId: string,
  taskId: string,
  page: number = 1,
  limit: number = 20,
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
  events: events.map(event => ({
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

async getNotifications(userId: string) {
  return this.prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

async markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
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

async deleteNotification(
  userId: string,
  notificationId: string,
) {
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
