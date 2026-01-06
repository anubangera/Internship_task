import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({  // ← pool is INTERNAL only
  connectionString: process.env.DATABASE_URL,
})

export const query = async (text: string, params?: any[]) => {  // ← ONLY query exported
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
