import { supabase } from '../config/supabase.js';

// Esta tabla se llamará 'top_sheets' con columnas: id, sheet_name, data (jsonb)
// Podemos guardar cada hoja como un registro con su nombre y su array de datos.
// O mantener un solo registro con todas las hojas.
// Usaremos un solo registro con id='top' y un campo 'data' que es un objeto { F1: [...], F2: [...] }

const TOP_TABLE = 'top_sheets';

export const getTop = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TOP_TABLE)
      .select('data')
      .eq('id', 'top')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return res.json({ success: true, data: {} });

    // Si el data es un array (formato antiguo), convertirlo a objeto con F1
    if (Array.isArray(data.data)) {
      const newData = { 'F1': data.data };
      await supabase
        .from(TOP_TABLE)
        .update({ data: newData })
        .eq('id', 'top');
      return res.json({ success: true, data: newData });
    }

    res.json({ success: true, data: data.data || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveTop = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TOP_TABLE)
      .upsert({
        id: 'top',
        data: req.body,
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw new Error(error.message);
    res.json({ success: true, message: 'Datos TOP guardados' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};