import {
  Controller,
  Get,
  Post,
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
  @Get(':orgId')
  getOrganization(
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    return this.organizationsService.getOrganization(
      orgId,
      req.user.sub,
    );
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
      body.email,
      body.role,
    );
  }

  @UseGuards(JwtAuthGuard)
@Post()
createOrganization(
  @Req() req: any,
  @Body() body: { name: string },
) {
  return this.organizationsService.createOrganization(
    req.user.sub,
    body.name,
  );
}
}
