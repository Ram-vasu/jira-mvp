import Resolver from '@forge/resolver';
import { route, asUser, asApp, storage, startsWith } from '@forge/api';
import * as XLSX from 'xlsx';
// Actually standard 'crypto' is available in Node 24.
import { randomUUID } from 'crypto';

const resolver = new Resolver();

resolver.define('getProjects', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/project/search`);
  const data = await response.json();
  return data.values.map(p => ({ label: p.name, value: p.id, key: p.key }));
});

resolver.define('getUsers', async (req) => {
  const { query, projectKeys } = req.payload || {};
  let url = route`/rest/api/3/user/search?query=${query || ''}`;

  if (projectKeys && projectKeys.length > 0) {
    // Use assignable/search for the first project (multis not supported easily in one call but 'search' is broad)
    // actually user/search is global. user/assignable/search checks permission.
    // If we want users in a project, assignable multiProjectSearch is best
    const projectKeysStr = projectKeys.join(',');
    url = route`/rest/api/3/user/assignable/multiProjectSearch?projectKeys=${projectKeysStr}&query=${query || ''}`;
  }

  const response = await asUser().requestJira(url);
  const data = await response.json();
  return data.map(u => ({ label: u.displayName, value: u.accountId, avatarUrl: u.avatarUrls['24x24'] }));
});

resolver.define('getStatuses', async (req) => {
  // Fetch generic statuses or from a specific project if provided
  // For now, fetch global statuses
  const response = await asUser().requestJira(route`/rest/api/3/status`);
  const data = await response.json();
  return data.map(s => ({ label: s.name, value: s.name }));
});

resolver.define('getIssueTypes', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/issuetype`);
  const data = await response.json();
  // Filter out subtasks if needed, or keep them. Usually people assume standard types. 
  // Let's keep all for now but maybe filter abstract ones if necessary.
  return data.map(t => ({ label: t.name, value: t.name, iconUrl: t.iconUrl }));
});

