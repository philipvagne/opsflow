import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyOrganizations(@Req() req: any) {
    return this.organizationsService.getMyOrganizations(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrganization(
    @Req() req: any,
    @Body() body: { name: string; slug?: string },
  ) {
    return this.organizationsService.createOrganization(
      req.user.sub,
      body.name,
      body.slug,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orgId/members')
  getMembers(@Param('orgId') orgId: string, @Req() req: any) {
    return this.organizationsService.getMembers(orgId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':orgId/members')
  addMember(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.organizationsService.addMember(
      req.user.sub,
      orgId,
      body.emailOrUsername || body.email,
      body.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':orgId/members/:membershipId')
  removeMember(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizationsService.removeMember(
      req.user.sub,
      orgId,
      membershipId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orgId')
  getOrganization(@Param('orgId') orgId: string, @Req() req: any) {
    return this.organizationsService.getOrganization(orgId, req.user.sub);
  }
}
