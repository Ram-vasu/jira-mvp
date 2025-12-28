import Resolver from '@forge/resolver';
import { route, asUser, asApp, storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('getProjects', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/project/search`);
  const data = await response.json();
  return data.values.map(p => ({ label: p.name, value: p.id, key: p.key }));
});

resolver.define('getUsers', async (req) => {
  const query = req.payload.query || '';
  const response = await asUser().requestJira(route`/rest/api/3/user/search?query=${query}`);
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

resolver.define('getIssues', async (req) => {
  const { project, sprint, assignee, status, startDate, endDate, exceededOnly } = req.payload;
  console.log('getIssues Payload:', JSON.stringify(req.payload));

  // Reuse the safe JQL builder
  const jql = buildJql({ project, assignee, status, startDate, endDate, exceededOnly });

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
      fields: ['summary', 'status', 'assignee', 'timetracking', 'worklog', 'comment']
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

  return data.issues.map(issue => ({
    id: issue.id,
    key: issue.key,
    url: `/browse/${issue.key}`,
    summary: issue.fields.summary,
    assignee: issue.fields.assignee ? {
      name: issue.fields.assignee.displayName,
      avatarUrl: issue.fields.assignee.avatarUrls['24x24']
    } : { name: 'Unassigned', avatarUrl: '' },
    status: issue.fields.status.name,
    timeSpent: issue.fields.timetracking.timeSpent || '0m',
    estimate: issue.fields.timetracking.originalEstimate || '0m',
    timeSpentSeconds: issue.fields.timetracking.timeSpentSeconds || 0,
    estimateSeconds: issue.fields.timetracking.originalEstimateSeconds || 0,
    exceeded: (issue.fields.timetracking.timeSpentSeconds || 0) > (issue.fields.timetracking.originalEstimateSeconds || 0),
    comments: issue.fields.comment ? issue.fields.comment.comments : []
  }));
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

resolver.define('getCurrentUserEmail', async (req) => {
  const response = await asUser().requestJira(route`/rest/api/3/myself`);
  const data = await response.json();
  return data.emailAddress || '';
});

resolver.define('saveSchedule', async (req) => {
  const schedule = req.payload;
  // Store schedules in a list. 
  // Ensure we overwrite existing schedule for this email to prevent duplicates/stale triggers
  const existingSchedules = await storage.get('schedules') || [];
  const otherSchedules = existingSchedules.filter(s => s.email !== schedule.email);

  const newSchedules = [...otherSchedules, { ...schedule, id: new Date().getTime().toString() }];
  await storage.set('schedules', newSchedules);
  console.log('Schedule saved:', schedule);
  return { success: true };
});


import * as XLSX from 'xlsx';

// Helper to build JQL (shared logic)
const buildJql = (filters) => {
  const { project, assignee, status, startDate, endDate, exceededOnly } = filters;
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

  let jql = jqlParts.join(' AND ');
  // Fix for "Unbounded JQL" error: Default to last 30 days if no filters are applied
  if (!jql) {
    jql = 'created >= -30d order by created DESC';
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

const processSchedule = async (schedule) => {
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
        // Simplified ADF text extraction
        return bodyObj?.content?.[0]?.content?.[0]?.text || ' ';
      } catch (e) { return ' '; }
    };

    // Handle Comments
    if (schedule.commentMode === 'last' && issue.fields.comment && issue.fields.comment.comments.length > 0) {
      const lastComment = issue.fields.comment.comments[issue.fields.comment.comments.length - 1];
      fullRow['Comments'] = `[${lastComment.author.displayName}]: ${extractText(lastComment.body)}`;
    } else if (schedule.commentMode === 'full' && issue.fields.comment) {
      fullRow['Comments'] = issue.fields.comment.comments.map(c => `[${c.author.displayName}]: ${extractText(c.body)}`).join('\n---\n');
    }

    // Filter Fields
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

  // 3. Create Issue to Attach To
  let projectKey = null;
  if (schedule.filters.project && schedule.filters.project.length > 0) {
    projectKey = schedule.filters.project[0].key;
  } else {
    // Search projects as App
    const projResp = await asApp().requestJira(route`/rest/api/3/project/search?maxResults=1`);
    const projData = await projResp.json();
    if (projData.values && projData.values.length > 0) {
      projectKey = projData.values[0].key;
    }
  }

  if (!projectKey) {
    console.error('Could not find a project key to create report issue.');
    return { ticket: null, reason: 'Could not find a valid project to create the report ticket.' };
  }

  try {
    // Fetch valid issue types as App
    const metaResp = await asApp().requestJira(route`/rest/api/3/issue/createmeta?projectKeys=${projectKey}`);
    const metaData = await metaResp.json();

    let issueTypeId = null;
    if (metaData.projects && metaData.projects.length > 0) {
      const projectMeta = metaData.projects[0];
      // Try to find 'Task'
      let targetType = projectMeta.issuetypes.find(it => it.name === 'Task');
      if (!targetType) {
        // Fallback to 'Story'
        targetType = projectMeta.issuetypes.find(it => it.name === 'Story');
      }
      if (!targetType && projectMeta.issuetypes.length > 0) {
        // Fallback to the first available non-subtask type
        targetType = projectMeta.issuetypes.find(it => !it.subtask) || projectMeta.issuetypes[0];
      }

      if (targetType) {
        issueTypeId = targetType.id;
      }
    }

    if (!issueTypeId) {
      console.error(`Could not find a valid issue type for project ${projectKey}`);
      return { ticket: null, reason: `Could not find a valid issue type (Task/Story) in project ${projectKey}` };
    }

    // Find User to Assign (for notification)
    let accountIdToAssign = null;
    let user = null;
    try {
      const userSearchResp = await asApp().requestJira(route`/rest/api/3/user/search?query=${schedule.email}`);
      const users = await userSearchResp.json();
      user = users.find(u => u.emailAddress === schedule.email);
      if (user) {
        accountIdToAssign = user.accountId;
      }
    } catch (e) {
      console.error('Error finding user for assignment', e);
    }

    // Create Task as App
    const issueFields = {
      project: { key: projectKey },
      summary: `Developer Report Export - ${new Date().toISOString().split('T')[0]}`,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Routine report generated for ${schedule.email}. Please find the attached Excel file.`
              }
            ]
          }
        ]
      },
      issuetype: { id: issueTypeId }
    };

    if (accountIdToAssign) {
      issueFields.assignee = { id: accountIdToAssign };
    }

    const createResp = await asApp().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: issueFields
      })
    });

    if (createResp.status === 400 || !createResp.ok) {
      const err = await createResp.text();
      console.error(`Failed to create issue: ${err}`);
      return;
    }

    const createdIssue = await createResp.json();
    const issueId = createdIssue.id;
    const issueKey = createdIssue.key;
    console.log(`Created report issue: ${issueKey}`);

    // 4. Attach File as App
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const filename = `Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    let data = `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    data += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;

    const prefix = Buffer.from(data, 'utf-8');
    const fileContent = Buffer.from(excelBuffer);
    const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf-8');

    const multipartBody = Buffer.concat([prefix, fileContent, suffix]);

    const attachResp = await asApp().requestJira(route`/rest/api/3/issue/${issueId}/attachments`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Atlassian-Token': 'no-check',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!attachResp.ok) {
      console.error('Failed to attach file', await attachResp.text());
    } else {
      console.log('Attached excel report.');
    }

    // 5. Add Comment as App (triggers notification)
    if (user) {
      const adfComment = {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                { type: "mention", attrs: { id: user.accountId, text: "@User", accessLevel: "" } },
                { type: "text", text: " Your scheduled report is ready! See the attachment in this ticket." }
              ]
            }
          ]
        }
      };

      await asApp().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adfComment)
      });
      console.log('User mentioned.');

      // 6. Add as Watcher (Triple check)
      const watcherResp = await asApp().requestJira(route`/rest/api/3/issue/${issueId}/watchers`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(user.accountId)
      });
      if (!watcherResp.ok) {
        console.error('Failed to add watcher', await watcherResp.text());
      } else {
        console.log('User added as watcher.');
      }
    }

    return { ticket: issueKey };

  } catch (e) {
    console.error('Error processing schedule', e);
    return { ticket: null, reason: e.message };
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

    // Parse Scheduled Time (HH:MM in UTC as per UI label)
    if (!schedule.time) continue;
    const [schedHour, schedMin] = schedule.time.split(':').map(Number);

    // Check if within the current hour window (since trigger is hourly)
    // We run if currentUtcHour matches schedHour. 
    // This assumes the trigger runs reasonably close to the top of the hour.
    // Limitation: If trigger runs at 17:59 and schedule is 17:00, it puts it at risk if it drifts.
    // But for MVP hourly trigger, this is standard.
    // Also check if already ran today to prevent retries or double sends if trigger runs multiple times (unlikely but safe).

    // Check Last Run
    const lastRunDate = schedule.lastRun ? schedule.lastRun.split('T')[0] : null;

    let shouldRun = false;

    if (schedule.frequency === 'daily') {
      if (currentUtcHour === schedHour && lastRunDate !== todayStr) {
        shouldRun = true;
      }
    } else if (schedule.frequency === 'weekly') {
      const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday
      // Assuming Weekly = Monday (1)
      if (currentDay === 1 && currentUtcHour === schedHour && lastRunDate !== todayStr) {
        shouldRun = true;
      }
    } else if (schedule.frequency === 'monthly') {
      const currentDate = now.getUTCDate();
      if (currentDate === 1 && currentUtcHour === schedHour && lastRunDate !== todayStr) {
        shouldRun = true;
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
