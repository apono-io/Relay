import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReposAndAreaRules1785312100000 implements MigrationInterface {
  name = 'ReposAndAreaRules1785312100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "repos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_repos_name" UNIQUE ("name"), CONSTRAINT "PK_repos_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "area_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repo" character varying NOT NULL, "pattern" character varying NOT NULL, "area" character varying NOT NULL, "risk" integer NOT NULL DEFAULT '2', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_area_rules_repo_pattern" UNIQUE ("repo", "pattern"), CONSTRAINT "PK_area_rules_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_area_rules_repo" ON "area_rules" ("repo")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_area_rules_repo"`);
    await queryRunner.query(`DROP TABLE "area_rules"`);
    await queryRunner.query(`DROP TABLE "repos"`);
  }
}
