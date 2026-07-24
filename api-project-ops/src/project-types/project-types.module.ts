import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { ProjectTypesController } from './project-types.controller';
import { ProjectTypesService } from './project-types.service';

@Module({
  imports: [PlansModule],
  controllers: [ProjectTypesController],
  providers: [ProjectTypesService],
  exports: [ProjectTypesService],
})
export class ProjectTypesModule {}
