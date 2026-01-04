import React, { useState, useEffect } from 'react';
import { invoke, view } from '@forge/bridge';
import Button from '@atlaskit/button';
import Select from '@atlaskit/select';
import { AutoDismissFlag, FlagGroup } from '@atlaskit/flag';
import SuccessIcon from '@atlaskit/icon/glyph/check-circle';
import ErrorIcon from '@atlaskit/icon/glyph/error';
import { token } from '@atlaskit/tokens';

import FilterBar from './FilterBar';
import ReportTable from './ReportTable';
import BulkCommentModal from './BulkCommentModal';
import ExportModal from './ExportModal';
import ScheduleExportModal from './ScheduleExportModal';
import SaveReportModal from './SaveReportModal';
import ManageReportsModal from './ManageReportsModal';

const Dashboard = () => {
    // Lifted State from ReportTable
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
    const [sortKey, setSortKey] = useState('key');
    const [sortOrder, setSortOrder] = useState('DESC');

    // Safety list matches ReportTable columns
    const validSortKeys = ['key', 'summary', 'assignee', 'status', 'timeSpent', 'estimate'];

    // --- Filter State Management ---
    // activeFilters: The filters currently applied to the Table query
    const [activeFilters, setActiveFilters] = useState({});

    // filterState: The current state of the FilterBar inputs
    // Initialize with stable defaults to prevent reference-change loops in FilterBar
    const [filterState, setFilterState] = useState({
        project: [],
        sprint: [],
        assignee: [],
        status: [],
        issueType: [],
        priority: [],
        labels: [],
        parent: [],
        startDate: null,
        endDate: null,
        exceededOnly: false
    });

    // Data State
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIssues, setSelectedIssues] = useState([]);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isSaveReportModalOpen, setIsSaveReportModalOpen] = useState(false);
    const [isManageReportsModalOpen, setIsManageReportsModalOpen] = useState(false);

    // Saved Reports State
    const [savedReports, setSavedReports] = useState([]);
    const [selectedReportOption, setSelectedReportOption] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [projectContext, setProjectContext] = useState(null);

    // Toaster State
    const [flags, setFlags] = useState([]);

    const addFlag = ({ title, description, appearance = 'info' }) => {
        const id = Date.now().toString();
        const icon = appearance === 'success'
            ? <SuccessIcon label="Success" primaryColor={token('color.icon.success', '#36B37E')} />
            : (appearance === 'error'
                ? <ErrorIcon label="Error" primaryColor={token('color.icon.danger', '#FF5630')} />
                : undefined);

        setFlags(prev => [{ id, title, description, appearance, icon }, ...prev]);
    };

    const handleDismissFlag = (id) => {
        setFlags(prev => prev.filter(flag => flag.id !== id));
    };

    const fetchData = async (queryFilters) => {
        setLoading(true);
        try {
            const issues = await invoke('getIssues', queryFilters);
            setRows(issues);
            setSelectedIssues([]);
        } catch (err) {
            console.error('Failed to fetch issues', err);
            addFlag({ title: 'Error', description: 'Failed to fetch issues', appearance: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        try {
            const context = await view.getContext();
            const projectKey = context.extension?.project?.key || context.extension?.issue?.key?.split('-')[0]; // Context might be issue or project or global
            setProjectContext(projectKey);

            const reports = await invoke('getReports', { projectKey });
            setSavedReports(reports);
        } catch (e) {
            console.error('Failed to fetch reports', e);
            addFlag({ title: 'Error', description: 'Failed to fetch saved reports.', appearance: 'error' });
        }
    };

    const fetchUser = async () => {
        try {
            const user = await invoke('getCurrentUser');
            setCurrentUser(user);
        } catch (e) { console.error(e); }
    };

    // Effect: Query data when activeFilters changes (Applied)
    useEffect(() => {
        fetchData(activeFilters);
    }, [activeFilters]);

    useEffect(() => {
        fetchReports();
        fetchUser();
    }, []);

    // FilterBar logic
    const handleFilterStateChange = (newState) => {
        setFilterState(newState);
        // We do trigger a UI update for the bar, but NOT a fetch, until Apply is clicked
    };

    const handleApplyFilters = (newFilters) => {
        // user clicked Apply in FilterBar
        // If an argument is passed (e.g. from Clear), use it. Otherwise use current filterState.
        // We check if newFilters is a synthetic event (onClick) or a data object.
        const filtersToApply = (newFilters && !newFilters.nativeEvent) ? newFilters : filterState;
        setActiveFilters(filtersToApply);
    };

    const handleSelectionChange = (newSelection) => {
        setSelectedIssues(newSelection);
    };

    const handleSaveReport = async ({ name, visibility }) => {
        try {
            // CRITICAL FIX: Save 'filterState' (what's in the inputs), NOT 'activeFilters'
            const report = await invoke('saveReport', {
                name, visibility, projectKey: projectContext,
                filters: filterState,
                columns: columnWidths, sort: { key: sortKey, sortOrder }
            });
            setIsSaveReportModalOpen(false);

            // Optimistic update
            setSavedReports(prev => [...prev, report]);
            setSelectedReportOption({ label: report.name, value: report });
            addFlag({ title: 'Success', description: `Report "${name}" saved successfully.`, appearance: 'success' });
        } catch (e) {
            console.error('Failed to save report', e);
            addFlag({ title: 'Error', description: 'Failed to save report.', appearance: 'error' });
        }
    };

    const handleLoadReport = (option) => {
        if (!option) {
            setSelectedReportOption(null);
            // Reset to default state (Clear all)
            const resetState = {
                project: [], sprint: [], assignee: [], status: [],
                issueType: [], priority: [], labels: [], parent: [],
                startDate: null, endDate: null, exceededOnly: false
            };
            setFilterState(resetState);
            setActiveFilters(resetState); // Triggers fetch
            return;
        }
        const report = option.value;
        setSelectedReportOption(option);

        const loadedFilters = report.filters || {};

        // Update inputs immediately
        setFilterState(loadedFilters);
        // Update query immediately
        setActiveFilters(loadedFilters);

        // Restore table state
        if (report.columns) setColumnWidths(report.columns);
        // Validate sort key before applying
        if (report.sort && report.sort.key && validSortKeys.includes(report.sort.key)) {
            setSortKey(report.sort.key);
            setSortOrder(report.sort.sortOrder);
        } else {
            // Default if invalid
            setSortKey('key');
            setSortOrder('DESC');
        }
    };

    const handleReportDeleted = () => {
        fetchReports(); // Refresh list to sync
        addFlag({ title: 'Success', description: 'Report deleted successfully.', appearance: 'success' });
    };

    // Callback when column widths change in table
    const handleColumnResize = (newWidths) => {
        setColumnWidths(newWidths);
    };

    // Callback when sort changes in table
    const handleSortChange = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Developer Reporter</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ minWidth: '200px' }}>
                        <Select
                            placeholder="Load Saved Report..."
                            options={savedReports.map(r => ({ label: r.name, value: r }))}
                            value={selectedReportOption}
                            onChange={handleLoadReport}
                            isClearable
                        />
                    </div>
                    <Button appearance="default" onClick={() => setIsSaveReportModalOpen(true)}>Save View</Button>
                    <Button appearance="subtle" onClick={() => setIsManageReportsModalOpen(true)}>Manage</Button>
                </div>
            </div>

            <FilterBar
                filterState={filterState}
                onFilterChange={handleFilterStateChange}
                onApply={handleApplyFilters}
            />

            <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <Button appearance="primary" onClick={() => setIsModalOpen(true)} isDisabled={selectedIssues.length === 0}>
                    Add Comment ({selectedIssues.length})
                </Button>
                <Button onClick={() => setIsExportModalOpen(true)}>Export Excel</Button>
                <Button onClick={() => setIsScheduleModalOpen(true)}>Schedule Export</Button>
            </div>

            <ReportTable
                rows={rows}
                loading={loading}
                onSelectionChange={handleSelectionChange}
                selectedIssues={selectedIssues}
                columnWidths={columnWidths}
                onWidthChange={handleColumnResize}
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
            />

            {/* Modals */}
            <BulkCommentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedIssueKeys={selectedIssues}
                onSuccess={() => {
                    setIsModalOpen(false);
                    // Refresh data using currently active filters
                    fetchData(activeFilters);
                    addFlag({ title: 'Success', description: 'Comments added successfully.', appearance: 'success' });
                }}
            />

            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                rows={rows}
            />

            <ScheduleExportModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                filters={activeFilters}
                currentUser={currentUser}
            />

            <SaveReportModal
                isOpen={isSaveReportModalOpen}
                onClose={() => setIsSaveReportModalOpen(false)}
                onSave={handleSaveReport}
            />

            <ManageReportsModal
                isOpen={isManageReportsModalOpen}
                onClose={() => setIsManageReportsModalOpen(false)}
                reports={savedReports}
                onReportDeleted={handleReportDeleted}
                currentUserAccountId={currentUser?.accountId}
                addFlag={addFlag}
            />

            <FlagGroup onDismissed={handleDismissFlag}>
                {flags.map(flag => (
                    <AutoDismissFlag
                        key={flag.id}
                        id={flag.id}
                        icon={flag.icon}
                        title={flag.title}
                        description={flag.description}
                        appearance={flag.appearance}
                    />
                ))}
            </FlagGroup>
        </div>
    );
};

export default Dashboard;
