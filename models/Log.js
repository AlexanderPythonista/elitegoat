import { supabase } from '../config/supabase.js';

export const Log = {
  async findAll() {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async create(entry) {
    const { data, error } = await supabase
      .from('logs')
      .insert([{
        user_id: entry.userId,
        action: entry.action,
        target: entry.target,
        details: entry.details || {},
        timestamp: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
};