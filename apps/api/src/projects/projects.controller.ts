import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // 🟢 CREATE PROJECT
  @UseGuards(JwtAuthGuard)
  @Post('organizations/:orgId/projects')
  createProject(
    @Param('orgId') orgId: string,
    @Req() req: any,
    @Body() body: CreateProjectDto,
  ) {
    return this.projectsService.createProject(
      orgId,
      req.user.sub,
      body.name,
      body.description,
    );
  }

  // 🔵 GET ALL PROJECTS
  @UseGuards(JwtAuthGuard)
  @Get('organizations/:orgId/projects')
  getProjects(
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    return this.projectsService.getProjects(
      orgId,
      req.user.sub,
    );
  }

  // 🟣 GET SINGLE PROJECT
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId')
  getProjectById(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.projectsService.getProjectById(
      projectId,
      req.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('projects/:projectId')
  updateProject(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(
      projectId,
      req.user.sub,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/members')
  addProjectMember(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: { membershipId?: string },
  ) {
    return this.projectsService.addProjectMember(
      projectId,
      req.user.sub,
      body.membershipId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId')
  deleteProject(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.projectsService.deleteProject(
      projectId,
      req.user.sub,
    );
  }
}
