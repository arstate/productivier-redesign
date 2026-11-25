const BASE_URL = 'http://127.0.0.1:3007';

async function req(url, options = {}, cookie = '') {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data, setCookies, rawText: null };
}

async function reqText(url, options = {}, cookie = '') {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, text };
}

async function loginAs(username, password) {
  const res = await req('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const sessionPair = (res.setCookies || []).find((c) => c.startsWith('prod_session=')) || '';
  const cookie = sessionPair ? sessionPair.split(';')[0] : '';
  return { ...res, cookie, user: res.data?.user || null };
}

function getIsolatedTestDate() {
  const year = 2090 + Math.floor(Math.random() * 8);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runTests() {
  console.log('--- 🧪 STARTING PRODUCTIVIER PASS 1 SECURITY & ECOSYSTEM QA SUITE ---');
  let passCount = 0;
  let failCount = 0;

  const createdProjectIds = [];
  const createdTaskIds = [];
  const createdGroupIds = [];
  const createdTempUserIds = [];
  const baselineNotifIdsByUser = new Map();

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  let leader = null;
  let leaderCookie = '';
  let memberA = null;
  let memberACookie = '';
  let memberB = null;
  let memberBCookie = '';

  try {
    // 0. Unauthenticated Access Lockout (P0 Security Fix)
    console.log('\n[0] Testing Unauthenticated Endpoint Lockout & Share Token Portal Gate...');
    const unauthEndpoints = [
      ['/api/users', 'GET'],
      ['/api/projects', 'GET'],
      ['/api/monitoring', 'GET'],
      ['/api/realisasi', 'GET'],
      ['/api/notes', 'GET'],
      ['/api/todos', 'GET'],
      ['/api/calendar', 'GET'],
      ['/api/projects/1/client-notes', 'GET'],
      ['/api/login', 'GET'],
    ];
    for (const [ep, method] of unauthEndpoints) {
      const r = await req(ep, { method });
      assert(r.status === 401, `Unauthenticated ${method} ${ep} rejected with 401 (got ${r.status})`);
    }
    const tokenlessPortal = await reqText('/client/project/1');
    assert(
      tokenlessPortal.text.includes('Tautan Portal Terbatas'),
      'Tokenless SSR /client/project/1 blocks data leakage with "Tautan Portal Terbatas"'
    );

    // 1. Cookie Authentication + DB Hygiene Verification
    console.log('\n[1] Testing Cookie Authentication & DB Hygiene...');
    const badLogin = await loginAs('fifa', 'wrong-password-123');
    assert(badLogin.status === 401 && !badLogin.cookie, 'Wrong password returns 401 and sets no session cookie');

    const leaderAuth = await loginAs('fifa', 'cewekalay');
    assert(leaderAuth.ok && Boolean(leaderAuth.cookie) && leaderAuth.user?.role === 'admin', 'Admin login sets HttpOnly prod_session cookie');
    leader = leaderAuth.user;
    leaderCookie = leaderAuth.cookie;

    const verifyMe = await req('/api/login', { method: 'GET' }, leaderCookie);
    assert(verifyMe.ok && verifyMe.data?.authenticated === true && verifyMe.data?.user?.username === 'fifa', 'GET /api/login verifies active prod_session cookie');

    const usersRes = await req('/api/users', {}, leaderCookie);
    const allUsers = usersRes.data?.users || [];
    assert(usersRes.ok && allUsers.length >= 3, `Authenticated GET /api/users returned ${allUsers.length} users`);

    const invalidRoles = allUsers.filter((u) => u.role !== 'admin' && u.role !== 'karyawan');
    assert(invalidRoles.length === 0, `DB Hygiene: zero invalid user roles (found ${invalidRoles.length})`);

    // Resolve or authenticate 2 non-admin members
    const tim1Auth = await loginAs('tim1', 'tim123');
    if (tim1Auth.ok && tim1Auth.cookie) {
      memberA = tim1Auth.user;
      memberACookie = tim1Auth.cookie;
    }
    const tim2Auth = await loginAs('tim2', 'tim123');
    if (tim2Auth.ok && tim2Auth.cookie) {
      memberB = tim2Auth.user;
      memberBCookie = tim2Auth.cookie;
    }
    if (!memberA) {
      const uname = 'qa_mem_a_' + Date.now();
      const crA = await req('/api/users', { method: 'POST', body: JSON.stringify({ username: uname, password: 'qaPass123!', nama: 'QA Member A', divisi: 'QA', role: 'karyawan', gender: 'male' }) }, leaderCookie);
      if (crA.ok && crA.data?.id) createdTempUserIds.push(crA.data.id);
      const lA = await loginAs(uname, 'qaPass123!');
      memberA = lA.user;
      memberACookie = lA.cookie;
    }
    if (!memberB || memberB.id === memberA.id) {
      const uname = 'qa_mem_b_' + Date.now();
      const crB = await req('/api/users', { method: 'POST', body: JSON.stringify({ username: uname, password: 'qaPass123!', nama: 'QA Member B', divisi: 'QA', role: 'karyawan', gender: 'female' }) }, leaderCookie);
      if (crB.ok && crB.data?.id) createdTempUserIds.push(crB.data.id);
      const lB = await loginAs(uname, 'qaPass123!');
      memberB = lB.user;
      memberBCookie = lB.cookie;
    }
    assert(Boolean(leader && memberA && memberB && memberACookie && memberBCookie), `Authenticated leader (${leader?.nama}) and members (${memberA?.nama}, ${memberB?.nama})`);

    // Snapshot baseline notifications per user
    for (const [u, ck] of [[leader, leaderCookie], [memberA, memberACookie], [memberB, memberBCookie]]) {
      const nRes = await req(`/api/notifications?user_id=${u.id}`, {}, ck);
      baselineNotifIdsByUser.set(u.id, new Set((nRes.data?.notifications || []).map((n) => n.id)));
    }

    // 2. Multi-Assignee Project Creation, Auto Chat Room, & Client Share Token
    console.log('\n[2] Testing Project Creation, Auto Chat Room & Share Token Portal...');
    const testProjectName = 'Ecosystem QA Test Suite Project ' + Date.now();
    const initialMemberIds = Array.from(new Set([leader.id, memberA.id]));
    const createProjRes = await req('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        nama_proyek: testProjectName,
        divisi: 'Teknologi & Operasional',
        target_total: 100,
        satuan: 'Modul',
        deadline: '2026-12-15',
        pic_id: leader.id,
        member_ids: initialMemberIds,
      }),
    }, leaderCookie);

    assert(createProjRes.ok && createProjRes.data?.id, 'Created new project with ID: ' + createProjRes.data?.id);
    const createdProjId = createProjRes.data.id;
    createdProjectIds.push(createdProjId);

    const chatGroupId = createProjRes.data.chat_group_id;
    if (chatGroupId) createdGroupIds.push(chatGroupId);
    assert(chatGroupId != null, `Chat group auto-provisioned with ID: ${chatGroupId}`);

    const getProjsRes = await req('/api/projects', {}, leaderCookie);
    const junkProjs = (getProjsRes.data?.projects || []).filter((p) => p.nama_proyek.trim().toUpperCase() === 'QWQW' || /intellecta/i.test(p.nama_proyek));
    assert(junkProjs.length === 0, `DB Hygiene: zero QWQW or Intellecta projects remaining (found ${junkProjs.length})`);

    const testProject = getProjsRes.data?.projects?.find((p) => p.id === createdProjId);
    assert(testProject != null && Boolean(testProject.share_token), 'Fetched created project with share_token generated');
    assert(
      Array.isArray(testProject?.members) && testProject.members.length === initialMemberIds.length,
      `Project members assigned correctly (${testProject?.members?.length} members)`
    );

    const validPortalRes = await reqText(`/client/project/${createdProjId}?token=${encodeURIComponent(testProject.share_token)}`);
    assert(validPortalRes.ok && validPortalRes.text.includes(testProjectName), 'Valid share_token renders Client Portal SSR content');

    const tokenNotesRes = await req(`/api/projects/${createdProjId}/client-notes?token=${encodeURIComponent(testProject.share_token)}`);
    assert(tokenNotesRes.ok, 'GET /client-notes with valid share_token returns 200 without login cookie');

    const chatMsgRes = await req(`/api/chat/messages?group_id=${chatGroupId}`, {}, leaderCookie);
    const hasWelcome = chatMsgRes.data?.messages?.some((m) => m.is_ai && m.message.includes(testProjectName));
    assert(hasWelcome, 'Miu AI automatically posted welcome message in project chat group');

    // 3. Project Members API
    console.log('\n[3] Testing Project Members API (GET, POST auto-join chat, DELETE)...');
    const membersRes = await req(`/api/projects/${createdProjId}/members`, {}, leaderCookie);
    assert(
      membersRes.ok && membersRes.data.members?.length === initialMemberIds.length,
      `GET /api/projects/:id/members returned ${membersRes.data.members?.length} members`
    );
    const creatorMember = membersRes.data.members?.find((m) => m.user_id === leader.id);
    assert(creatorMember?.is_creator === true, 'Project creator flagged with is_creator = true');

    const addMemberRes = await req(`/api/projects/${createdProjId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: memberB.id, role: 'member' }),
    }, leaderCookie);
    assert(addMemberRes.ok && addMemberRes.data.members?.some((m) => m.user_id === memberB.id), `POST /members added ${memberB.nama}`);

    const groupMembersRes = await req(`/api/chat/groups/${chatGroupId}/members`, {}, leaderCookie);
    assert(groupMembersRes.data?.members?.some((m) => m.user_id === memberB.id), `${memberB.nama} auto-joined linked chat group`);

    const delMemberRes = await req(`/api/projects/${createdProjId}/members?user_id=${memberB.id}`, { method: 'DELETE' }, leaderCookie);
    assert(delMemberRes.ok, `DELETE /members removed ${memberB.nama}`);

    const groupMembersAfterDel = await req(`/api/chat/groups/${chatGroupId}/members`, {}, leaderCookie);
    assert(!groupMembersAfterDel.data?.members?.some((m) => m.user_id === memberB.id), `${memberB.nama} removed from linked chat group`);

    // 4. Input Validation + Task Delegation + Bell Notification
    console.log('\n[4] Testing Schema Validation, Task Delegation & Bell Notification...');
    const testDate = getIsolatedTestDate();
    const invalidRealisasi = await req('/api/realisasi', {
      method: 'POST',
      body: JSON.stringify({
        user_id: memberB.id,
        project_id: createdProjId,
        aktivitas: '-',
        target: 5,
        realisasi: 1,
        satuan: 'Tugas',
        tanggal: testDate,
      }),
    }, leaderCookie);
    assert(invalidRealisasi.status === 400, `Placeholder aktivitas ("-") rejected with 400 (got ${invalidRealisasi.status})`);

    const badLink = await req(`/api/projects/${createdProjId}/links`, {
      method: 'POST',
      body: JSON.stringify({ title: 'XSS Link', url: 'javascript:alert(1)', platform: 'other' }),
    }, leaderCookie);
    assert(badLink.status === 400, `Unsafe javascript: URL rejected with 400 (got ${badLink.status})`);

    const taskTitle = 'Audit API contract & security rules for QA Test';
    const delegRes = await req('/api/realisasi', {
      method: 'POST',
      body: JSON.stringify({
        user_id: memberB.id,
        assigned_to_user_id: memberB.id,
        assigned_by_user_id: leader.id,
        project_id: createdProjId,
        aktivitas: taskTitle,
        deadline: '2026-11-28',
        target: 1,
        realisasi: 0,
        satuan: 'Modul',
        tanggal: testDate,
      }),
    }, leaderCookie);
    assert(delegRes.ok && delegRes.data?.id, 'Delegated task created with ID: ' + delegRes.data?.id);
    const createdTaskId = delegRes.data.id;
    createdTaskIds.push(createdTaskId);
    assert(delegRes.data.realisasi?.assigned_to_user_id === memberB.id, `Task assigned_to_user_id is ${memberB.id}`);

    const notifResB = await req(`/api/notifications?user_id=${memberB.id}`, {}, memberBCookie);
    const delegationNotif = notifResB.data?.notifications?.find(
      (n) => n.type === 'task' && n.title.includes('Didelegasikan') && n.action_url?.includes(String(createdProjId))
    );
    assert(delegationNotif != null, `Bell notification found for assignee (${memberB.nama})`);

    // 5. Monitoring False-Positive Check
    console.log('\n[5] Testing Monitoring False-Positive Bug Fix...');
    const monitorRes = await req(`/api/monitoring?tanggal=${testDate}`, {}, leaderCookie);
    assert(monitorRes.ok, 'GET /api/monitoring returned 200 OK');
    const memberBMonitoring = monitorRes.data?.statusTim?.find((d) => d.id === memberB.id);
    assert(memberBMonitoring?.sudah_input === false, `Unworked delegated task (realisasi: 0) NOT counted as submitted`);

    // 6. Calendar Filter Isolation & mine=true
    console.log('\n[6] Testing Calendar Project Filter Isolation & ?mine=true...');
    const calProjRes = await req(`/api/calendar?month=2026-12&project_id=${createdProjId}`, {}, leaderCookie);
    const calMineRes = await req(`/api/calendar?month=2026-12&mine=true`, {}, memberBCookie);
    assert(calProjRes.ok && calMineRes.ok, 'Calendar API handles project_id & mine=true filters cleanly');
    const foreignDeadlines = (calProjRes.data?.projectDeadlines || []).filter((e) => e.project_id && e.project_id !== createdProjId);
    assert(foreignDeadlines.length === 0, 'Zero foreign project deadlines leaked in filtered response');

    // 7. Non-Admin Task Visibility under Project Hub
    console.log('\n[7] Testing Non-Admin Project Task Visibility...');
    const projTasksRes = await req(`/api/realisasi?project_id=${createdProjId}`, {}, memberACookie);
    assert(projTasksRes.ok && projTasksRes.data?.realisasi?.some((t) => t.id === createdTaskId), 'Authenticated member can view tasks in their project');

    // 8. Authorization Guard + Reassignment Sync + Completion Notification
    console.log('\n[8] Testing Task Reassignment Sync, Auth Guard & Completion Notification...');
    const unauthPatchRes = await req(`/api/realisasi/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': String(leader.id) }, // forged header!
      body: JSON.stringify({ realisasi: 1 }),
    }, memberACookie);
    assert(unauthPatchRes.status === 403, 'Forged x-user-id header ignored; non-assignee memberA blocked (403)');

    const reassignRes = await req(`/api/realisasi/${createdTaskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to_user_id: memberA.id }),
    }, leaderCookie);
    assert(
      reassignRes.ok && reassignRes.data?.realisasi?.nama === memberA.nama && reassignRes.data?.realisasi?.divisi === memberA.divisi,
      `PATCH assigned_to_user_id synced nama (${reassignRes.data?.realisasi?.nama}) & divisi (${reassignRes.data?.realisasi?.divisi})`
    );

    const updateTaskRes = await req(`/api/realisasi/${createdTaskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        realisasi: 1,
        target: 1,
        status: 'done',
        kendala: '',
        solusi: 'Completed full verification of API contract',
      }),
    }, memberACookie);
    assert(updateTaskRes.ok && updateTaskRes.data.realisasi?.realisasi === 1, 'Assigned member marked task 100% complete');

    const monitorAfterRes = await req(`/api/monitoring?tanggal=${testDate}`, {}, leaderCookie);
    const memberAMonAfter = monitorAfterRes.data?.statusTim?.find((d) => d.id === memberA.id);
    assert(memberAMonAfter?.sudah_input === true && memberAMonAfter?.jumlah_input >= 1, `Monitoring attributed completed task to ${memberA.nama}`);

    const notifResLeader = await req(`/api/notifications?user_id=${leader.id}`, {}, leaderCookie);
    const completionNotif = notifResLeader.data?.notifications?.find(
      (n) => n.type === 'task' && n.title.includes('Selesai') && n.action_url?.includes(String(createdProjId))
    );
    assert(completionNotif != null, `Completion bell notification received by leader (${leader.nama})`);

    // 9. AI Action Tool Integration (create_project)
    console.log('\n[9] Testing AI Action Tool Integration (create_project)...');
    const aiActionReqRes = await req('/api/ai/actions', {
      method: 'POST',
      body: JSON.stringify({
        action_type: 'create_project',
        payload: {
          nama_proyek: 'AI Automated QA Project ' + Date.now(),
          divisi: 'AI Engineering',
          target_total: 50,
          satuan: 'Task',
          deadline: '2026-12-31',
          pic_id: leader.id,
          member_ids: [leader.id, memberA.id, memberB.id],
        },
      }),
    }, leaderCookie);
    assert(aiActionReqRes.ok && aiActionReqRes.data?.action_request_id != null, 'AI create_project request submitted');

    const approveRes = await req('/api/ai/actions', {
      method: 'POST',
      body: JSON.stringify({
        action_request_id: aiActionReqRes.data.action_request_id,
        status: 'approved',
      }),
    }, leaderCookie);
    assert(approveRes.ok && approveRes.data?.status === 'approved', 'AI create_project approved and executed');
    const aiCreatedProjectId = approveRes.data?.result_id;
    if (aiCreatedProjectId) createdProjectIds.push(aiCreatedProjectId);

    const aiProjRes = await req('/api/projects', {}, leaderCookie);
    const aiProjObj = aiProjRes.data?.projects?.find((p) => p.id === aiCreatedProjectId);
    if (aiProjObj?.chat_group_id) createdGroupIds.push(aiProjObj.chat_group_id);

    const aiProjMembersRes = await req(`/api/projects/${aiCreatedProjectId}/members`, {}, leaderCookie);
    const expectedAiMembersCount = new Set([leader.id, memberA.id, memberB.id]).size;
    assert(aiProjMembersRes.ok && aiProjMembersRes.data?.members?.length === expectedAiMembersCount, `AI project auto-joined all ${expectedAiMembersCount} members`);

    // 10. Defensive Security & RBAC ("Tes Hacking")
    console.log('\n[10] Testing Security Hardening (Spoofing / PrivEsc / IDOR / SQLi / Secret Leak)...');
    const leakedPassword = allUsers.some((u) => 'password' in u || 'password_hash' in u || 'pass_hash' in u);
    assert(!leakedPassword, 'GET /api/users exposes zero password/hash fields');

    const ghostMemberRes = await req(`/api/projects/${createdProjId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: 999999, role: 'member' }),
    }, leaderCookie);
    assert(ghostMemberRes.status === 404, 'POST /members rejects non-existent user_id with 404');

    const removePicRes = await req(`/api/projects/${createdProjId}/members?user_id=${leader.id}`, { method: 'DELETE' }, leaderCookie);
    assert(removePicRes.status === 403, 'DELETE /members blocks removing project PIC/creator with 403');

    const spoofProjPatch = await req(`/api/projects/${createdProjId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': String(leader.id) },
      body: JSON.stringify({ nama_proyek: 'Hacked Project Title' }),
    }, memberACookie);
    assert(spoofProjPatch.status === 403, 'Non-admin karyawan blocked (403) from PATCH /api/projects even with forged x-user-id');

    const idorDelTaskRes = await req(`/api/realisasi/${createdTaskId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(leader.id) },
    }, memberBCookie);
    assert(idorDelTaskRes.status === 403, 'IDOR DELETE /api/realisasi blocked (403) for non-owner with forged x-user-id');

    const spoofAdminDelGroupRes = await req(
      `/api/chat/groups?id=${aiProjObj?.chat_group_id || chatGroupId}&user_id=${leader.id}&user_role=admin`,
      { method: 'DELETE' },
      memberBCookie
    );
    assert(spoofAdminDelGroupRes.status === 403, 'Spoofed ?user_role=admin query blocked (403) on DELETE /api/chat/groups');

    const sqliPayload = "'; DROP TABLE users; -- ' OR '1'='1";
    const sqliRes = await req(`/api/realisasi?project_id=${encodeURIComponent(sqliPayload)}`, {}, leaderCookie);
    const usersIntactRes = await req('/api/users', {}, leaderCookie);
    assert(
      (sqliRes.status === 200 || sqliRes.status === 400 || sqliRes.status === 403) &&
        usersIntactRes.ok &&
        (usersIntactRes.data?.users?.length || 0) >= 2,
      'SQLi probe safely neutralized and users table remains intact'
    );

    const logoutRes = await req('/api/login', { method: 'DELETE' }, memberBCookie);
    assert(logoutRes.ok, 'DELETE /api/login clears session cookie cleanly');
  } finally {
    console.log('\n[Cleanup] Removing temporary QA test data...');
    if (leaderCookie) {
      for (const taskId of createdTaskIds) {
        await req(`/api/realisasi/${taskId}`, { method: 'DELETE' }, leaderCookie);
      }
      for (const groupId of createdGroupIds) {
        await req(`/api/chat/groups?id=${groupId}`, { method: 'DELETE' }, leaderCookie);
      }
      for (const projId of createdProjectIds) {
        await req(`/api/projects/${projId}`, { method: 'DELETE' }, leaderCookie);
      }
      for (const uId of createdTempUserIds) {
        await req(`/api/users/${uId}`, { method: 'DELETE' }, leaderCookie);
      }
      for (const [uId, baselineSet] of baselineNotifIdsByUser.entries()) {
        const nRes = await req(`/api/notifications?user_id=${uId}`, {}, leaderCookie);
        for (const n of nRes.data?.notifications || []) {
          if (!baselineSet.has(n.id) && n.user_id === uId) {
            await req(`/api/notifications?id=${n.id}`, { method: 'DELETE' }, leaderCookie);
          }
        }
      }
    }
    console.log('Cleanup complete.');
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`========================================`);
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
