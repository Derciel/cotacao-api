import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddUserToQuotations1770000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "quotations",
            new TableColumn({
                name: "user_id",
                type: "integer",
                isNullable: true,
            })
        );

        await queryRunner.createForeignKey(
            "quotations",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "SET NULL",
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("quotations");
        if (!table) return;

        const foreignKey = table.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("user_id") !== -1
        );
        if (foreignKey) {
            await queryRunner.dropForeignKey("quotations", foreignKey);
        }
        await queryRunner.dropColumn("quotations", "user_id");
    }

}
