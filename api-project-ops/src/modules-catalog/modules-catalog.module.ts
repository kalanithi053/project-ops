import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModuleInstancesController } from './module-instances.controller';
import { ModulesService } from './modules.service';
import { ModuleInstancesService } from './module-instances.service';

@Module({
  controllers: [ModulesController, ModuleInstancesController],
  providers: [ModulesService, ModuleInstancesService],
  exports: [ModulesService, ModuleInstancesService],
})
export class ModulesCatalogModule {}
