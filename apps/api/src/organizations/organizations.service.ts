import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  private readonly manageableRoles: Role[] = [Role.OWNER, Role.ADMIN];
  private readonly assignableRoles = [
    Role.ADMIN,
    Role.MEMBER,
    Role.VIEWER,
  ] as Role[];

  private slugify(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'organization'
    );
  }

  private async getAvailableSlug(baseSlug: string) {
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.organization.findUnique({
        where: { slug },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async requireMembership(userId: string, orgId: string) {
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

    return membership;
  }

  private memberSelect() {
    return {
      id: true,
      email: true,
      username: true,
      fullName: true,
    } as const;
  }

  async getMyOrganizations(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role,
    }));
  }

  async getOrganization(orgId: string, userId: string) {
    await this.requireMembership(userId, orgId);

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: orgId,
      },
    });

    return organization;
  }

  async getMembers(orgId: string, userId: string) {
    await this.requireMembership(userId, orgId);

    const members = await this.prisma.membership.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        user: {
          select: this.memberSelect(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((membership) => ({
      id: membership.id,
      role: membership.role,
      createdAt: membership.createdAt,
      user: membership.user,
    }));
  }

  async addMember(
    userId: string,
    orgId: string,
    emailOrUsername?: string,
    role: string = Role.MEMBER,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.requireMembership(userId, orgId);

    if (!this.manageableRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Only organization owners or admins can add members',
      );
    }

    const normalizedRole = role as Role;

    if (!this.assignableRoles.includes(normalizedRole)) {
      throw new BadRequestException('Invalid organization role');
    }

    const lookup = emailOrUsername?.trim();

    if (!lookup) {
      throw new BadRequestException('Email or username is required');
    }

    const userToAdd = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lookup }, { username: lookup }],
      },
      select: this.memberSelect(),
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found');
    }

    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        userId: userToAdd.id,
        organizationId: orgId,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User already belongs to this organization');
    }

    const createdMembership = await this.prisma.membership.create({
      data: {
        userId: userToAdd.id,
        organizationId: orgId,
        role: normalizedRole,
      },
      include: {
        user: {
          select: this.memberSelect(),
        },
      },
    });

    return {
      id: createdMembership.id,
      role: createdMembership.role,
      createdAt: createdMembership.createdAt,
      user: createdMembership.user,
    };
  }

  async removeMember(userId: string, orgId: string, membershipId?: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!membershipId?.trim()) {
      throw new BadRequestException('Organization member selection is required');
    }

    const requesterMembership = await this.requireMembership(userId, orgId);

    if (!this.manageableRoles.includes(requesterMembership.role)) {
      throw new ForbiddenException(
        'Only organization owners or admins can manage members',
      );
    }

    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        user: {
          select: this.memberSelect(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const targetMembership = memberships.find(
      (membership) => membership.id === membershipId,
    );

    if (!targetMembership) {
      throw new BadRequestException('Member is not part of this organization');
    }

    const manageableMemberships = memberships.filter((membership) =>
      this.manageableRoles.includes(membership.role),
    );

    if (
      this.manageableRoles.includes(targetMembership.role) &&
      manageableMemberships.length <= 1
    ) {
      throw new BadRequestException(
        'This organization needs at least one owner or admin',
      );
    }

    await this.prisma.membership.delete({
      where: {
        id: membershipId,
      },
    });

    return {
      id: targetMembership.id,
      role: targetMembership.role,
      createdAt: targetMembership.createdAt,
      user: targetMembership.user,
    };
  }

  async createOrganization(
    userId: string,
    name: string,
    requestedSlug?: string,
  ) {
    const trimmedName = name?.trim();

    if (!trimmedName) {
      throw new BadRequestException('Organization name is required');
    }

    const baseSlug = this.slugify(requestedSlug || trimmedName);
    const slug = await this.getAvailableSlug(baseSlug);

    const organization = await this.prisma.organization.create({
      data: {
        name: trimmedName,
        slug,
      },
    });

    await this.prisma.membership.create({
      data: {
        userId,
        organizationId: organization.id,
        role: Role.OWNER,
      },
    });

    return {
      ...organization,
      role: Role.OWNER,
    };
  }
}
