import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1783433673150 implements MigrationInterface {
    name = 'InitialSchema1783433673150'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "pr_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "prId" uuid NOT NULL, "type" character varying NOT NULL, "actorLogin" character varying, "payload" jsonb, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "source" character varying NOT NULL, "externalId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5895e78736c6e01522203db83d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e814453dd9419be9fe450f0805" ON "pr_events" ("prId") `);
        await queryRunner.query(`CREATE INDEX "IDX_612a08fe14b461f989e838c1a5" ON "pr_events" ("occurredAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_23bc8f04b8e5b5b5ba801782db" ON "pr_events" ("externalId") `);
        await queryRunner.query(`CREATE TABLE "pull_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repo" character varying NOT NULL, "number" integer NOT NULL, "title" character varying NOT NULL, "url" character varying NOT NULL, "size" character varying, "authorLogin" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'open', "isDraft" boolean NOT NULL DEFAULT false, "firstCommitAt" TIMESTAMP WITH TIME ZONE, "openedAt" TIMESTAMP WITH TIME ZONE, "readyAt" TIMESTAMP WITH TIME ZONE, "firstReviewAt" TIMESTAMP WITH TIME ZONE, "approvedAt" TIMESTAMP WITH TIME ZONE, "lastCommitAt" TIMESTAMP WITH TIME ZONE, "mergedAt" TIMESTAMP WITH TIME ZONE, "closedAt" TIMESTAMP WITH TIME ZONE, "codingTime" double precision, "pickupTime" double precision, "reworkTime" double precision, "mergeTime" double precision, "cycleTime" double precision, "leadTime" double precision, "reviewerWaitTime" double precision, "authorWaitTime" double precision, "reworkCycles" integer NOT NULL DEFAULT '0', "isRevert" boolean NOT NULL DEFAULT false, "isBot" boolean NOT NULL DEFAULT false, "reviewCommentCount" integer NOT NULL DEFAULT '0', "approvedWithZeroComments" boolean NOT NULL DEFAULT false, "checkState" character varying, "waitingOn" character varying NOT NULL DEFAULT 'none', "requestedReviewers" text array NOT NULL DEFAULT '{}', "reviewDueAt" TIMESTAMP WITH TIME ZONE, "waitRounds" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_66ad877808f25b6758c69f9acf1" UNIQUE ("repo", "number"), CONSTRAINT "PK_e8a8aa8710c3a9650a19a9c2e7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_589c74fad37545745986ba01e5" ON "pull_requests" ("repo") `);
        await queryRunner.query(`CREATE INDEX "IDX_0065c7041322f3ee107ec92b60" ON "pull_requests" ("authorLogin") `);
        await queryRunner.query(`CREATE TABLE "people" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "githubLogin" character varying, "displayName" character varying, "team" character varying, "timezone" character varying, "role" character varying NOT NULL DEFAULT 'developer', "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c77e8752faa45901af2b245dff2" UNIQUE ("email"), CONSTRAINT "PK_aa866e71353ee94c6cc51059c5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2e9d54ccbbf76cda98779d89ad" ON "people" ("githubLogin") WHERE "githubLogin" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pr_events" ADD CONSTRAINT "FK_e814453dd9419be9fe450f0805a" FOREIGN KEY ("prId") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pr_events" DROP CONSTRAINT "FK_e814453dd9419be9fe450f0805a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e9d54ccbbf76cda98779d89ad"`);
        await queryRunner.query(`DROP TABLE "people"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0065c7041322f3ee107ec92b60"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_589c74fad37545745986ba01e5"`);
        await queryRunner.query(`DROP TABLE "pull_requests"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_23bc8f04b8e5b5b5ba801782db"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_612a08fe14b461f989e838c1a5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e814453dd9419be9fe450f0805"`);
        await queryRunner.query(`DROP TABLE "pr_events"`);
    }

}
