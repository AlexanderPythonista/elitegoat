import { Person } from '../models/Person.js';
import { Coordination } from '../models/Coordination.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Log } from '../models/Log.js';
import { supabase } from '../config/supabase.js';

// ================================================================
// Helper: Enriquecer persona con datos de coordinación, organización y usuario
// ================================================================
async function enrichPerson(person) {
  if (!person) return null;
  let coordination = null;
  let organization = null;
  let user = null;

  if (person.coordination_id) {
    coordination = await Coordination.findById(person.coordination_id);
    if (coordination && coordination.organization_id) {
      organization = await Organization.findById(coordination.organization_id);
    }
  }
  if (person.user_id) {
    user = await User.findById(person.user_id);
    if (user) {
      const { password_hash, ...userWithoutPassword } = user;
      user = userWithoutPassword;
    }
  }

  return {
    id: person.id,
    firstName: person.first_name || person.id || '?',
    nickname: person.nickname || person.id || '?',
    country: person.country || '',
    coordinationId: person.coordination_id,
    userId: person.user_id,
    createdAt: person.created_at,
    coordination,
    organization,
    user
  };
}

// ================================================================
// CRUD Personas
// ================================================================

export const createPerson = async (req, res) => {
  try {
    const { id, firstName, nickname, country, coordinationId } = req.body;

    // Validar que la coordinación existe (si se proporciona)
    if (coordinationId) {
      const coord = await Coordination.findById(coordinationId);
      if (!coord) {
        return res.status(404).json({ success: false, message: 'Coordinación no encontrada' });
      }
    }

    // Validar que el ID no esté en uso (si se proporciona)
    if (id) {
      const existing = await Person.findById(id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'El ID ya está en uso' });
      }
    }

    // Crear la persona (el modelo se encarga de crear el usuario en Auth y en la tabla users)
    const person = await Person.create({ id, firstName, nickname, country, coordinationId }, req.user.id);

    // Registrar log
    await Log.create({
      userId: req.user.id,
      action: 'create_person',
      target: person.id,
      details: { firstName, nickname, userId: person.userId }
    });

    // Enriquecer y devolver
    const enriched = await enrichPerson(person);
    res.status(201).json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Error en createPerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersons = async (req, res) => {
  try {
    const persons = await Person.findAll();
    const enriched = await Promise.all(persons.map(enrichPerson));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Error en getPersons:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }
    const enriched = await enrichPerson(person);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Error en getPerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePerson = async (req, res) => {
  try {
    const { firstName, nickname, country, coordinationId } = req.body;
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    // Si cambia la coordinación, actualizar relaciones en ambas tablas
    if (coordinationId !== undefined && coordinationId !== person.coordination_id) {
      // Remover de la coordinación anterior (si existía)
      if (person.coordination_id) {
        await Coordination.removePerson(person.coordination_id, req.params.id);
      }
      // Agregar a la nueva coordinación (si se proporciona)
      if (coordinationId) {
        await Coordination.addPerson(coordinationId, req.params.id);
      }
    }

    // Actualizar la persona
    const updated = await Person.update(req.params.id, { firstName, nickname, country, coordinationId });

    // Si cambia el nombre, actualizar también el username en la tabla users y en auth.users
    if (firstName && firstName !== person.first_name) {
      if (person.user_id) {
        // Actualizar en la tabla users personalizada
        await supabase
          .from('users')
          .update({ username: firstName })
          .eq('id', person.user_id);
        // Actualizar en auth.users (metadatos)
        await supabase.auth.admin.updateUserById(person.user_id, {
          user_metadata: { username: firstName }
        });
      }
    }

    // Registrar log
    await Log.create({
      userId: req.user.id,
      action: 'update_person',
      target: person.id,
      details: { firstName, nickname, coordinationId }
    });

    // Enriquecer y devolver
    const enriched = await enrichPerson(updated);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Error en updatePerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    // Si tiene coordinación, removerla
    if (person.coordination_id) {
      await Coordination.removePerson(person.coordination_id, req.params.id);
    }

    // Si tiene usuario asociado, eliminarlo de auth.users y de la tabla users
    if (person.user_id) {
      // Eliminar de auth.users
      await supabase.auth.admin.deleteUser(person.user_id);
      // Eliminar de la tabla users personalizada
      await supabase
        .from('users')
        .delete()
        .eq('id', person.user_id);
    }

    // Eliminar la persona
    await Person.delete(req.params.id);

    // Registrar log
    await Log.create({
      userId: req.user.id,
      action: 'delete_person',
      target: req.params.id,
      details: { person }
    });

    res.json({ success: true, message: 'Persona eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error en deletePerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonsWithoutCoordination = async (req, res) => {
  try {
    const persons = await Person.findWithoutCoordination();
    const enriched = await Promise.all(persons.map(enrichPerson));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Error en getPersonsWithoutCoordination:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};