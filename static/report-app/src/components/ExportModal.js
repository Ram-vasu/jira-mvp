import React, { useState } from 'react';
import Modal, { ModalTransition, ModalHeader, ModalBody, ModalFooter, ModalTitle } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';

import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

// I didn't install @atlaskit/radio. I will use standard inputs for speed.
import styled from 'styled-components';

const Field = styled.div`
    margin-bottom: 16px;
`;
const Label = styled.div`
    font-weight: 600;
    margin-bottom: 8px;
`;

const OPTIONS = ['Key', 'Summary', 'Assignee', 'Status', 'TimeSpent', 'Estimate', 'Exceeded', 'Comments'];

const ExportModal = ({ isOpen, onClose, rows, selectedIssues = [], visibleColumnKeys = [] }) => {
    const [format, setFormat] = useState('excel');
    const [commentMode, setCommentMode] = useState('last');
    const [selectedFields, setSelectedFields] = useState(OPTIONS);
    const [onlySelected, setOnlySelected] = useState(false);

    // Sync default selection with visible columns from Dashboard
    React.useEffect(() => {
        if (isOpen && visibleColumnKeys.length > 0) {
            const mapped = visibleColumnKeys.map(k => {
                if (k === 'timeSpent') return 'TimeSpent';
                if (k === 'key') return 'Key';
                if (k === 'summary') return 'Summary';
                if (k === 'assignee') return 'Assignee';
                if (k === 'status') return 'Status';
                if (k === 'estimate') return 'Estimate';
                if (k === 'comment') return 'Comments';
                return null;
            }).filter(Boolean);

            // Always add 'Exceeded' if TimeSpent is there, or just default it
            if (mapped.includes('TimeSpent')) mapped.push('Exceeded');

            setSelectedFields(mapped);
        }
    }, [isOpen, visibleColumnKeys]);

    const toggleField = (field) => {
        if (selectedFields.includes(field)) {
            setSelectedFields(selectedFields.filter(f => f !== field));
        } else {
            setSelectedFields([...selectedFields, field]);
        }
    };

    const handleExport = () => {
        let exportRows = rows;
        if (onlySelected && selectedIssues.length > 0) {
            exportRows = rows.filter(r => selectedIssues.includes(r.id));
        }

        if (format === 'csv') exportToCSV(exportRows, commentMode, selectedFields);
        if (format === 'excel') exportToExcel(exportRows, commentMode, selectedFields);
        if (format === 'pdf') exportToPDF(exportRows, commentMode, selectedFields);
        onClose();
    };

    return (
        <ModalTransition>
            {isOpen && (
                <Modal onClose={onClose}>
                    <ModalHeader>
                        <ModalTitle>Export Report</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Field>
                            <Label>Rows to Export</Label>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={onlySelected}
                                        onChange={(e) => setOnlySelected(e.target.checked)}
                                        disabled={selectedIssues.length === 0}
                                        style={{ marginRight: 8 }}
                                    />
                                    Export only selected issues ({selectedIssues.length} selected)
                                </label>
                            </div>
                        </Field>
                        <Field>
                            <Label>Format</Label>
                            <div>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={format === 'excel'} onChange={() => setFormat('excel')} /> Excel
                                </label>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
                                </label>
                                <label>
                                    <input type="radio" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> PDF
                                </label>
                            </div>
                        </Field>
                        <Field>
                            <Label>Columns</Label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {OPTIONS.map(opt => (
                                    <label key={opt} style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFields.includes(opt)}
                                            onChange={() => toggleField(opt)}
                                            style={{ marginRight: 8 }}
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        </Field>
                        <Field>
                            <Label>Comments Detail (if included)</Label>
                            <div>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={commentMode === 'none'} onChange={() => setCommentMode('none')} /> None
                                </label>
                                <label style={{ marginRight: 10 }}>
                                    <input type="radio" checked={commentMode === 'last'} onChange={() => setCommentMode('last')} /> Last Comment
                                </label>
                                <label>
                                    <input type="radio" checked={commentMode === 'full'} onChange={() => setCommentMode('full')} /> Full History
                                </label>
                            </div>
                        </Field>
                    </ModalBody>
                    <ModalFooter>
                        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
                        <Button appearance="primary" onClick={handleExport}>Download</Button>
                    </ModalFooter>
                </Modal>
            )}
        </ModalTransition>
    );
};

export default ExportModal;
