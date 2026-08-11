import { supabase } from '../config/supabase.js';

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();
    if (checkError) throw new Error(checkError.message);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Usuario o email ya registrado' });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role: 'participante' },
      email_confirm: true
    });
    if (authError) throw new Error(authError.message);

    const { error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        username,
        email,
        role: 'participante',
        is_active: true,
        created_at: new Date().toISOString()
      }]);
    if (userError) throw new Error(userError.message);

    const { data: { session }, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: authData.user.id
    });
    if (sessionError) throw new Error(sessionError.message);

    // Obtener personId asociado (si existe)
    let personId = null;
    const { data: personData } = await supabase
      .from('persons')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (personData) personId = personData.id;

    res.status(201).json({
      success: true,
      data: {
        user: { id: authData.user.id, username, email, role: 'participante', personId },
        token: session.access_token
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error al registrar', error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, role, id')
      .eq('username', username)
      .single();
    if (userError || !user) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password
    });
    if (authError) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    // --- OBTENER personId ---
    let personId = null;
    console.log(`🔍 login - Buscando persona para user_id: ${user.id}`);
    // 1. Buscar por user_id
    const { data: personData } = await supabase
      .from('persons')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (personData) {
      personId = personData.id;
      console.log(`✅ login - Persona encontrada por user_id: ${personId}`);
    } else {
      console.log(`⚠️ login - No se encontró persona por user_id, intentando fallback...`);
      // 2. Fallback: buscar por id (por si el user_id es igual al id de persona)
      const { data: personById } = await supabase
        .from('persons')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (personById) {
        personId = personById.id;
        console.log(`✅ login - Persona encontrada por id: ${personId}`);
        // Actualizar user_id para futuras veces
        const { error: updateError } = await supabase
          .from('persons')
          .update({ user_id: user.id })
          .eq('id', personId);
        if (updateError) {
          console.error('❌ login - Error actualizando user_id:', updateError);
        } else {
          console.log(`✅ login - user_id actualizado para persona ${personId}`);
        }
      } else {
        console.log(`❌ login - No se encontró persona ni por user_id ni por id`);
        // 3. Crear persona automáticamente (opcional, pero recomendado)
        // Para evitar que usuarios sin persona no vean eventos, creamos una persona automática
        // con el mismo ID que el usuario (si no existe)
        try {
          const newPerson = {
            id: user.id,
            first_name: user.username || user.email,
            nickname: user.username || user.email,
            country: '',
            coordination_id: null,
            user_id: user.id
          };
          const { error: insertError } = await supabase
            .from('persons')
            .insert([newPerson]);
          if (!insertError) {
            personId = user.id;
            console.log(`✅ login - Persona creada automáticamente con id: ${personId}`);
          } else {
            console.error('❌ login - Error creando persona automática:', insertError);
          }
        } catch (e) {
          console.error('❌ login - Error en creación automática de persona:', e);
        }
      }
    }

    res.json({
      success: true,
      data: {
        user: { id: user.id, username, email: user.email, role: user.role, personId },
        token: authData.session.access_token
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión', error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, username, email, role')
      .eq('id', req.user.id)
      .single();
    if (error) throw new Error(error.message);

    let personId = null;
    const { data: personData } = await supabase
      .from('persons')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (personData) personId = personData.id;

    res.json({ success: true, data: { ...userData, personId } });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ success: false, message: 'Error al obtener usuario', error: error.message });
  }
};