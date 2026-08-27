import { Organization } from '../models/Organization.js';
import { Coordination } from '../models/Coordination.js';
import { Person } from '../models/Person.js';

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
    const orgs = await Organization.findAll();
    res.json({ success: true, data: orgs });
  } catch (error) {
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