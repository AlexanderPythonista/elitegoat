import { Form } from '../models/Form.js';
import { Log } from '../models/Log.js';

export const getForms = async (req, res) => {
  try {
    const userId = req.user?.id;
    let forms = [];
    if (userId) {
      const allForms = await Form.findAll();
      forms = allForms.filter(f => !f.is_private || f.created_by === userId);
    } else {
      const allForms = await Form.findAll();
      forms = allForms.filter(f => !f.is_private);
    }
    res.json({ success: true, data: forms });
  } catch (error) {
    console.error('Error en getForms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createForm = async (req, res) => {
  try {
    const { title, description, is_private } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'El título es requerido' });
    }
    const formData = {
      title,
      description: description || null,
      created_by: req.user.id,
      is_private: is_private || false
    };
    const newForm = await Form.create(formData);
    await Log.create({
      userId: req.user.id,
      action: 'create_form',
      target: newForm.id,
      details: { title }
    });
    res.status(201).json({ success: true, data: newForm });
  } catch (error) {
    console.error('Error en createForm:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.is_private && (!req.user || form.created_by !== req.user.id)) {
      return res.status(403).json({ success: false, message: 'Este formulario es privado' });
    }
    res.json({ success: true, data: form });
  } catch (error) {
    console.error('Error en getForm:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, is_private } = req.body;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para editar este formulario' });
    }
    const updated = await Form.update(id, { title, description, is_private });
    await Log.create({
      userId: req.user.id,
      action: 'update_form',
      target: id,
      details: { title, is_private }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error en updateForm:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar este formulario' });
    }
    await Form.delete(id);
    await Log.create({
      userId: req.user.id,
      action: 'delete_form',
      target: id,
      details: { title: form.title }
    });
    res.json({ success: true, message: 'Formulario eliminado' });
  } catch (error) {
    console.error('Error en deleteForm:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question_text, question_type, options, is_required, order } = req.body;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para añadir preguntas' });
    }
    if (!question_text || !question_type) {
      return res.status(400).json({ success: false, message: 'Texto y tipo de pregunta son requeridos' });
    }
    const newQuestion = await Form.addQuestion(id, {
      question_text,
      question_type,
      options: options || null,
      is_required: is_required || false,
      order: order || 0
    });
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    console.error('Error en addQuestion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { question_text, question_type, options, is_required, order } = req.body;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para editar esta pregunta' });
    }
    const updated = await Form.updateQuestion(questionId, {
      question_text,
      question_type,
      options,
      is_required,
      order
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error en updateQuestion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar esta pregunta' });
    }
    await Form.deleteQuestion(questionId);
    res.json({ success: true, message: 'Pregunta eliminada' });
  } catch (error) {
    console.error('Error en deleteQuestion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { respondent_name, answers } = req.body;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.is_private && !req.user) {
      return res.status(401).json({ success: false, message: 'Este formulario es privado. Inicia sesión para responder.' });
    }
    // Validar preguntas obligatorias
    const questions = form.questions || [];
    for (const q of questions) {
      if (q.is_required && (!answers || !answers[q.id])) {
        return res.status(400).json({ success: false, message: `La pregunta "${q.question_text}" es obligatoria` });
      }
    }
    const responseData = {
      respondent_name: respondent_name || (req.user ? req.user.username : 'Anónimo'),
      respondent_user_id: req.user?.id || null,
      answers
    };
    const response = await Form.submitResponse(id, responseData);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    console.error('Error en submitResponse:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Formulario no encontrado' });
    }
    if (form.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para ver las respuestas' });
    }
    const responses = await Form.getResponses(id);
    res.json({ success: true, data: responses });
  } catch (error) {
    console.error('Error en getResponses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};