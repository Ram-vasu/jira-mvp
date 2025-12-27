import Resolver from '@forge/resolver';
import { route, asUser } from '@forge/api';

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

  let jqlParts = [];

  if (project && Array.isArray(project) && project.length > 0) {
    const projectKeys = project
      .filter(p => p && p.key)
      .map(p => `"${p.key}"`)
      .join(',');
    if (projectKeys) {
      jqlParts.push(`project in (${projectKeys})`);
    }
  }

  if (assignee && Array.isArray(assignee) && assignee.length > 0) {
    const assigneeList = assignee
      .filter(a => a && a.value)
      .map(a => `"${a.value}"`)
      .join(',');
    if (assigneeList) {
      jqlParts.push(`assignee in (${assigneeList})`);
    }
  }

  if (status && Array.isArray(status) && status.length > 0) {
    const statusList = status
      .filter(s => s && s.value)
      .map(s => `"${s.value}"`)
      .join(',');
    if (statusList) {
      jqlParts.push(`status in (${statusList})`);
    }
  }

  if (startDate && endDate) {
    jqlParts.push(`updated >= "${startDate}" AND updated <= "${endDate}"`);
  }

  if (exceededOnly) {
    jqlParts.push(`workRatio > 100`);
  }

  let jql = jqlParts.join(' AND ');
  if (!jql) jql = 'order by created DESC';

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

export const handler = resolver.getDefinitions();
