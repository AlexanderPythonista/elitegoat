import { supabase } from '../config/supabase.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Error verificando token:', error?.message);
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    // Obtener datos adicionales de la tabla users (rol, username, etc.)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, email, role')
      .eq('id', user.id)
      .maybeSingle();

    if (userError) {
      console.error('Error obteniendo datos de usuario:', userError);
    }

    // Si no existe en la tabla users, lo creamos automáticamente
    if (!userData) {
      console.log('⚠️ Usuario no encontrado en tabla users, creando registro...');
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          username: user.user_metadata?.username || user.email.split('@')[0],
          email: user.email,
          role: 'participante',
          is_active: true,
          created_at: new Date().toISOString()
        }]);
      if (insertError) {
        console.error('Error creando usuario en tabla users:', insertError);
      }
      // Re-consultar para obtener el rol
      const { data: newUserData } = await supabase
        .from('users')
        .select('id, username, email, role')
        .eq('id', user.id)
        .single();
      if (newUserData) {
        req.user = {
          id: user.id,
          email: user.email,
          username: newUserData.username,
          role: newUserData.role || 'participante',
          user_metadata: user.user_metadata || {}
        };
        return next();
      }
    }

    // Asignar rol desde la tabla users (prioridad sobre metadatos)
    req.user = {
      id: user.id,
      email: user.email,
      username: userData?.username || user.user_metadata?.username || user.email,
      role: userData?.role || 'participante',
      user_metadata: user.user_metadata || {}
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'participante';
    if (!roles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
};