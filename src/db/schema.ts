import { customType, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sqliteVector = <Dimensions extends number>(name: string, dimensions: Dimensions) => {
  return customType<{ data: number[]; driverData: string }>({
    dataType() {
      return 'text'
    },
    toDriver(value: number[]): string {
      return JSON.stringify(value)
    },
    fromDriver(value: string): number[] {
      console.log('🚀 ~ fromDriver ~ value:', value)
      return JSON.parse(value)
    },
  })(name)
}

export const settings = sqliteTable('setting', {
  id: integer('id').primaryKey().unique(),
  value: text('value'),
  updated_at: text('updated_at').default('CURRENT_TIMESTAMP'),
  embedding: sqliteVector('embedding', 3),
})
