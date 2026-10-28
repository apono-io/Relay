import { MigrationInterface, QueryRunner } from 'typeorm';

export class Teams1786200000000 implements MigrationInterface {
  name = 'Teams1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "leadPersonId" uuid, "leadThreshold" integer NOT NULL DEFAULT '2', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_teams_id" PRIMARY KEY ("id"), CONSTRAINT "FK_teams_lead" FOREIGN KEY ("leadPersonId") REFERENCES "people"("id") ON DELETE SET NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_teams_name" ON "teams" ("name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_teams_lead" ON "teams" ("leadPersonId")`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_members" ("personId" uuid NOT NULL, "teamId" uuid NOT NULL, CONSTRAINT "PK_team_members_person" PRIMARY KEY ("personId"), CONSTRAINT "FK_team_members_person" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE, CONSTRAINT "FK_team_members_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_team_members_team" ON "team_members" ("teamId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_team_members_team"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_teams_lead"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_teams_name"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