resolver.define('getPriorities', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/priority`);
  const data = await response.json();
  return data.map(p => ({ label: p.name, value: p.name, iconUrl: p.iconUrl }));
});

resolver.define('getLabels', async (req) => {
  const { projectKeys } = req.payload || {};
  let labels = new Set();

  // Method 1: If project context, scan recent issues for labels
  if (projectKeys && projectKeys.length > 0) {
    try {
      const jql = `project in (${projectKeys.map(k => `"${k}"`).join(',')}) AND labels is not EMPTY order by updated DESC`;
      const response = await asUser().requestJira(route`/rest/api/3/search?jql=${jql}&fields=labels&maxResults=50`);
      const data = await response.json();
      if (data.issues) {
        data.issues.forEach(issue => {
          if (issue.fields.labels) {
            issue.fields.labels.forEach(l => labels.add(l));
          }
        });
      }
    } catch (e) {
      console.error("Error fetching labels from issues:", e);
    }
  }

  // Method 2: JQL Autocomplete (Generic) - often requires query
  // We can try calling it potentially, or just fallback if we have nothing.
  if (labels.size === 0) {
    try {
      const response = await asUser().requestJira(route`/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels`);
      const data = await response.json();
      if (data.results) {
        data.results.forEach(r => labels.add(r.value));
      }
    } catch (e) {
      console.error("Error fetching labels from autocomplete:", e);
    }
  }

  return Array.from(labels).sort().map(l => ({ label: l, value: l }));
});

resolver.define('getSprints', async (req) => {
  const { projectKeys } = req.payload || {};
  let sprints = [];

  if (projectKeys && projectKeys.length > 0) {
    // Try to find boards for these projects
    // This is expensive if many projects. Limit to first one or two?
    // Or use JQL to find future/active sprints?
    // JQL: project in (A) AND sprint in openSprints() ?
    // simpler: search boards.
    try {
      for (const pKey of projectKeys.slice(0, 3)) { // Limit to 3 projects to avoid timeout
        const boardResp = await asUser().requestJira(route`/rest/agile/1.0/board?projectKeyOrId=${pKey}`);
        const boardData = await boardResp.json();
        if (boardData.values) {
          for (const board of boardData.values) {
            // Get sprints for board
            const sprintResp = await asUser().requestJira(route`/rest/agile/1.0/board/${board.id}/sprint?state=active,future&maxResults=50`);
            const sprintData = await sprintResp.json();
            if (sprintData.values) {
              sprints.push(...sprintData.values);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching sprints via boards', e);
    }
  }

  // Fallback or if no project, try generic suggestion (often empty) or just return what we have
  if (sprints.length === 0) {
    const response = await asUser().requestJira(route`/rest/api/3/jql/autocompletedata/suggestions?fieldName=sprint`);
    const data = await response.json();
    const suggestions = (data.results || []).map(r => ({ label: r.displayName, value: r.value, id: r.value })); // value usually ID
    return suggestions;
  }

  // Deduplicate by ID
  const uniqueSprints = Array.from(new Map(sprints.map(s => [s.id, s])).values());

  return uniqueSprints.map(s => ({ label: s.name, value: s.id }));
});

resolver.define('getParents', async (req) => {
  const { projectKeys } = req.payload || {};

  if (projectKeys && projectKeys.length > 0) {
    // Use JQL to find Epics within the projects.
    // Note: "issuetype = Epic" works for standard Jira Software projects. 
    // For Next-Gen (Team-Managed), it usually also works, or might be "issuetype = 'Epic'".
    const jql = `project in (${projectKeys.map(k => `"${k}"`).join(',')}) AND (issuetype = Epic OR issuetype = "Epic") order by created DESC`;
    try {
      const response = await asUser().requestJira(route`/rest/api/3/search?jql=${jql}&fields=summary,key&maxResults=100`);
      const data = await response.json();
      return (data.issues || []).map(i => ({ label: `${i.key} - ${i.fields.summary}`, value: i.key }));
    } catch (e) {
      console.error("Error fetching parents/epics:", e);
      return [];
    }
  }

  // Fallback to autocomplete if no project selected
  const response = await asUser().requestJira(route`/rest/api/3/jql/autocompletedata/suggestions?fieldName=parent`);
  const data = await response.json();
  return (data.results || []).map(r => ({ label: r.displayName, value: r.value }));
});

resolver.define('getIssues', async (req) => {
  const { project, sprint, assignee, status, startDate, endDate, exceededOnly, issueType, priority, labels, parent } = req.payload;
  console.log('getIssues Payload:', JSON.stringify(req.payload));

  // Reuse the safe JQL builder
  const jql = buildJql({ project, assignee, status, startDate, endDate, exceededOnly, issueType, priority, labels, parent, sprint });

  console.log(`Searching with JQL: ${jql}`);

  // Reverting to GET with proper encoding
  // The endpoint /rest/api/3/search is deprecated and returns 410. Switching to /rest/api/3/search/jql
  const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql: jql,
      fields: ['summary', 'status', 'assignee', 'timetracking', 'worklog', 'comment', 'priority', 'labels', 'parent']
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Jira API Error: ${response.status} ${err}`);
    throw new Error(`Jira API Error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.issues) {
    console.warn('No issues found in response', data);
    return [];
  }

  return data.issues.map(issue => {
    // Helper to extract text from ADF
    const extractText = (bodyObj) => {
      try {
        return bodyObj?.content?.[0]?.content?.[0]?.text || ' ';
      } catch (e) { return ' '; }
    };

    let lastCommentObj = null;
    if (issue.fields.comment && issue.fields.comment.comments && issue.fields.comment.comments.length > 0) {
      const last = issue.fields.comment.comments[issue.fields.comment.comments.length - 1];
      lastCommentObj = {
        author: last.author.displayName,
        body: extractText(last.body)
      };
    }

    return {
      id: issue.id,
      key: issue.key,
      url: `/browse/${issue.key}`,
      summary: issue.fields.summary,
      assignee: issue.fields.assignee ? {
        name: issue.fields.assignee.displayName,
        avatarUrl: issue.fields.assignee.avatarUrls['24x24']
      } : { name: 'Unassigned', avatarUrl: '' },
      status: issue.fields.status.name,
      statusCategory: issue.fields.status.statusCategory ? issue.fields.status.statusCategory.key : 'new',
      timeSpent: issue.fields.timetracking.timeSpent || '0m',
      estimate: issue.fields.timetracking.originalEstimate || '0m',
      timeSpentSeconds: issue.fields.timetracking.timeSpentSeconds || 0,
      estimateSeconds: issue.fields.timetracking.originalEstimateSeconds || 0,
      exceeded: (issue.fields.timetracking.timeSpentSeconds || 0) > (issue.fields.timetracking.originalEstimateSeconds || 0),
      comments: issue.fields.comment ? issue.fields.comment.comments : [],
      lastComment: lastCommentObj,
      priority: issue.fields.priority ? issue.fields.priority.name : '',
      labels: issue.fields.labels || []
    };
  });
});

resolver.define('bulkAddComment', async (req) => {
  const { issueKeys, comment, mentions } = req.payload; // mentions: array of { value: accountId, label: displayName }
  const results = [];

  const adfContent = [
    {
      type: 'paragraph',
      content: [
        {
          text: comment || ' ',
          type: 'text'
        }
      ]
    }
  ];

  if (mentions && mentions.length > 0) {
    const mentionNodes = [];
    mentionNodes.push({ type: 'text', text: 'CC: ' });

    mentions.forEach((user, index) => {
      mentionNodes.push({
        type: 'mention',
        attrs: {
          id: user.value,
          text: '@' + user.label,
          accessLevel: ''
        }
      });
      if (index < mentions.length - 1) {
        mentionNodes.push({ type: 'text', text: ' ' });
      }
    });

    adfContent.push({
      type: 'paragraph',
      content: mentionNodes
    });
  }

  for (const issueKey of issueKeys) {
    try {
      await asUser().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: adfContent
          }
        })
      });
      results.push({ key: issueKey, status: 'success' });
    } catch (e) {
      results.push({ key: issueKey, status: 'failed', error: e.message });
    }
  }
  return results;
});

resolver.define('getCurrentUser', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/myself`);
  const data = await response.json();
  return {
    accountId: data.accountId,
    email: data.emailAddress,
    name: data.displayName
  };
});

