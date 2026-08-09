import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignmentExplanations1785660000000 implements MigrationInterface {
  name = 'AssignmentExplanations1785660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suggestions" ADD "assignedReason" character varying, ADD "assignedSignals" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suggestions" DROP COLUMN "assignedSignals", DROP COLUMN "assignedReason"`,
    );
  }
}
