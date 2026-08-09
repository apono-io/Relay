import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShadowAssignments1785570000000 implements MigrationInterface {
  name = 'ShadowAssignments1785570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suggestions" ADD "assignedLogin" character varying, ADD "assignedName" character varying, ADD "assignedAt" TIMESTAMP WITH TIME ZONE, ADD "assignedByPersonId" character varying, ADD "assignedTrigger" character varying, ADD "shadow" boolean`,
    );
    await queryRunner.query(
      `CREATE TABLE "person_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "personId" character varying NOT NULL, "assignmentMode" character varying NOT NULL DEFAULT 'off', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_person_settings_personId" UNIQUE ("personId"), CONSTRAINT "PK_person_settings_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "app_settings" ("key" character varying NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_app_settings_key" PRIMARY KEY ("key"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_settings"`);
    await queryRunner.query(`DROP TABLE "person_settings"`);
    await queryRunner.query(
      `ALTER TABLE "suggestions" DROP COLUMN "shadow", DROP COLUMN "assignedTrigger", DROP COLUMN "assignedByPersonId", DROP COLUMN "assignedAt", DROP COLUMN "assignedName", DROP COLUMN "assignedLogin"`,
    );
  }
}