resolver.define('saveReport', async (req) => {
  const { name, filters, columns, sort, visibility, projectKey } = req.payload;

  // Get current user
  const accountId = req.context.accountId;

  let id;
  // Robust ID generation
  try {
    id = randomUUID();
  } catch (e) {
    id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  const reportKey = `report:${id}`;

  const report = {
    id,
    name,
    ownerAccountId: accountId,
    visibility, // 'private', 'project', 'global'
    projectKey: visibility === 'project' ? projectKey : null,
    filters,
    columns,
    sort,
    createdAt: new Date().toISOString()
  };

  await storage.set(reportKey, report);
  return report;
});

resolver.define('getReports', async (req) => {
  const { projectKey } = req.payload || {};
  const accountId = req.context.accountId;

  console.log(`[getReports] Fetching. Account: ${accountId}`);

  let reports = [];
  try {
    // Intentionally fetching everything (limit 100) and manually filtering keys
    // to bypass potential 'where' clause issues or import mix-ups.
    const query = storage.query().limit(100);
    const result = await query.getMany();

    console.log(`[getReports] Raw storage fetch count: ${result.results ? result.results.length : 0}`);

    if (result.results) {
      result.results.forEach(row => {
        // Manual key prefix check
        if (row.key && row.key.indexOf('report:') === 0) {
          console.log(`[getReports] Found report key: ${row.key}`);
          if (row.value) reports.push(row.value);
        }
      });
    }
  } catch (e) {
    console.error("[getReports] Storage Fatal Error:", e);
    return [];
  }

  console.log(`[getReports] Extracted ${reports.length} report objects. Filtering...`);

  // Filter
  return reports.filter(r => {
    if (!r) return false;

    // 1. Global: Visible to all
    if (r.visibility === 'global') return true;

    // 2. Private: Must be owner
    if (r.visibility === 'private') return r.ownerAccountId === accountId;

    // 3. Project: Visible if in correct project OR if user is owner
    if (r.visibility === 'project') {
      return (r.ownerAccountId === accountId) || (projectKey && r.projectKey === projectKey);
    }

    return false;
  });
});

resolver.define('deleteReport', async (req) => {
  const { reportId } = req.payload;
  const accountId = req.context.accountId;

  console.log(`[deleteReport] Attempting to delete reportId: ${reportId} for account: ${accountId}`);

  let key = `report:${reportId}`;
  let report = await storage.get(key);

  if (!report) {
    console.warn(`[deleteReport] Direct key lookup failed for ${key}. Searching all reports...`);

    // Fallback: search by content ID
    // This is expensive but necessary if keys became desynchronized
    const query = storage.query().limit(100);
    const result = await query.getMany();

    if (result.results) {
      const match = result.results.find(row => row.value && row.value.id === reportId);
      if (match) {
        console.log(`[deleteReport] Found report via scan. Key: ${match.key}`);
        key = match.key;
        report = match.value;
      }
    }
  }

  if (!report) {
    console.error(`[deleteReport] Report not found after scan.`);
    throw new Error("Report not found");
  }

  // Permission check: Owner or Admin
  if (report.ownerAccountId !== accountId) {
    console.warn(`[deleteReport] Permission denied. Owner: ${report.ownerAccountId}, Requestor: ${accountId}`);
    throw new Error("You do not have permission to delete this report.");
  }

  await storage.delete(key);
  console.log(`[deleteReport] Successfully deleted ${key}`);
  return { success: true };
});

resolver.define('saveSchedule', async (req) => {
  const schedule = req.payload;
  console.log('Saving schedule with payload:', JSON.stringify(schedule));
  const existingSchedules = await storage.get('schedules') || [];
  // Ensure we overwrite existing schedule for this email to prevent duplicates/stale triggers
  const otherSchedules = existingSchedules.filter(s => s.email !== schedule.email);

  const newSchedules = [...otherSchedules, { ...schedule, id: new Date().getTime().toString() }];
  await storage.set('schedules', newSchedules);
  return { success: true };
});




// Helper to build JQL (shared logic)
const buildJql = (filters) => {
  const { project, assignee, status, startDate, endDate, exceededOnly, issueType, priority, labels, parent, sprint } = filters;
  let jqlParts = [];

  if (project && Array.isArray(project) && project.length > 0) {
    const projectKeys = project.filter(p => p && p.key).map(p => `"${p.key}"`).join(',');
    if (projectKeys) jqlParts.push(`project in (${projectKeys})`);
  }

  if (assignee && Array.isArray(assignee) && assignee.length > 0) {
    const assigneeList = assignee.filter(a => a && a.value).map(a => `"${a.value}"`).join(',');
    if (assigneeList) jqlParts.push(`assignee in (${assigneeList})`);
  }

  if (status && Array.isArray(status) && status.length > 0) {
    const statusList = status.filter(s => s && s.value).map(s => `"${s.value}"`).join(',');
    if (statusList) jqlParts.push(`status in (${statusList})`);
  }

  if (startDate && endDate) {
    jqlParts.push(`updated >= "${startDate}" AND updated <= "${endDate}"`);
  }

  if (exceededOnly) {
    jqlParts.push(`workRatio > 100`);
  }

  // Add Issue Type Filter
  if (issueType && Array.isArray(issueType) && issueType.length > 0) {
    const typeList = issueType.filter(t => t && t.value).map(t => `"${t.value}"`).join(',');
    if (typeList) jqlParts.push(`issuetype in (${typeList})`);
  }

  // Priority
  if (priority && Array.isArray(priority) && priority.length > 0) {
    const list = priority.filter(i => i && i.value).map(i => `"${i.value}"`).join(',');
    if (list) jqlParts.push(`priority in (${list})`);
  }

  // Labels
  if (labels && Array.isArray(labels) && labels.length > 0) {
    const list = labels.filter(i => i && i.value).map(i => `"${i.value}"`).join(',');
    if (list) jqlParts.push(`labels in (${list})`);
  }

  // Sprint
  if (sprint && Array.isArray(sprint) && sprint.length > 0) {
    const list = sprint.filter(i => i && i.value).map(i => `${i.value}`).join(','); // values often contain spaces or are IDs, ensure quotes or not? 
    // Suggestion API values usually come with quotes if needed, but let's be careful. 
    // Actually, suggestion API 'value' for Sprint is usually the ID or name. If name, it needs quotes. If ID, it doesn't.
    // Safer to just trust the value provided by suggestion API?
    // Let's assume passed values are raw and wrap in quotes if they are non-numeric strings? 
    // Or just blindly map to what we have. API usually returns '123' or 'Sprint Name'. 
    // Let's use value directly but check quotes.
    // JQL: sprint in (1, "Sprint Name")
    const safeList = sprint.map(s => {
      const val = s.value;
      // if numeric, return as is. if string, quote it.
      return isNaN(val) ? `"${val}"` : val;
    }).join(',');
    if (safeList) jqlParts.push(`sprint in (${safeList})`);
  }

  // Parent (Epics)
  if (parent && Array.isArray(parent) && parent.length > 0) {
    const list = parent.filter(i => i && i.value).map(i => `"${i.value}"`).join(',');
    if (list) jqlParts.push(`parent in (${list})`);
  }

  let jql = jqlParts.join(' AND ');
  // If no filters, show all issues (ordered by creation). 
  // Removed strict 30d limit to satisfy "Show all tickets" requirement.
  if (!jql) {
    // API 400s on just "ORDER BY ...", so we add a catch-all condition
    jql = 'created is not empty order by created DESC';
  } else {
    jql += ' order by created DESC';
  }
  return jql;
};

// Helper to fetch issues
const fetchIssues = async (jql) => {
  const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql: jql,
      fields: ['summary', 'status', 'assignee', 'timetracking', 'worklog', 'comment']
    })
  });

  if (!response.ok) {
    console.error(`Jira API Error: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.issues || [];
};

// Expose a way to test the schedule immediately
resolver.define('triggerSchedule', async (req) => {
  const { email } = req.payload;
  console.log(`Manually triggering schedule for ${email}`);

  // Retrieve schedules and find the one for this email
  const schedules = await storage.get('schedules') || [];
  // Find the LAST matching schedule (most recent) to handle legacy duplicates
  // filtering by active as well
  const userSchedules = schedules.filter(s => s.email === email && s.active);
  const schedule = userSchedules.length > 0 ? userSchedules[userSchedules.length - 1] : null;

  if (schedule) {
    const result = await processSchedule(schedule);
    if (result && result.ticket) {
      return { success: true, message: `Report generated! Notification sent via ticket ${result.ticket}`, ticket: result.ticket };
    }
    return { success: false, message: result?.reason || 'Report generation failed. Check logs.' };
  }
  return { success: false, message: 'No active schedule found for this email.' };
});

// Specialized fetch for scheduler (running as App)
const fetchIssuesForScheduler = async (jql) => {
  const response = await asApp().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql: jql,
      fields: ['summary', 'status', 'assignee', 'timetracking', 'worklog', 'comment']
    })
  });

  if (!response.ok) {
    console.error(`Jira API Error: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.issues || [];
};

// Helper to get issue details for validation
const getIssue = async (issueKeyOrId) => {
  try {
    const response = await asApp().requestJira(route`/rest/api/3/issue/${issueKeyOrId}`);
    if (response.ok) return await response.json();
  } catch (e) {
    console.error('getIssue check failed', e);
  }
  return null;
};

const processSchedule = async (schedule) => {
  try {
    console.log(`Processing schedule for ${schedule.email}`);

    // 1. Fetch Data
    const jql = buildJql(schedule.filters);
    const issues = await fetchIssuesForScheduler(jql);

    if (issues.length === 0) {
      console.log('No issues found for schedule, skipping.');
      return { ticket: null, reason: 'No issues found matching the criteria.' };
    }

    // 2. Generate Excel (SheetJS)
    const rows = issues.map(issue => {
      const fullRow = {
        Key: issue.key,
        Summary: issue.fields.summary,
        Assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
        Status: issue.fields.status.name,
        TimeSpent: issue.fields.timetracking.timeSpent || '0m',
        Estimate: issue.fields.timetracking.originalEstimate || '0m',
        Exceeded: (issue.fields.timetracking.timeSpentSeconds || 0) > (issue.fields.timetracking.originalEstimateSeconds || 0) ? 'Yes' : 'No',
        Comments: ''
      };

      const extractText = (bodyObj) => {
        try {
          return bodyObj?.content?.[0]?.content?.[0]?.text || ' ';
        } catch (e) { return ' '; }
      };

      if (schedule.commentMode === 'last' && issue.fields.comment && issue.fields.comment.comments.length > 0) {
        const lastComment = issue.fields.comment.comments[issue.fields.comment.comments.length - 1];
        fullRow['Comments'] = `[${lastComment.author.displayName}]: ${extractText(lastComment.body)}`;
      } else if (schedule.commentMode === 'full' && issue.fields.comment) {
        fullRow['Comments'] = issue.fields.comment.comments.map(c => `[${c.author.displayName}]: ${extractText(c.body)}`).join('\n---\n');
      }

      if (!schedule.selectedFields || schedule.selectedFields.length === 0) return fullRow;

      const filteredRow = {};
      schedule.selectedFields.forEach(field => {
        if (fullRow.hasOwnProperty(field)) {
          filteredRow[field] = fullRow[field];
        }
      });

      return filteredRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // 3. Determine Target Issue (Create New vs Use Existing)
    let issueId = null;
    let issueKey = null;
    let accountIdToAssign = null;

    // Find User (Common logic)
    if (schedule.accountId) {
      accountIdToAssign = schedule.accountId;
    } else {
      try {
        const userSearchResp = await asApp().requestJira(route`/rest/api/3/user/search?query=${schedule.email}`);
        const users = await userSearchResp.json();
        const user = users.find(u => u.emailAddress === schedule.email) || users[0];
        if (user) accountIdToAssign = user.accountId;
      } catch (e) { console.error('Error finding user', e); }
    }

    // --- DESTINATION: COMMENT ---
    if (schedule.destination === 'comment' && schedule.targetIssueKey) {
      console.log(`Destination is Comment on ${schedule.targetIssueKey}`);
      const targetIssue = await getIssue(schedule.targetIssueKey);
      if (!targetIssue) {
        return { ticket: null, reason: `Target issue ${schedule.targetIssueKey} not found or not accessible.` };
      }
      issueId = targetIssue.id;
      issueKey = targetIssue.key;
    }
    // --- DESTINATION: CREATE ISSUE ---
    else {
      // Determine Project
      let projectKey = null;
      if (schedule.filters.project && schedule.filters.project.length > 0) {
        projectKey = schedule.filters.project[0].key;
      } else {
        const projResp = await asApp().requestJira(route`/rest/api/3/project/search?maxResults=1`);
        const projData = await projResp.json();
        if (projData.values && projData.values.length > 0) projectKey = projData.values[0].key;
      }

      if (!projectKey) return { ticket: null, reason: 'No project found to create report issue.' };

      // Valid Issue Type
      const metaResp = await asApp().requestJira(route`/rest/api/3/issue/createmeta?projectKeys=${projectKey}`);
      const metaData = await metaResp.json();
      let issueTypeId = null;
      if (metaData.projects && metaData.projects.length > 0) {
        const pMeta = metaData.projects[0];
        const t = pMeta.issuetypes.find(it => it.name === 'Task') || pMeta.issuetypes.find(it => it.name === 'Story') || pMeta.issuetypes[0];
        if (t) issueTypeId = t.id;
      }

      if (!issueTypeId) return { ticket: null, reason: `No valid issue type in ${projectKey}` };

      // Create Issue
      const issueFields = {
        project: { key: projectKey },
        summary: `Developer Report Export - ${new Date().toISOString().split('T')[0]}`,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: schedule.message || "Routine report generated." }] }]
        },
        issuetype: { id: issueTypeId }
      };
      if (accountIdToAssign) issueFields.assignee = { id: accountIdToAssign };

      const createResp = await asApp().requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: issueFields })
      });

      if (!createResp.ok) return { ticket: null, reason: `Failed to create issue: ${await createResp.text()}` };
      const createdIssue = await createResp.json();
      issueId = createdIssue.id;
      issueKey = createdIssue.key;
    }

    // 4. Attach File
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const filename = `Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    let data = `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    data += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;

    const prefix = Buffer.from(data, 'utf-8');
    const fileContent = Buffer.from(excelBuffer);
    const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
    const multipartBody = Buffer.concat([prefix, fileContent, suffix]);

    await asApp().requestJira(route`/rest/api/3/issue/${issueId}/attachments`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'X-Atlassian-Token': 'no-check', 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipartBody
    });

    // 5. Add Comment (Notification / Message)
    // Even if we created the issue with description, adding a comment ensures notification (watcher/assignee often don't get 'create' email if self-assigned, but app-assigned might)
    // If destination='comment', this IS the primary mechanism.
    if (issueId) {
      const msg = schedule.message || "Your scheduled report is ready! See the attachment in this ticket.";

      // Construct simplified paragraph with mention
      const content = [];
      if (accountIdToAssign) {
        content.push({ type: "mention", attrs: { id: accountIdToAssign, text: "@User" } });
        content.push({ type: "text", text: " " });
      }
      content.push({ type: "text", text: msg });

      const adfComment = {
        body: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: content }]
        }
      };

      await asApp().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adfComment)
      });

      // 6. Watcher
      if (accountIdToAssign) {
        await asApp().requestJira(route`/rest/api/3/issue/${issueId}/watchers`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(accountIdToAssign)
        });
      }
    }

    return { ticket: issueKey };
  } catch (e) {
    console.error('Error processing schedule', e);
    return { ticket: null, reason: e.message || 'Unknown error occurred in processSchedule' };
  }
};

