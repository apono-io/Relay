import { MigrationInterface, QueryRunner } from 'typeorm';

export class GithubIdentities1785234465800 implements MigrationInterface {
  name = 'GithubIdentities1785234465800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "github_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "personId" uuid NOT NULL, "login" character varying NOT NULL, "source" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2b0864e0cc0a4d1eb003b4c0614" UNIQUE ("login"), CONSTRAINT "PK_e3116d1d7351e3ffa8ac5deb5dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_320fd0321c66471154d4e8545a" ON "github_identities" ("personId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "github_identities" ADD CONSTRAINT "FK_320fd0321c66471154d4e8545a5" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "github_identities" ("personId", "login", "source") SELECT "id", "githubLogin", 'manual' FROM "people" WHERE "githubLogin" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_identities" DROP CONSTRAINT "FK_320fd0321c66471154d4e8545a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_320fd0321c66471154d4e8545a"`,
    );
    await queryRunner.query(`DROP TABLE "github_identities"`);
  }
}
