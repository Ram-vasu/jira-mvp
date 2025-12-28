import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import Button from '@atlaskit/button';
import FilterBar from './FilterBar';
import ReportTable from './ReportTable';
import BulkCommentModal from './BulkCommentModal';
import ExportModal from './ExportModal';
import ScheduleExportModal from './ScheduleExportModal';

const Dashboard = () => {
    const [filters, setFilters] = useState({});
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIssues, setSelectedIssues] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    const fetchData = async (currentFilters) => {
        setLoading(true);
        try {
            const issues = await invoke('getIssues', currentFilters);
            setRows(issues);
            setSelectedIssues([]); // Clear selection on fetch
        } catch (err) {
            console.error('Failed to fetch issues', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(filters);
    }, [filters]);

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
    };

    const handleSelectionChange = (newSelection) => {
        setSelectedIssues(newSelection);
    };

    const handleBulkSuccess = () => {
        fetchData(filters); // Refresh
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Developer Reports</h1>
            <FilterBar onFilterChange={handleFilterChange} />

            <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button isDisabled={selectedIssues.length === 0} onClick={() => setIsModalOpen(true)}>
                        Add Comment ({selectedIssues.length})
                    </Button>
                    <Button onClick={() => setIsExportModalOpen(true)}>
                        Export
                    </Button>
                    <Button onClick={() => setIsScheduleModalOpen(true)}>
                        Schedule Export
                    </Button>
                </div>
                <div>Total Issues: {rows.length}</div>
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ebecf0' }} />
            <ReportTable rows={rows} loading={loading} selectedIssues={selectedIssues} onSelectionChange={handleSelectionChange} />

            <BulkCommentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedIssues={selectedIssues}
                onComplete={handleBulkSuccess}
            />
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                rows={rows}
            />
            <ScheduleExportModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                currentFilters={filters}
            />
        </div>
    );
};

export default Dashboard;
