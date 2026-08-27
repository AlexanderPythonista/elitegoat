import { supabase } from '../config/supabase.js';

const FORMS_TABLE = 'forms';
const QUESTIONS_TABLE = 'form_questions';
const RESPONSES_TABLE = 'form_responses';

export const Form = {
  // ---- Formularios ----
  async findAll() {
    const { data, error } = await supabase
      .from(FORMS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(FORMS_TABLE)
      .select('*, questions:form_questions(*)')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async findByCreator(userId) {
    const { data, error } = await supabase
      .from(FORMS_TABLE)
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async create(formData) {
    const { data, error } = await supabase
      .from(FORMS_TABLE)
      .insert([{
        title: formData.title,
        description: formData.description || null,
        created_by: formData.created_by,
        is_private: formData.is_private || false
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from(FORMS_TABLE)
      .update({
        title: updateData.title,
        description: updateData.description,
        is_private: updateData.is_private,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from(FORMS_TABLE)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // ---- Preguntas ----
  async addQuestion(formId, questionData) {
    const { data, error } = await supabase
      .from(QUESTIONS_TABLE)
      .insert([{
        form_id: formId,
        question_text: questionData.question_text,
        question_type: questionData.question_type,
        options: questionData.options || null,
        is_required: questionData.is_required || false,
        order: questionData.order || 0
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateQuestion(questionId, updateData) {
    const { data, error } = await supabase
      .from(QUESTIONS_TABLE)
      .update({
        question_text: updateData.question_text,
        question_type: updateData.question_type,
        options: updateData.options,
        is_required: updateData.is_required,
        order: updateData.order
      })
      .eq('id', questionId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteQuestion(questionId) {
    const { error } = await supabase
      .from(QUESTIONS_TABLE)
      .delete()
      .eq('id', questionId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ---- Respuestas ----
  async submitResponse(formId, responseData) {
    const { data, error } = await supabase
      .from(RESPONSES_TABLE)
      .insert([{
        form_id: formId,
        respondent_name: responseData.respondent_name,
        respondent_user_id: responseData.respondent_user_id || null,
        answers: responseData.answers
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getResponses(formId) {
    const { data, error } = await supabase
      .from(RESPONSES_TABLE)
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
};
