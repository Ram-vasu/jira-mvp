import React from 'react';
import { ViewIssueModal } from '@forge/jira-bridge';
import DynamicTable from '@atlaskit/dynamic-table';
import { Checkbox } from '@atlaskit/checkbox';
import Lozenge from '@atlaskit/lozenge';

const createHead = (withWidth) => {
    return {
        cells: [
            {
                key: 'select',
                content: '',
                isSortable: false,
                width: withWidth ? 5 : undefined,
            },
            {
                key: 'key',
                content: 'Key',
                isSortable: true,
                width: withWidth ? 10 : undefined,
            },
            {
                key: 'summary',
                content: 'Summary',
                isSortable: true,
                width: withWidth ? 30 : undefined,
            },
            {
                key: 'assignee',
                content: 'Assignee',
                isSortable: true,
                width: withWidth ? 15 : undefined,
            },
            {
                key: 'status',
                content: 'Status',
                isSortable: true,
                width: withWidth ? 10 : undefined,
            },
            {
                key: 'timeSpent',
                content: 'Time Spent',
                isSortable: true,
                width: withWidth ? 10 : undefined,
            },
            {
                key: 'estimate',
                content: 'Estimate',
                isSortable: true,
                width: withWidth ? 10 : undefined,
            },
            {
                key: 'comment',
                content: 'Last Comment',
                isSortable: false,
                width: withWidth ? 10 : undefined,
            },
        ],
    };
};

const ReportTable = ({ rows, loading, selectedIssues, onSelectionChange }) => {

    const toggleRow = (issueId) => {
        const isSelected = selectedIssues.includes(issueId);
        if (isSelected) {
            onSelectionChange(selectedIssues.filter(id => id !== issueId));
        } else {
            onSelectionChange([...selectedIssues, issueId]);
        }
    };

    const toggleAll = () => {
        if (selectedIssues.length === rows.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(rows.map(r => r.id));
        }
    };

    const head = createHead(true);

    // Add select all checkbox to header
    head.cells[0].content = (
        <Checkbox
            isChecked={rows.length > 0 && selectedIssues.length === rows.length}
            isIndeterminate={selectedIssues.length > 0 && selectedIssues.length < rows.length}
            onChange={toggleAll}
        />
    );


    const tableRows = rows.map((row) => ({
        key: row.id,
        cells: [
            {
                key: 'select',
                content: (
                    <Checkbox
                        isChecked={selectedIssues.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                    />
                ),
            },
            {
                key: 'key',
                content: (
                    <span
                        style={{ color: '#0052CC', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => {
                            const modal = new ViewIssueModal({
                                context: {
                                    issueKey: row.key,
                                },
                            });
                            modal.open();
                        }}
                    >
                        {row.key}
                    </span>
                ),
            },
            {
                key: 'summary',
                content: row.summary,
            },
            {
                key: 'assignee',
                content: row.assignee?.displayName || 'Unassigned',
            },
            {
                key: 'status',
                content: <Lozenge appearance={row.statusCategory === 'done' ? 'success' : (row.statusCategory === 'indeterminate' ? 'inprogress' : 'default')}>{row.status}</Lozenge>,
            },
            {
                key: 'timeSpent',
                content: row.timeSpent || '-',
            },
            {
                key: 'estimate',
                content: row.estimate || '-',
            },
            {
                key: 'comment',
                content: row.lastComment ? (
                    <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '12px' }}>
                        <strong>{row.lastComment.author}:</strong> {row.lastComment.body}
                    </div>
                ) : '-',
            },
        ],
    }));

    return (
        <DynamicTable
            head={head}
            rows={tableRows}
            rowsPerPage={10}
            defaultPage={1}
            loadingSpinnerSize="large"
            isLoading={loading}
            isFixedSize
            emptyView={<div>No issues found.</div>}
        />
    );
};

export default ReportTable;
