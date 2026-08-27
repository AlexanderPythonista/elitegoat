import { User } from '../models/User.js';
import { Person } from '../models/Person.js';
import { Log } from '../models/Log.js';
import { supabase } from '../config/supabase.js';

// Obtener todos los usuarios (solo root/admin)
export const getUsers = async (req, res) => {
  try {
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const users = await User.findAll();
    const usersWithoutPassword = users.map(u => {
      const { password_hash, ...rest } = u;
      return rest;
    });
    res.json({ success: true, data: usersWithoutPassword });
  } catch (error) {
    console.error('Error en getUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar usuario (username, password, role) - solo root puede cambiar role
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (user.username === 'root' && req.user.username !== 'root') {
      return res.status(403).json({ success: false, message: 'No puedes modificar al usuario root' });
    }

    if (role && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'Solo root puede cambiar roles' });
    }

    if (username && username !== user.username) {
      const existing = await User.findOne({ username });
      if (existing) return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (password) updateData.password = password;
    if (role && req.user.role === 'root') updateData.role = role;

    const updated = await User.update(id, updateData);

    // Actualizar también en auth.users si cambia username
    if (username) {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: { username }
      });
    }

    await Log.create({
      userId: req.user.id,
      action: 'update_user',
      target: id,
      details: { username, role }
    });

    const { password_hash, ...userWithoutPassword } = updated;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error('Error en updateUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cambiar rol de usuario (solo root)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'Solo root puede cambiar roles' });
    }
    if (!['participante', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (user.username === 'root') {
      return res.status(400).json({ success: false, message: 'No se puede cambiar el rol de root' });
    }

    await User.update(id, { role });
    await supabase.auth.admin.updateUserById(id, {
      user_metadata: { role }
    });

    await Log.create({
      userId: req.user.id,
      action: 'update_user_role',
      target: id,
      details: { newRole: role }
    });

    res.json({ success: true, message: 'Rol actualizado' });
  } catch (error) {
    console.error('Error en updateUserRole:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sincronizar Persona con Usuario
export const syncPersonUser = async (req, res) => {
  try {
    const { personId } = req.params;
    const { firstName, id: newPersonId } = req.body;

    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const person = await Person.findById(personId);
    if (!person) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    if (!person.userId) return res.status(400).json({ success: false, message: 'Esta persona no tiene usuario vinculado' });

    const user = await User.findById(person.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    let updatedPerson = { ...person };
    if (firstName) {
      await Person.update(personId, { firstName });
      await User.update(user.id, { username: firstName });
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { username: firstName }
      });
      updatedPerson.firstName = firstName;
    }

    if (newPersonId && newPersonId !== person.id) {
      const existing = await Person.findById(newPersonId);
      if (existing) return res.status(400).json({ success: false, message: 'El nuevo ID ya está en uso' });
      await Person.delete(person.id);
      const newPerson = await Person.create({
        id: newPersonId,
        firstName: person.first_name,
        nickname: person.nickname,
        country: person.country,
        coordinationId: person.coordination_id,
        userId: user.id
      });
      updatedPerson = newPerson;
    }

    await Log.create({
      userId: req.user.id,
      action: 'sync_person_user',
      target: personId,
      details: { firstName, newPersonId }
    });

    res.json({ success: true, data: updatedPerson });
  } catch (error) {
    console.error('Error en syncPersonUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear usuarios para personas sin usuario (masivo)
export const createMissingUsers = async (req, res) => {
  try {
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const persons = await Person.findAll();
    let created = 0;
    for (const person of persons) {
      if (!person.userId) {
        const username = person.firstName || person.id;
        const password = person.id;
        const email = `${person.id}@eventpro.local`;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          user_metadata: { username, role: 'participante' },
          email_confirm: true
        });
        if (authError) {
          console.error(`Error creando usuario para ${person.id}:`, authError.message);
          continue;
        }

        await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            username,
            email,
            role: 'participante',
            is_active: true,
            created_at: new Date().toISOString()
          }]);

        await Person.update(person.id, { userId: authData.user.id });

        await Log.create({
          userId: req.user.id,
          action: 'create_missing_user',
          target: person.id,
          details: { username, userId: authData.user.id }
        });
        created++;
      }
    }
    res.json({ success: true, message: `Se crearon ${created} usuarios para personas sin usuario.` });
  } catch (error) {
    console.error('Error en createMissingUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Crear usuario para una persona específica
export const createUserForPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const person = await Person.findById(personId);
    if (!person) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    if (person.userId) return res.status(400).json({ success: false, message: 'Ya tiene usuario' });

    const username = person.firstName || person.id;
    const password = person.id;
    const email = `${person.id}@eventpro.local`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role: 'participante' },
      email_confirm: true
    });
    if (authError) throw new Error(authError.message);

    await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        username,
        email,
        role: 'participante',
        is_active: true,
        created_at: new Date().toISOString()
      }]);

    await Person.update(person.id, { userId: authData.user.id });

    await Log.create({
      userId: req.user.id,
      action: 'create_user_for_person',
      target: person.id,
      details: { username, userId: authData.user.id }
    });

    res.json({ success: true, message: 'Usuario creado', data: authData.user });
  } catch (error) {
    console.error('Error en createUserForPerson:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener historial de logs (solo root/admin)
export const getLogs = async (req, res) => {
  try {
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const logs = await Log.findAll();
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error en getLogs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};