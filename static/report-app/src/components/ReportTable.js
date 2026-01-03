import React, { useState, useRef } from 'react';
import { ViewIssueModal } from '@forge/jira-bridge';
import DynamicTable from '@atlaskit/dynamic-table';
import { Checkbox } from '@atlaskit/checkbox';
import Lozenge from '@atlaskit/lozenge';
import styled from 'styled-components';

const ResizeHandle = styled.div`
    width: 16px;
    height: 100%;
    cursor: col-resize;
    position: absolute;
    right: -18px;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;

    /* The visual line */
    &::after {
        content: '';
        width: 1px;
        height: 20px; 
        background-color: #DFE1E6; 
        transition: all 0.2s ease;
    }

    &:hover::after, &:active::after {
        background-color: #0052CC;
        width: 2px;
    }
`;

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
    const tableRef = useRef(null);
    const [columnWidths, setColumnWidths] = useState({
        select: 5,
        key: 10,
        summary: 30,
        assignee: 15,
        status: 10,
        timeSpent: 10,
        estimate: 10,
        comment: 10
    });

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

    const handleResize = (e, colKey, nextColKey) => {
        // Prevent sorting when clicking resize handle
        e.preventDefault();
        e.stopPropagation();

        const startX = e.pageX;
        const startWidth = columnWidths[colKey];
        const startNextWidth = columnWidths[nextColKey];
        const tableWidth = tableRef.current ? tableRef.current.offsetWidth : 1000;

        const onMouseMove = (moveEvent) => {
            if (!tableWidth) return;
            const deltaX = moveEvent.pageX - startX;
            const deltaPercent = (deltaX / tableWidth) * 100;

            const newWidth = Math.max(2, startWidth + deltaPercent);
            const newNextWidth = Math.max(2, startNextWidth - deltaPercent);

            // Only update if both have room (approximating, to ensure total stays ~100)
            // Ideally we just update delta. 
            // Since newNextWidth is calculated from startNextWidth - delta, 
            // if we bounded newWidth, we implicitely bounded delta.
            // But we need to make sure we don't break the sum.
            // Simple approach: calculate actual effective delta
            const effectiveDelta = newWidth - startWidth;

            // Check if next column can handle this delta
            if (startNextWidth - effectiveDelta < 2) return;

            setColumnWidths(prev => ({
                ...prev,
                [colKey]: startWidth + effectiveDelta,
                [nextColKey]: startNextWidth - effectiveDelta
            }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const createResizableHead = () => {
        const columns = [
            { id: 'select', label: '' },
            { id: 'key', label: 'Key' },
            { id: 'summary', label: 'Summary' },
            { id: 'assignee', label: 'Assignee' },
            { id: 'status', label: 'Status' },
            { id: 'timeSpent', label: 'Time Spent' },
            { id: 'estimate', label: 'Estimate' },
            { id: 'comment', label: 'Last Comment' }
        ];

        return {
            cells: columns.map((col, index) => {
                const isResizer = index < columns.length - 1; // Last column doesn't need resizer
                const nextColId = isResizer ? columns[index + 1].id : null;

                const content = (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>{col.id === 'select' ? (
                            <Checkbox
                                isChecked={rows.length > 0 && selectedIssues.length === rows.length}
                                isIndeterminate={selectedIssues.length > 0 && selectedIssues.length < rows.length}
                                onChange={toggleAll}
                            />
                        ) : col.label}</span>
                        {isResizer && (
                            <ResizeHandle
                                onMouseDown={(e) => handleResize(e, col.id, nextColId)}
                                onClick={(e) => e.stopPropagation()}
                                title="Resize Column"
                            />
                        )}
                        {/* Visual separator line? DynamicTable has borders. 
                            The Handle acts as the trigger. 
                        */}
                    </div>
                );

                return {
                    key: col.id,
                    content: content,
                    isSortable: col.id !== 'select' && col.id !== 'comment',
                    width: columnWidths[col.id],
                };
            }),
        };
    };

    const head = createResizableHead();

    const [sortKey, setSortKey] = useState('created');
    const [sortOrder, setSortOrder] = useState('DESC');

    const handleSort = (data) => {
        setSortKey(data.key);
        setSortOrder(data.sortOrder);
    };

    const sortedRows = [...rows].sort((a, b) => {
        if (!sortKey) return 0;

        let aValue = a[sortKey];
        let bValue = b[sortKey];

        // Handle nested or special fields
        if (sortKey === 'assignee') {
            aValue = a.assignee?.name || '';
            bValue = b.assignee?.name || '';
        } else if (sortKey === 'timeSpent') {
            aValue = a.timeSpentSeconds || 0;
            bValue = b.timeSpentSeconds || 0;
        } else if (sortKey === 'estimate') {
            aValue = a.estimateSeconds || 0;
            bValue = b.estimateSeconds || 0;
        }

        // Generic comparison
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
        return 0;
    });

    const tableRows = sortedRows.map((row) => ({
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
                content: row.assignee?.name || 'Unassigned',
            },
            {
                key: 'status',
                content: (
                    <Lozenge
                        appearance={
                            row.exceeded
                                ? 'removed'
                                : row.statusCategory === 'done'
                                    ? 'success'
                                    : row.statusCategory === 'indeterminate'
                                        ? 'inprogress'
                                        : 'default'
                        }
                    >
                        {row.status}
                    </Lozenge>
                ),
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
        <div ref={tableRef} style={{ width: '100%' }}>
            <DynamicTable
                head={head}
                rows={tableRows}
                rowsPerPage={10}
                defaultPage={1}
                loadingSpinnerSize="large"
                isLoading={loading}
                isFixedSize
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                emptyView={<div>No issues found.</div>}
            />
        </div>
    );
};

export default ReportTable;
