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

  if (person.coordinationId) {
    coordination = await Coordination.findById(person.coordinationId);
    if (coordination && coordination.organization_id) {
      organization = await Organization.findById(coordination.organization_id);
    }
  }
  if (person.userId) {
    user = await User.findById(person.userId);
    if (user) {
      const { password_hash, ...userWithoutPassword } = user;
      user = userWithoutPassword;
    }
  }

  return {
    id: person.id,
    firstName: person.firstName,
    nickname: person.nickname,
    country: person.country,
    coordinationId: person.coordinationId,
    userId: person.userId,
    photoUrl: person.photoUrl,
    reputation: person.reputation,
    joinedAt: person.joinedAt,
    fanKamona: person.fanKamona,
    fanBlackgold: person.fanBlackgold,
    fanLobosBlancos: person.fanLobosBlancos,
    createdAt: person.createdAt,
    coordination,
    organization,
    user
  };
}

// ================================================================
// OBTENER PERFIL COMPLETO (incluye TOP y escuadras)
// ================================================================
export const getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await Person.findById(id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    // Enriquecer con coordinación y organización
    const enriched = await enrichPerson(person);

    // Obtener escuadras en las que participa (eventos activos)
    const { data: squadMemberships, error: squadError } = await supabase
      .from('squad_members')
      .select('squad_id, squads(event_id, name, events(name, mode, status))')
      .eq('person_id', id);
    if (squadError) throw new Error(squadError.message);

    const squads = squadMemberships.map(sm => ({
      squadId: sm.squad_id,
      squadName: sm.squads?.name || 'Sin nombre',
      eventId: sm.squads?.event_id,
      eventName: sm.squads?.events?.name || 'Evento sin nombre',
      eventMode: sm.squads?.events?.mode || 'individual',
      eventStatus: sm.squads?.events?.status || 'desconocido'
    }));

    // Obtener datos de TOP (almacen y país) desde la hoja activa
    const { data: topData, error: topError } = await supabase
      .from('top_sheets')
      .select('data')
      .eq('id', 'top')
      .maybeSingle();
    if (topError) throw new Error(topError.message);

    let almacen = '0';
    let topCountry = '';
    if (topData && topData.data) {
      const sheets = topData.data;
      for (const sheetName of Object.keys(sheets)) {
        const rows = sheets[sheetName] || [];
        const found = rows.find(row => String(row.id) === String(id));
        if (found) {
          almacen = found.almacenActual || '0';
          topCountry = found.nacionalidad || '';
          break;
        }
      }
    }

    // Si no tiene país en persona, usar el de TOP
    const finalCountry = person.country || topCountry;

    res.json({
      success: true,
      data: {
        ...enriched,
        country: finalCountry,
        almacen,
        squads
      }
    });
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// ACTUALIZAR PERFIL (solo el propio usuario o admin/root)
// ================================================================
export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl, reputation, joinedAt, fanKamona, fanBlackgold, fanLobosBlancos } = req.body;

    // Verificar permisos: solo el propio usuario o admin/root
    const isSelf = req.user.id === id || req.user.personId === id;
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para editar este perfil' });
    }

    let updateData = {};
    // Permitir actualizar todos los campos del perfil (tanto admin como el propio usuario)
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (reputation !== undefined) updateData.reputation = reputation;
    if (joinedAt !== undefined) updateData.joinedAt = joinedAt;
    if (fanKamona !== undefined) updateData.fanKamona = fanKamona;
    if (fanBlackgold !== undefined) updateData.fanBlackgold = fanBlackgold;
    if (fanLobosBlancos !== undefined) updateData.fanLobosBlancos = fanLobosBlancos;

    const updated = await Person.update(id, updateData);
    await Log.create({
      userId: req.user.id,
      action: 'update_profile',
      target: id,
      details: updateData
    });

    const enriched = await enrichPerson(updated);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en updateProfile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// OBTENER TODOS LOS PERFILES (solo admin/root)
// ================================================================
export const getAllProfiles = async (req, res) => {
  try {
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const persons = await Person.findAll();
    const enriched = await Promise.all(persons.map(enrichPerson));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en getAllProfiles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// CRUD PERSONAS (existente)
// ================================================================

export const createPerson = async (req, res) => {
  try {
    const { id, firstName, nickname, country, coordinationId, photoUrl, reputation, joinedAt, fanKamona, fanBlackgold, fanLobosBlancos } = req.body;

    if (coordinationId) {
      const coord = await Coordination.findById(coordinationId);
      if (!coord) {
        return res.status(404).json({ success: false, message: 'Coordinación no encontrada' });
      }
    }

    if (id) {
      const existing = await Person.findById(id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'El ID ya está en uso' });
      }
    }

    const person = await Person.create({
      id,
      firstName,
      nickname,
      country,
      coordinationId,
      photoUrl,
      reputation,
      joinedAt,
      fanKamona,
      fanBlackgold,
      fanLobosBlancos
    }, req.user.id);

    await Log.create({
      userId: req.user.id,
      action: 'create_person',
      target: person.id,
      details: { firstName, nickname, userId: person.userId }
    });

    const enriched = await enrichPerson(person);
    res.status(201).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en createPerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersons = async (req, res) => {
  try {
    const persons = await Person.findAll();
    const enriched = await Promise.all(persons.map(enrichPerson));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en getPersons:', error);
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
    console.error('Error en getPerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePerson = async (req, res) => {
  try {
    const { firstName, nickname, country, coordinationId, photoUrl, reputation, joinedAt, fanKamona, fanBlackgold, fanLobosBlancos } = req.body;
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    // Si cambia la coordinación, actualizar relaciones
    if (coordinationId !== undefined && coordinationId !== person.coordinationId) {
      if (person.coordinationId) {
        await Coordination.removePerson(person.coordinationId, req.params.id);
      }
      if (coordinationId) {
        await Coordination.addPerson(coordinationId, req.params.id);
      }
    }

    const updated = await Person.update(req.params.id, {
      firstName,
      nickname,
      country,
      coordinationId,
      photoUrl,
      reputation,
      joinedAt,
      fanKamona,
      fanBlackgold,
      fanLobosBlancos
    });

    // Si cambia el nombre, actualizar también el username en users y auth
    if (firstName && firstName !== person.first_name) {
      if (person.userId) {
        await supabase
          .from('users')
          .update({ username: firstName })
          .eq('id', person.userId);
        await supabase.auth.admin.updateUserById(person.userId, {
          user_metadata: { username: firstName }
        });
      }
    }

    await Log.create({
      userId: req.user.id,
      action: 'update_person',
      target: person.id,
      details: { firstName, nickname, coordinationId }
    });

    const enriched = await enrichPerson(updated);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en updatePerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    if (person.coordinationId) {
      await Coordination.removePerson(person.coordinationId, req.params.id);
    }

    if (person.userId) {
      await supabase.auth.admin.deleteUser(person.userId);
      await supabase
        .from('users')
        .delete()
        .eq('id', person.userId);
    }

    await Person.delete(req.params.id);

    await Log.create({
      userId: req.user.id,
      action: 'delete_person',
      target: req.params.id,
      details: { person }
    });

    res.json({ success: true, message: 'Persona eliminada correctamente' });
  } catch (error) {
    console.error('Error en deletePerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonsWithoutCoordination = async (req, res) => {
  try {
    const persons = await Person.findWithoutCoordination();
    const enriched = await Promise.all(persons.map(enrichPerson));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error en getPersonsWithoutCoordination:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};