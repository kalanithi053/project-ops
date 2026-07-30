import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PlansModule } from '../plans/plans.module';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspaceMembersService } from './workspace-members.service';

@Module({
  imports: [PlansModule, MailModule],
  controllers: [WorkspaceMembersController],
  providers: [WorkspaceMembersService],
  exports: [WorkspaceMembersService],
})
export class WorkspaceMembersModule {}
