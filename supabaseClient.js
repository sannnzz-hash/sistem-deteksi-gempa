import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum di-set di environment variables!');
}

// Gunakan SERVICE ROLE KEY di backend (bukan anon key) supaya bisa insert bebas dari RLS
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
