export const sortRows = (rows, sortKey, sortOrder) => {
    if (!rows || rows.length === 0) return [];
    if (!sortKey) return [...rows];

    return [...rows].sort((a, b) => {
        let aValue = a[sortKey];
        let bValue = b[sortKey];

        // Specific handling for complex objects based on how they were handled in ReportTable
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

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
        return 0;
    });
};
