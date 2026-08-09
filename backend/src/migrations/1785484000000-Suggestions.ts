import { MigrationInterface, QueryRunner } from 'typeorm';

export class Suggestions1785484000000 implements MigrationInterface {
  name = 'Suggestions1785484000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "suggestions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "prId" character varying NOT NULL, "repo" character varying NOT NULL, "prNumber" integer NOT NULL, "area" character varying, "risk" integer NOT NULL, "picks" jsonb NOT NULL DEFAULT '[]', "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "actualLogins" text array NOT NULL DEFAULT '{}', "matched" boolean, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_suggestions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_suggestions_prId" ON "suggestions" ("prId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_suggestions_repo" ON "suggestions" ("repo")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_suggestions_repo"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_suggestions_prId"`);
    await queryRunner.query(`DROP TABLE "suggestions"`);
  }
}
