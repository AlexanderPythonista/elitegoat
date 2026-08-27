import { supabase } from '../config/supabase.js';

const TABLE = 'organizations';

export const Organization = {
  async findAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*');
    if (error) throw new Error(error.message);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(data) {
    const { data: result, error } = await supabase
      .from(TABLE)
      .insert([{
        id: data.id || crypto.randomUUID(),
        name: data.name,
        leader_id: data.leaderId || null,
        co_leader_id: data.coLeaderId || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        name: updateData.name,
        leader_id: updateData.leaderId,
        co_leader_id: updateData.coLeaderId
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async addCoordination(orgId, coordId) {
    // No hacemos nada porque la relación es por organization_id en coordinations
    return true;
  },

  async removeCoordination(orgId, coordId) {
    await supabase.from('coordinations').delete().eq('id', coordId).eq('organization_id', orgId);
    return true;
  },

  async addPerson(orgId, personId) {
    const { error } = await supabase
      .from('organization_persons')
      .insert([{ organization_id: orgId, person_id: personId }]);
    if (error) throw new Error(error.message);
    return true;
  },

  async removePerson(orgId, personId) {
    const { error } = await supabase
      .from('organization_persons')
      .delete()
      .match({ organization_id: orgId, person_id: personId });
    if (error) throw new Error(error.message);
    return true;
  }
};