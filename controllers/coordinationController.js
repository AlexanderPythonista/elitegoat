import { Coordination } from '../models/Coordination.js';
import { Organization } from '../models/Organization.js';
import { Person } from '../models/Person.js';

export const createCoordination = async (req, res) => {
  try {
    const { name, organizationId, leaderId, coLeaderId } = req.body;
    const org = await Organization.findById(organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organización no encontrada' });
    const coord = await Coordination.create({ name, organizationId, leaderId, coLeaderId });
    res.status(201).json({ success: true, data: coord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoordinations = async (req, res) => {
  try {
    const coords = await Coordination.findAll();
    res.json({ success: true, data: coords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoordination = async (req, res) => {
  try {
    const coord = await Coordination.findById(req.params.id);
    if (!coord) return res.status(404).json({ success: false, message: 'No encontrada' });
    res.json({ success: true, data: coord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCoordination = async (req, res) => {
  try {
    const updated = await Coordination.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'No encontrada' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCoordination = async (req, res) => {
  try {
    const coord = await Coordination.findById(req.params.id);
    if (!coord) return res.status(404).json({ success: false, message: 'No encontrada' });
    await Coordination.delete(req.params.id);
    res.json({ success: true, message: 'Eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addPersonToCoordination = async (req, res) => {
  try {
    const { personId } = req.body;
    const coord = await Coordination.findById(req.params.id);
    if (!coord) return res.status(404).json({ success: false, message: 'Coordinación no encontrada' });
    const person = await Person.findById(personId);
    if (!person) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    await Coordination.addPerson(req.params.id, personId);
    await Person.assignToCoordination(personId, req.params.id);
    res.json({ success: true, message: 'Persona añadida a la coordinación' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const removePersonFromCoordination = async (req, res) => {
  try {
    const { personId } = req.params;
    await Coordination.removePerson(req.params.id, personId);
    await Person.removeFromCoordination(personId);
    res.json({ success: true, message: 'Persona removida' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};