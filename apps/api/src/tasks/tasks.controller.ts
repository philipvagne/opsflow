import { Controller, Post, Get, Patch, Delete, Param, Body, Req, UseGuards, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller()
export class TasksController {
  constructor(private tasksService: TasksService) {}

@UseGuards(JwtAuthGuard)
@Post('organizations/:orgId/projects/:projectId/tasks')
createTask(
  @Param('orgId') orgId: string,
  @Param('projectId') projectId: string,
  @Req() req: any,
  @Body() body: CreateTaskDto,
) {
  return this.tasksService.createTask(
    orgId,
    projectId,
    req.user.sub,
    body.title,
    body.description,
    body.dueDate,
  );
}

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks')
  getTasks(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.tasksService.getTasks(req.user.sub, projectId);
  }

  @UseGuards(JwtAuthGuard)
@Patch('tasks/:taskId')
updateTask(
  @Param('taskId') taskId: string,
  @Req() req: any,
  @Body() body: UpdateTaskDto,
) {
  return this.tasksService.updateTask(req.user.sub, taskId, body);
}

@UseGuards(JwtAuthGuard)
@Delete('tasks/:taskId')
deleteTask(
  @Param('taskId') taskId: string,
  @Req() req: any,
) {
  return this.tasksService.deleteTask(req.user.sub, taskId);
}

@UseGuards(JwtAuthGuard)
@Patch('tasks/:taskId/assign')
assignTask(
  @Param('taskId') taskId: string,
  @Req() req: any,
  @Body() body: any,
) {
  return this.tasksService.assignTask(
    req.user.sub,
    taskId,
    body.assigneeId,
  );
}

@UseGuards(JwtAuthGuard)
@Delete('tasks/:taskId/assign/:assigneeId')
removeAssignee(
  @Param('taskId') taskId: string,
  @Param('assigneeId') assigneeId: string,
  @Req() req: any,
) {
  return this.tasksService.removeAssignee(
    req.user.sub,
    taskId,
    assigneeId,
  );
}

@UseGuards(JwtAuthGuard)
@Get('tasks/my')
getMyTasks(
  @Req() req: any,
  @Query('status') status?: string,
  @Query('projectId') projectId?: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  return this.tasksService.getMyTasks(
    req.user.sub,
    status,
    projectId,
    Number(page) || 1,
    Number(limit) || 10,
  );
}

@UseGuards(JwtAuthGuard)
@Get('tasks/archived')
getArchivedTasks(@Req() req: any) {
  return this.tasksService.getArchivedTasks(req.user.sub);
}

@UseGuards(JwtAuthGuard)
@Patch('tasks/:taskId/archive')
archiveTask(
  @Param('taskId') taskId: string,
  @Req() req: any,
) {
  return this.tasksService.archiveTask(req.user.sub, taskId);
}

@UseGuards(JwtAuthGuard)
@Patch('tasks/:taskId/restore')
restoreTask(
  @Param('taskId') taskId: string,
  @Req() req: any,
) {
  return this.tasksService.restoreTask(req.user.sub, taskId);
}

@UseGuards(JwtAuthGuard)
@Get('tasks/:taskId/activity')
getTaskActivity(
  @Req() req: any,
  @Param('taskId') taskId: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  return this.tasksService.getTaskActivity(
    req.user.sub,
    taskId,
    Number(page) || 1,
    Number(limit) || 20,
  );
}

@UseGuards(JwtAuthGuard)
@Get('tasks/:taskId/updates')
getTaskUpdates(
  @Req() req: any,
  @Param('taskId') taskId: string,
) {
  return this.tasksService.getTaskUpdates(
    req.user.sub,
    taskId,
  );
}

@UseGuards(JwtAuthGuard)
@Post('tasks/:taskId/updates')
createTaskUpdate(
  @Req() req: any,
  @Param('taskId') taskId: string,
  @Body() body: { message?: string },
) {
  return this.tasksService.createTaskUpdate(
    req.user.sub,
    taskId,
    body.message,
  );
}

@UseGuards(JwtAuthGuard)
@Get('tasks/notifications')
getNotifications(@Req() req: any) {
  return this.tasksService.getNotifications(req.user.sub);
}

@UseGuards(JwtAuthGuard)
@Patch('notifications/:id/read')
markNotificationAsRead(
  @Req() req: any,
  @Param('id') id: string,
) {
  return this.tasksService.markNotificationAsRead(
    req.user.sub,
    id,
  );
}

@UseGuards(JwtAuthGuard)
@Delete('notifications/:id')
deleteNotification(
  @Req() req: any,
  @Param('id') id: string,
) {
  return this.tasksService.deleteNotification(
    req.user.sub,
    id,
  );
}

@UseGuards(JwtAuthGuard)
@Patch('tasks/notifications/mark-all-read')
markAllNotificationsAsRead(@Req() req: any) {
  return this.tasksService.markAllNotificationsAsRead(req.user.sub);
}
}