export const scheduler = async (event) => {
  console.log('Scheduler triggered');
  const schedules = await storage.get('schedules') || [];
  const now = new Date();
  const currentUtcHour = now.getUTCHours();
  const todayStr = now.toISOString().split('T')[0];

  let schedulesUpdated = false;

  for (let schedule of schedules) {
    if (!schedule.active) continue;
    if (!schedule.time) continue;

    const [schedHour, schedMin] = schedule.time.split(':').map(Number);

    // Check Last Run
    const lastRunDate = schedule.lastRun ? schedule.lastRun.split('T')[0] : null;

    let shouldRun = false;

    // Check Hour Match (Simple)
    if (currentUtcHour === schedHour) {
      if (schedule.frequency === 'daily') {
        if (lastRunDate !== todayStr) shouldRun = true;
      } else if (schedule.frequency === 'weekly') {
        const currentDay = now.getUTCDay(); // 0 (Sun) - 6 (Sat)
        // Default to Monday (1) if undefined
        const targetDay = schedule.weekDay !== undefined ? schedule.weekDay : 1;
        if (currentDay === targetDay && lastRunDate !== todayStr) shouldRun = true;
      } else if (schedule.frequency === 'monthly') {
        const currentDate = now.getUTCDate();
        // Default to 1st if undefined
        const targetDate = schedule.monthDate !== undefined ? schedule.monthDate : 1;
        if (currentDate === targetDate && lastRunDate !== todayStr) shouldRun = true;
      }
    }

    if (shouldRun) {
      console.log(`Running scheduled export for ${schedule.email} at ${schedule.time} UTC`);
      const result = await processSchedule(schedule);
      if (result && result.ticket) {
        schedule.lastRun = now.toISOString();
        schedulesUpdated = true;
      }
    }
  }

  if (schedulesUpdated) {
    await storage.set('schedules', schedules);
  }
};

export const handler = resolver.getDefinitions();
