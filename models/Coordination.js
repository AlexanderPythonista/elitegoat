import { supabase } from '../config/supabase.js';

const TABLE = 'coordinations';

export const Coordination = {
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

  async findByOrganization(orgId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('organization_id', orgId);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(data) {
    const { data: result, error } = await supabase
      .from(TABLE)
      .insert([{
        id: data.id || crypto.randomUUID(),
        name: data.name,
        organization_id: data.organizationId,
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

  async addPerson(coordId, personId) {
    const { error } = await supabase
      .from('coordination_persons')
      .insert([{ coordination_id: coordId, person_id: personId }]);
    if (error) throw new Error(error.message);
    return true;
  },

  async removePerson(coordId, personId) {
    const { error } = await supabase
      .from('coordination_persons')
      .delete()
      .match({ coordination_id: coordId, person_id: personId });
    if (error) throw new Error(error.message);
    return true;
  }
};