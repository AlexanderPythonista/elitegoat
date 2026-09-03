import { Organization } from '../models/Organization.js';
import { Coordination } from '../models/Coordination.js';
import { Person } from '../models/Person.js';
import { supabase } from '../config/supabase.js';

export const createOrganization = async (req, res) => {
  try {
    const { name, leaderId, coLeaderId } = req.body;
    const org = await Organization.create({ name, leaderId, coLeaderId });
    res.status(201).json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrganizations = async (req, res) => {
  try {
    const [orgs, persons, coordsResult, directResult] = await Promise.all([
      Organization.findAll(),
      Person.findAll(),
      supabase.from('coordinations').select('*'),
      supabase.from('organization_persons').select('organization_id, person_id')
    ]);
    if (coordsResult.error) throw new Error(coordsResult.error.message);
    if (directResult.error) throw new Error(directResult.error.message);

    const coords = coordsResult.data || [];
    const directLinks = directResult.data || [];
    const personMap = new Map(persons.map(p => [String(p.id), p]));
    const directByOrg = new Map();
    directLinks.forEach(link => {
      const key = String(link.organization_id);
      if (!directByOrg.has(key)) directByOrg.set(key, new Set());
      directByOrg.get(key).add(String(link.person_id));
    });

    const coordsByOrg = new Map();
    coords.forEach(c => {
      const key = String(c.organization_id);
      if (!coordsByOrg.has(key)) coordsByOrg.set(key, []);
      coordsByOrg.get(key).push(c);
    });

    const enriched = orgs.map(org => {
      const orgId = String(org.id);
      const orgCoords = coordsByOrg.get(orgId) || [];
      const ids = new Set(directByOrg.get(orgId) || []);

      // Una persona pertenece a la organización aunque no exista en
      // organization_persons si su coordination_id apunta a una coordinación
      // de esta organización (por ejemplo F1/F2).
      const orgCoordIds = new Set(orgCoords.map(c => String(c.id)));
      persons.forEach(p => {
        if (p.coordinationId && orgCoordIds.has(String(p.coordinationId))) ids.add(String(p.id));
      });

      const personsForOrg = Array.from(ids)
        .map(id => personMap.get(id))
        .filter(Boolean);

      const coordinations = orgCoords.map(c => {
        const members = persons.filter(p => p.coordinationId && String(p.coordinationId) === String(c.id));
        const leader = personMap.get(String(c.leader_id));
        const coLeader = personMap.get(String(c.co_leader_id));
        return {
          ...c,
          leaderId: c.leader_id,
          coLeaderId: c.co_leader_id,
          leader,
          coLeader,
          members,
          personIds: members.map(p => p.id)
        };
      });

      const leader = personMap.get(String(org.leader_id));
      const coLeader = personMap.get(String(org.co_leader_id));
      return {
        ...org,
        leader,
        coLeader,
        leaderId: org.leader_id,
        coLeaderId: org.co_leader_id,
        persons: personsForOrg,
        personIds: personsForOrg.map(p => p.id),
        coordinations
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error getOrganizations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrganization = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'No encontrada' });
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const updated = await Organization.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'No encontrada' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOrganization = async (req, res) => {
  try {
    const deleted = await Organization.delete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'No encontrada' });
    res.json({ success: true, message: 'Eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addPersonToOrganization = async (req, res) => {
  try {
    const { personId } = req.body;
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Organización no encontrada' });
    const person = await Person.findById(personId);
    if (!person) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    // Verificar si ya está en una coordinación
    if (person.coordination_id) {
      return res.status(400).json({ success: false, message: 'La persona ya está asignada a una coordinación' });
    }
    await Organization.addPerson(req.params.id, personId);
    res.json({ success: true, message: 'Persona añadida a la organización' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removePersonFromOrganization = async (req, res) => {
  try {
    const { personId } = req.params;
    await Organization.removePerson(req.params.id, personId);
    res.json({ success: true, message: 'Persona removida de la organización' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};