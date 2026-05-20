import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}
  async getOrganization(orgId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: orgId,
        userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not belong to this organization',
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: orgId,
      },
    });

    return organization;
  }
  async addMember(
  userId: string,
  orgId: string,
  email: string,
  role: string = 'MEMBER',
) {
  const organization = await this.prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!organization) {
    throw new ForbiddenException('Organization not found');
  }

  const membership = await this.prisma.membership.findFirst({
    where: {
      userId,
      organizationId: orgId,
    },
  });

  if (!membership) {
    throw new ForbiddenException('Not allowed');
  }

  const userToAdd = await this.prisma.user.findUnique({
    where: { email },
  });

  if (!userToAdd) {
    throw new ForbiddenException('User not found');
  }

  const existingMembership = await this.prisma.membership.findFirst({
    where: {
      userId: userToAdd.id,
      organizationId: orgId,
    },
  });

  if (existingMembership) {
    throw new ForbiddenException('User already in organization');
  }

  return this.prisma.membership.create({
    data: {
      userId: userToAdd.id,
      organizationId: orgId,
      role: role as any,
    },
  });
}

async createOrganization(userId: string, name: string) {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const organization = await this.prisma.organization.create({
    data: {
      name,
      slug,
    },
  });

  await this.prisma.membership.create({
    data: {
      userId,
      organizationId: organization.id,
      role: 'OWNER',
    },
  });

  return organization;
}
}