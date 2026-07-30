-- DropForeignKey
ALTER TABLE "work_item" DROP CONSTRAINT "work_item_module_instance_id_fkey";

-- AlterTable
ALTER TABLE "work_item" ALTER COLUMN "module_instance_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_module_instance_id_fkey" FOREIGN KEY ("module_instance_id") REFERENCES "module_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
