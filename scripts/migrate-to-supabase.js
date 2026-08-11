import { supabase } from '../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

async function readJSON(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function existsInTable(table, id) {
  if (!id) return false;
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

async function getOrCreateUser(userData) {
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
    filters: { email: userData.email }
  });
  if (listError) throw new Error(`Error listando usuarios: ${listError.message}`);

  let userId = userData.id;
  if (authUsers && authUsers.users && authUsers.users.length > 0) {
    userId = authUsers.users[0].id;
  } else {
    const { data: newAuth, error: createError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: 'temporal123',
      user_metadata: { username: userData.username, role: userData.role || 'participante' },
      email_confirm: true
    });
    if (createError) throw new Error(`Error creando auth user: ${createError.message}`);
    userId = newAuth.user.id;
  }

  const { error: upsertError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      username: userData.username,
      email: userData.email,
      role: userData.role || 'participante',
      is_active: userData.isActive !== undefined ? userData.isActive : true,
      created_at: userData.createdAt || new Date().toISOString()
    }, { onConflict: 'id' });

  if (upsertError) throw new Error(`Error upsertando usuario: ${upsertError.message}`);

  return userId;
}

async function migrate() {
  console.log('🚀 Iniciando migración de datos...');

  try {
    // ---------- 1. MIGRAR USUARIOS ----------
    const users = await readJSON('users.json');
    for (const user of users) {
      try {
        const newId = await getOrCreateUser(user);
        console.log(`✅ Usuario ${user.username} migrado (${newId})`);
      } catch (error) {
        console.warn(`❌ Error migrando usuario ${user.username}:`, error.message);
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (existing) {
          console.log(`   Usuario ya existe con id ${existing.id}`);
        }
      }
    }

    // ---------- 2. MIGRAR PERSONAS ----------
    const persons = await readJSON('persons.json');
    for (const person of persons) {
      let userId = person.userId;
      if (userId) {
        const exists = await existsInTable('users', userId);
        if (!exists) {
          console.warn(`⚠️ userId ${userId} no existe, se asignará null a persona ${person.id}`);
          userId = null;
        }
      }
      const { error } = await supabase
        .from('persons')
        .insert([{
          id: person.id,
          first_name: person.firstName,
          nickname: person.nickname,
          country: person.country || '',
          coordination_id: person.coordinationId || null,
          user_id: userId || null,
          created_at: person.createdAt || new Date().toISOString()
        }]);
      if (error) console.warn(`❌ Error migrando persona ${person.id}:`, error.message);
    }
    console.log(`✅ ${persons.length} personas migradas.`);

    // ---------- 3. MIGRAR ORGANIZACIONES ----------
    const orgs = await readJSON('organizations.json');
    for (const org of orgs) {
      let leaderId = org.leaderId;
      if (leaderId && !(await existsInTable('persons', leaderId))) {
        console.warn(`⚠️ leaderId ${leaderId} no existe, se asignará null a ${org.name}`);
        leaderId = null;
      }
      let coLeaderId = org.coLeaderId;
      if (coLeaderId && !(await existsInTable('persons', coLeaderId))) {
        console.warn(`⚠️ coLeaderId ${coLeaderId} no existe, se asignará null a ${org.name}`);
        coLeaderId = null;
      }

      const { data: newOrg, error } = await supabase
        .from('organizations')
        .insert([{
          id: org.id,
          name: org.name,
          leader_id: leaderId,
          co_leader_id: coLeaderId,
          created_at: org.createdAt || new Date().toISOString()
        }])
        .select()
        .single();
      if (error) {
        console.warn(`❌ Error migrando organización ${org.name}:`, error.message);
        continue;
      }

      // ---------- 4. MIGRAR COORDINACIONES Y PERSONAS ASOCIADAS ----------
      if (org.coordinationIds && org.coordinationIds.length) {
        const coords = await readJSON('coordinations.json');
        for (const coordId of org.coordinationIds) {
          const coord = coords.find(c => c.id === coordId);
          if (!coord) continue;

          let lId = coord.leaderId;
          if (lId && !(await existsInTable('persons', lId))) lId = null;
          let clId = coord.coLeaderId;
          if (clId && !(await existsInTable('persons', clId))) clId = null;

          const { data: newCoord, error: coordError } = await supabase
            .from('coordinations')
            .insert([{
              id: coord.id,
              name: coord.name,
              organization_id: newOrg.id,
              leader_id: lId,
              co_leader_id: clId,
              created_at: coord.createdAt || new Date().toISOString()
            }])
            .select()
            .single();

          if (!coordError && coord.personIds && coord.personIds.length) {
            for (const pid of coord.personIds) {
              // ✅ VERIFICAR QUE EL ID NO SEA NULO Y EXISTA EN persons
              if (pid && await existsInTable('persons', pid)) {
                const { error: relError } = await supabase
                  .from('coordination_persons')
                  .insert([{ coordination_id: newCoord.id, person_id: pid }]);
                if (relError) {
                  console.warn(`⚠️ Error insertando relación coord-persona ${newCoord.id}-${pid}:`, relError.message);
                }
              } else {
                console.warn(`⚠️ Persona ${pid} no existe o es nula, omitida de coordinación ${coord.name}`);
              }
            }
          }
        }
      }

      // ---------- 5. MIGRAR PERSONAS DIRECTAS DE ORGANIZACIÓN ----------
      if (org.personIds && org.personIds.length) {
        for (const pid of org.personIds) {
          if (pid && await existsInTable('persons', pid)) {
            await supabase
              .from('organization_persons')
              .insert([{ organization_id: newOrg.id, person_id: pid }]);
          } else {
            console.warn(`⚠️ Persona ${pid} no existe o es nula, omitida de organización ${org.name}`);
          }
        }
      }
    }
    console.log(`✅ Organizaciones y coordinaciones migradas.`);

    // ---------- 6. MIGRAR EVENTOS ----------
    const events = await readJSON('events.json');
    for (const ev of events) {
      let createdBy = ev.createdBy;
      if (createdBy && !(await existsInTable('users', createdBy))) {
        console.warn(`⚠️ createdBy ${createdBy} no existe, se asignará null a evento ${ev.name}`);
        createdBy = null;
      }

      const { data: newEvent, error } = await supabase
        .from('events')
        .insert([{
          id: ev.id,
          name: ev.name,
          type: ev.type,
          mode: ev.mode,
          max_participants: ev.maxParticipants || 50,
          created_by: createdBy,
          status: ev.status || 'activo',
          created_at: ev.createdAt || new Date().toISOString(),
          updated_at: ev.updatedAt || new Date().toISOString()
        }])
        .select()
        .single();
      if (error) {
        console.warn(`❌ Error migrando evento ${ev.name}:`, error.message);
        continue;
      }

      // Participantes del evento
      if (ev.participantIds && ev.participantIds.length) {
        for (const pid of ev.participantIds) {
          if (pid && await existsInTable('persons', pid)) {
            await supabase
              .from('event_participants')
              .insert([{ event_id: newEvent.id, person_id: pid }]);
          } else {
            console.warn(`⚠️ Participante ${pid} no existe, omitido de evento ${ev.name}`);
          }
        }
      }

      // Escuadras
      if (ev.squads && ev.squads.length) {
        for (const sq of ev.squads) {
          let leaderId = sq.leaderId;
          if (leaderId && !(await existsInTable('persons', leaderId))) leaderId = null;

          const { data: newSquad, error: sqError } = await supabase
            .from('squads')
            .insert([{
              id: sq.id,
              event_id: newEvent.id,
              name: sq.name,
              leader_id: leaderId,
              created_at: sq.createdAt || new Date().toISOString()
            }])
            .select()
            .single();

          if (!sqError) {
            if (sq.memberIds && sq.memberIds.length) {
              for (const pid of sq.memberIds) {
                if (pid && await existsInTable('persons', pid)) {
                  await supabase
                    .from('squad_members')
                    .insert([{ squad_id: newSquad.id, person_id: pid }]);
                } else {
                  console.warn(`⚠️ Miembro ${pid} no existe, omitido de escuadra ${sq.name}`);
                }
              }
            }
            if (sq.images && sq.images.length) {
              for (const img of sq.images) {
                await supabase
                  .from('squad_images')
                  .insert([{ squad_id: newSquad.id, image_url: img }]);
              }
            }
          }
        }
      }

      // Partidas
      if (ev.matches && ev.matches.length) {
        for (const m of ev.matches) {
          let pid = m.participantId;
          if (!pid || !(await existsInTable('persons', pid))) {
            console.warn(`⚠️ Participante ${pid} no existe, partida omitida`);
            continue;
          }
          let squadId = m.squadId;
          if (squadId && !(await existsInTable('squads', squadId))) {
            squadId = null;
          }
          await supabase
            .from('matches')
            .insert([{
              id: m.id,
              event_id: newEvent.id,
              participant_id: pid,
              squad_id: squadId,
              botin: m.botin || 0,
              elim_contratistas: m.elimContratistas || 0,
              elim_otros: m.elimOtros || 0,
              minutos: m.minutos || 0,
              segundos: m.segundos || 0,
              resultado: m.resultado || '',
              timestamp: m.timestamp || new Date().toISOString()
            }]);
        }
      }
    }
    console.log(`✅ Eventos migrados.`);

    // ---------- 7. MIGRAR LOGS ----------
    const logs = await readJSON('logs.json');
    for (const log of logs) {
      let userId = log.userId;
      if (userId && !(await existsInTable('users', userId))) {
        userId = null;
      }
      await supabase
        .from('logs')
        .insert([{
          user_id: userId,
          action: log.action,
          target: log.target,
          details: log.details || {},
          timestamp: log.timestamp || new Date().toISOString()
        }]);
    }
    console.log(`✅ Logs migrados.`);

    console.log('🎉 Migración completada con éxito.');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  }
}

migrate();