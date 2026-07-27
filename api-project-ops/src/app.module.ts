import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AccessModule } from './access/access.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IncidentsModule } from './incidents/incidents.module';
import { ModulesCatalogModule } from './modules-catalog/modules-catalog.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PlansModule } from './plans/plans.module';
import { PrioritiesModule } from './priorities/priorities.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { ProjectTypesModule } from './project-types/project-types.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { TicketStatusModule } from './ticket-status/ticket-status.module';
import { UsersModule } from './users/users.module';
import { WorkspaceMembersModule } from './workspace-members/workspace-members.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    WorkspaceMembersModule,
    RolesModule,
    PermissionsModule,
    PlansModule,
    ProjectsModule,
    ProjectMembersModule,
    ModulesCatalogModule,
    TasksModule,
    TicketStatusModule,
    PrioritiesModule,
    ProjectTypesModule,
    SettingsModule,
    AccessModule,
    AttachmentsModule,
    IncidentsModule,
    CommentsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // JWT auth is on by default; @Public() opts a route out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
