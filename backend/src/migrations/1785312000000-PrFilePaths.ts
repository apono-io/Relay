import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrFilePaths1785312000000 implements MigrationInterface {
  name = 'PrFilePaths1785312000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pull_requests" ADD "filePaths" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pull_requests" DROP COLUMN "filePaths"`,
    );
  }
}
