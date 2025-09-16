import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneratedMigration1757979786383 implements MigrationInterface {
  name = 'GeneratedMigration1757979786383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, add a temporary column for UUID conversion
    await queryRunner.query(
      `ALTER TABLE "apso"."user" ADD "id_uuid" character varying`,
    );

    // Convert existing integer IDs to UUID format
    await queryRunner.query(`
            UPDATE "apso"."user" 
            SET "id_uuid" = (
                SELECT 
                    substring(md5(random()::text), 1, 8) || '-' ||
                    substring(md5(random()::text), 1, 4) || '-4' ||
                    substring(md5(random()::text), 1, 3) || '-8' ||
                    substring(md5(random()::text), 1, 4) || '-' ||
                    substring(md5(random()::text), 1, 12)
            )
        `);

    // Update session table to use new UUID user IDs
    await queryRunner.query(`
            UPDATE "apso"."session" 
            SET "userId" = (
                SELECT u."id_uuid" 
                FROM "apso"."user" u 
                WHERE u."id"::text = "apso"."session"."userId"
            )
        `);

    // Update account table to use new UUID user IDs
    await queryRunner.query(`
            UPDATE "apso"."account" 
            SET "userId" = (
                SELECT u."id_uuid" 
                FROM "apso"."user" u 
                WHERE u."id"::text = "apso"."account"."userId"
            )
        `);

    // Drop old constraints and columns
    await queryRunner.query(
      `ALTER TABLE "apso"."user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760"`,
    );
    await queryRunner.query(`ALTER TABLE "apso"."user" DROP COLUMN "id"`);

    // Rename UUID column to id and make it primary key
    await queryRunner.query(
      `ALTER TABLE "apso"."user" RENAME COLUMN "id_uuid" TO "id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "apso"."user" ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "apso"."user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760"`,
    );
    await queryRunner.query(`ALTER TABLE "apso"."user" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "apso"."user" ADD "id" SERIAL NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "apso"."user" ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")`,
    );
  }
}
