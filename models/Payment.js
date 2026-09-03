import { supabase } from '../config/supabase.js';
const TABLE = 'payments';
export const Payment = {
  async findAll() { const {data,error}=await supabase.from(TABLE).select('*').order('created_at',{ascending:false}); if(error)throw new Error(error.message); return data||[]; },
  async findById(id) { const {data,error}=await supabase.from(TABLE).select('*').eq('id',id).maybeSingle(); if(error)throw new Error(error.message); return data; },
  async create(p) { const {data,error}=await supabase.from(TABLE).insert([{recipient:p.recipient,amount_usd:p.amountUsd,status:p.status||'pending',payment_date:p.paymentDate||null,notes:p.notes||null,created_by:p.createdBy,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]).select().single(); if(error)throw new Error(error.message); return data; },
  async update(id,p) { const u={updated_at:new Date().toISOString()}; if(p.recipient!==undefined)u.recipient=p.recipient; if(p.amountUsd!==undefined)u.amount_usd=p.amountUsd; if(p.status!==undefined)u.status=p.status; if(p.paymentDate!==undefined)u.payment_date=p.paymentDate||null; if(p.notes!==undefined)u.notes=p.notes||null; if(p.status==='paid')u.paid_at=new Date().toISOString(); if(p.status==='pending')u.paid_at=null; const {data,error}=await supabase.from(TABLE).update(u).eq('id',id).select().single(); if(error)throw new Error(error.message); return data; },
  async delete(id) { const {error}=await supabase.from(TABLE).delete().eq('id',id); if(error)throw new Error(error.message); }
};
