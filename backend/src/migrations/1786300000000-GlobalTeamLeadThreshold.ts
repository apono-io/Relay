import { MigrationInterface, QueryRunner } from 'typeorm';

// The lead threshold moves from each team to one setting for every team. The most common
// team value carries over; with no teams yet, the setting stays unset and reads as 2.
export class GlobalTeamLeadThreshold1786300000000 implements MigrationInterface {
  name = 'GlobalTeamLeadThreshold1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "app_settings" ("key", "value")
       SELECT 'assignment.teamLeadThreshold', to_jsonb(mode() WITHIN GROUP (ORDER BY "leadThreshold"))
       FROM "teams"
       HAVING COUNT(*) > 0
       ON CONFLICT ("key") DO NOTHING`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "leadThreshold"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "leadThreshold" integer NOT NULL DEFAULT '2'`,
    );
    await queryRunner.query(
      `UPDATE "teams" SET "leadThreshold" = ("value")::text::integer
       FROM "app_settings" WHERE "key" = 'assignment.teamLeadThreshold'`,
    );
    await queryRunner.query(
      `DELETE FROM "app_settings" WHERE "key" = 'assignment.teamLeadThreshold'`,
    );
  }
}
